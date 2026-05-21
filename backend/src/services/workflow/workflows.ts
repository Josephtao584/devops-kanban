import * as path from 'node:path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../../config/index.js';
import { executeWorkflowStep, continueWorkflowStepWithAnswer } from './workflowStepExecutor.js';
import type { Suggestion, WorkflowInstanceEntity, WorkflowRunEntity } from '../../types/entities.js';
import type { WorkflowLifecycle } from './workflowLifecycle.js';
import { logger } from '../../utils/logger.js';

const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
  workDir: z.string().optional(),
  projectEnv: z.record(z.string()).optional(),
  taskExternalId: z.string().optional(),
  retryNote: z.string().optional(),
  retryNoteStepId: z.string().optional(),
});

const stepOutputSchema = z.object({
  summary: z.string(),
  earlyExitDecision: z.enum(['CONTINUE', 'SUCCESS_EXIT', 'FAIL_EXIT']).optional(),
  earlyExitReason: z.string().nullable().optional(),
});

const firstStepInputSchema = z.object({
  taskId: z.number(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
  workDir: z.string().optional(),
  projectEnv: z.record(z.string()).optional(),
  taskExternalId: z.string().optional(),
});

// Suspend/resume schemas for confirmation steps and AskUserQuestion
const resumeSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
  ask_user_answer: z.string().optional(),
});

const suspendSchema = z.object({
  reason: z.string(),
  stepName: z.string(),
  summary: z.string().optional(),
  providerSessionId: z.string().optional(),
  askUserQuestion: z.record(z.unknown()).optional(),
});

let _mastra: Mastra | null = null;
let _initialized = false;

export async function initWorkflows() {
  if (_initialized) return;
  const dbPath = path.join(STORAGE_PATH as string, 'mastra.db');
  _mastra = new Mastra({
    storage: new LibSQLStore({ id: 'kanban-workflow-store', url: `file:${dbPath}` }),
  });
  _initialized = true;
}

export function getMastra() {
  if (!_mastra) throw new Error('Mastra not initialized. Call initWorkflows() first.');
  return _mastra;
}

interface BuildWorkflowOptions {
  runId: number;
  task: { id: number; project_id: number; execution_path: string; work_dir?: string | null };
  lifecycle: WorkflowLifecycle;
  loopContext?: {
    fromStepId: string;
    text: string;
  };
}

export function cropInstanceForLoop(
  instance: WorkflowInstanceEntity,
  fromStepId: string | null,
): WorkflowInstanceEntity {
  if (fromStepId === null) return instance;
  const idx = instance.steps.findIndex(s => s.id === fromStepId);
  if (idx === -1) throw new Error(`Step "${fromStepId}" not found in instance`);
  return { ...instance, steps: instance.steps.slice(idx) };
}

/**
 * Renders the loop preamble injected into the next iteration's prompt.
 *
 * SECURITY NOTE: failureContext.error and priorSummaries[].summary are
 * interpolated as raw Markdown. They originate from previous step outputs
 * (executor stderr, error messages, AI summaries) which can contain
 * user-controlled text. A malicious task could produce error output that
 * attempts prompt injection on the next iteration. This is a known dual-use
 * surface in AI orchestration; mitigations include input sanitization at
 * the executor boundary, or treating the loop preamble as untrusted in the
 * agent's system prompt.
 */
export function formatLoopContext(args: {
  fromStepId: string;
  failureContext: { failed_step_id: string; error: string; summary: string | null } | null;
  priorSummaries: { stepId: string; name: string; summary: string | null }[];
}): string {
  const { failureContext, priorSummaries } = args;
  const lines: string[] = [];
  lines.push('## 循环上下文（来自上一轮失败回退）\n');
  if (failureContext) {
    lines.push(`- 上一轮在步骤 **${failureContext.failed_step_id}** 失败`);
    lines.push(`- 错误：${failureContext.error}`);
    if (failureContext.summary) {
      lines.push(`- 失败步骤产出摘要：${failureContext.summary}`);
    }
  }
  if (priorSummaries.length > 0) {
    lines.push('\n### 前序步骤产出摘要');
    for (const s of priorSummaries) {
      lines.push(`- **${s.name}** (${s.stepId})：${s.summary ?? '_摘要不可用_'}`);
    }
  }
  lines.push('\n请基于上述信息改进本步骤的产出。\n---\n');
  return lines.join('\n');
}

export async function collectPriorSummaries(
  runRepo: { findById(id: number): Promise<WorkflowRunEntity | null> },
  runId: number,
  fromStepId: string,
): Promise<{ stepId: string; name: string; summary: string | null }[]> {
  const out: { stepId: string; name: string; summary: string | null }[] = [];
  let current = await runRepo.findById(runId);
  while (current) {
    for (const s of current.steps) {
      if (s.step_id === fromStepId) break;
      // Only include non-SKIPPED steps from the deepest run that actually executed them
      if (s.status !== 'SKIPPED' && !out.find(o => o.stepId === s.step_id)) {
        out.push({ stepId: s.step_id, name: s.name, summary: s.summary });
      }
    }
    if (!current.parent_run_id) break;
    current = await runRepo.findById(current.parent_run_id);
  }
  // Order by template position by reversing so earliest first
  return out.reverse();
}

export function getWorkflowFromWorkflowId(workflowId: string) {
  try {
    return getMastra().getWorkflow(workflowId);
  } catch {
    return null;
  }
}

/**
 * Check if a workflow is registered with Mastra
 */
export function hasWorkflow(workflowId: string): boolean {
  try {
    getMastra().getWorkflow(workflowId);
    return true;
  } catch {
    return false;
  }
}

export function buildWorkflowFromInstance(
  workflowInstance: WorkflowInstanceEntity,
  options: BuildWorkflowOptions,
) {

  const steps = workflowInstance.steps.map((templateStep, index) => {
    const isFirst = index === 0;
    const previousStepId = index > 0 ? workflowInstance.steps[index - 1]?.id : null;
    const requiresConfirmation = templateStep.requiresConfirmation ?? false;

    // SPLIT_TASK steps use a different execution path — they call an AI agent to produce split suggestions,
    // rather than running code in the worktree with the normal workflow prompt.
    if (templateStep.type === 'SPLIT_TASK') {
      return createStep({
        id: templateStep.id,
        inputSchema: isFirst ? firstStepInputSchema : stepOutputSchema,
        outputSchema: stepOutputSchema,
        stateSchema: sharedStateSchema,
        resumeSchema,
        suspendSchema,
        execute: async ({ inputData, state, abortSignal, abort, resumeData, suspend, suspendData }) => {
          const signalAlreadyAborted = abortSignal?.aborted ?? false;
          if (signalAlreadyAborted) {
            logger.warn('Workflows', `SPLIT_TASK step ${templateStep.id} received stale abort signal, ignoring. workflowRun: ${options.runId}`);
          }

          logger.info('Workflows', `SPLIT_TASK step ${templateStep.id} starting, workflowRun: ${options.runId}, resumeData: ${!!resumeData}`);

          // === Resume from AskUserQuestion ===
          const typedResumeData = resumeData as { ask_user_answer?: string } | undefined;
          const typedSuspendData = suspendData as { providerSessionId?: string } | undefined;
          let pendingAnswer: string | undefined;
          let askUserSessionInfo: { sessionId: number | undefined; segmentId: number | undefined } | null = null;
          let providerSessionId: string | undefined = typedSuspendData?.providerSessionId;

          if (typedResumeData?.ask_user_answer) {
            const savedProviderSessionId = typedSuspendData?.providerSessionId;
            if (!savedProviderSessionId) {
              throw new Error(`Cannot resume AskUserQuestion in SPLIT_TASK step ${templateStep.id}: provider_session_id not found`);
            }

            askUserSessionInfo = await options.lifecycle.onStepAskUserResume(options.runId, templateStep.id);
            if (!askUserSessionInfo) {
              logger.info('Workflows', `SPLIT_TASK step ${templateStep.id} AskUser resume cancelled for workflowRun: ${options.runId}`);
              abort();
              return { summary: '' };
            }

            providerSessionId = savedProviderSessionId;
            pendingAnswer = typedResumeData.ask_user_answer;
          }

          const maxRetries = Math.min(templateStep.maxRetries ?? 0, 3);

          for (let attempt = 0; ; attempt++) {
          let askUserHandled = false;
          try {
            // Skip onStepStart on resume — the session/segment from the original execution
            // are already restored via onStepAskUserResume above.
            let sessionId: number | undefined;
            let segmentId: number | undefined;
            if (!pendingAnswer) {
              const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
              if (!sessionInfo) {
                abort();
                return { summary: '' };
              }
              sessionId = sessionInfo.sessionId;
              segmentId = sessionInfo.segmentId;
            } else {
              // Resume path: use the session/segment already restored by onStepAskUserResume
              sessionId = askUserSessionInfo!.sessionId;
              segmentId = askUserSessionInfo!.segmentId;
            }

            const { renderSplitPrompt, DEFAULT_SPLIT_PROMPT } = await import('./defaultSplitPrompt.js');
            const { extractJsonBlock } = await import('./parseJsonBlock.js');
            const { matchProject } = await import('./projectMatcher.js');
            const { splitSuggestionRepository } = await import('../../repositories/splitSuggestionRepository.js');
            const { ProjectRepository } = await import('../../repositories/projectRepository.js');
            const { TaskRepository } = await import('../../repositories/taskRepository.js');
            const { AgentRepository } = await import('../../repositories/agentRepository.js');
            const { AgentExecutorRegistry } = await import('./agentExecutorRegistry.js');
            const { adaptStepResult } = await import('./stepResultAdapter.js');

            const taskRepo = new TaskRepository();
            const task = await taskRepo.findById(options.task.id);
            if (!task) throw new Error(`Task ${options.task.id} not found`);

            if (task.parent_task_id != null && task.parent_task_id > 0) {
              logger.info('Workflows', `skip: task ${options.task.id} is a child task`);
              await options.lifecycle.onStepComplete(options.runId, templateStep.id, { summary: 'Skipped: child task' });
              return { summary: 'Skipped: this is a child task, not splitting further.' };
            }

            const projectRepo = new ProjectRepository();
            const project = await projectRepo.findById(task.project_id);
            if (!project) throw new Error(`Project ${task.project_id} not found`);

            const allProjects = await projectRepo.findAll();

            // inputData can be firstStepInputSchema or stepOutputSchema — summary only on stepOutputSchema
            const lastStepOutput = 'summary' in (inputData as Record<string, unknown>)
              ? (inputData as { summary: string }).summary
              : '';

            const splitPrompt = renderSplitPrompt(templateStep.instructionPrompt || DEFAULT_SPLIT_PROMPT, {
              task_title: state.taskTitle,
              task_description: state.taskDescription,
              project_name: project.name,
              project_repo_url: project.git_url ?? '',
              last_step_output: lastStepOutput,
            }).replaceAll('\n', '\\n');

            // Prepend loop context when this SPLIT_TASK step is the loop
            // entry point. Same convention as the standard step path so the
            // agent sees failure summary + prior outputs before the split
            // instruction. The preamble is escaped the same way splitPrompt
            // is (`.replaceAll('\n', '\\n')`) so the persisted prompt is
            // uniformly single-line escaped.
            const retryNote = state.retryNote && state.retryNoteStepId === templateStep.id
              ? state.retryNote
              : undefined;

            let finalSplitPrompt: string;
            if (options.loopContext && options.loopContext.fromStepId === templateStep.id) {
              finalSplitPrompt = `${options.loopContext.text.replaceAll('\n', '\\n')}\\n${splitPrompt}`;
            } else if (retryNote) {
              finalSplitPrompt = `## Previous Attempt Feedback\\n${retryNote.replaceAll('\n', '\\n')}\\n\\n${splitPrompt}`;
            } else {
              finalSplitPrompt = splitPrompt;
            }

            // Persist the assembled prompt so the UI can show what was sent.
            await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
              assembled_prompt: finalSplitPrompt,
            }).catch(() => {});

            // Execute agent with split prompt
            const agentRepo = new AgentRepository();
            const { TASK_SPLITTER_AGENT_ROLE } = await import('./builtinTaskSplitAgent.js');
            let agent = templateStep.agentId ? await agentRepo.findById(templateStep.agentId) : null;
            if (!agent) {
              const allAgents = await agentRepo.findAll();
              agent = allAgents.find(a => a.role === TASK_SPLITTER_AGENT_ROLE) ?? null;
              if (!agent) throw new Error(`No agent configured for SPLIT_TASK step and no ${TASK_SPLITTER_AGENT_ROLE} agent found`);
            }

            const registry = new AgentExecutorRegistry();
            const executor = registry.getExecutor(agent.executorType);

            if (!Array.isArray(agent.skills) || agent.skills.some((skill: any) => typeof skill !== 'number')) {
              throw new Error(`Agent ${agent.id} has invalid skills configuration`);
            }
            if (!Array.isArray(agent.mcpServers) || agent.mcpServers.some((id: any) => typeof id !== 'number')) {
              throw new Error(`Agent ${agent.id} has invalid MCP servers configuration`);
            }

            // Write the user prompt as the first event so it appears before streaming events
            // Skip on resume — the prompt was already written in the original execution
            if (!pendingAnswer && sessionId && segmentId) {
              await options.lifecycle.sessionEventRepo.append({
                session_id: sessionId,
                segment_id: segmentId,
                kind: 'message',
                role: 'user',
                content: finalSplitPrompt,
                payload: {},
              }).catch(() => {});
            }

            const executionResult = pendingAnswer
              ? await executor.continue({
                  worktreePath: state.worktreePath,
                  cwdSubdir: state.workDir,
                  providerSessionId: providerSessionId!,
                  prompt: pendingAnswer,
                  executorConfig: {
                    type: agent.executorType,
                    skills: [...agent.skills],
                    mcpServers: [...agent.mcpServers],
                    env: agent.env ? { ...agent.env } : undefined,
                    settingsPath: agent.settingsPath || undefined,
                  },
                  ...(signalAlreadyAborted ? {} : { abortSignal }),
                  onEvent: async (event) => {
                    if (event.kind === 'ask_user') return;
                    if (askUserSessionInfo?.sessionId && askUserSessionInfo?.segmentId) {
                      await options.lifecycle.sessionEventRepo.append({
                        session_id: askUserSessionInfo.sessionId,
                        segment_id: askUserSessionInfo.segmentId,
                        kind: event.kind,
                        role: event.role,
                        content: event.content,
                        payload: event.payload || {},
                      }).catch(() => {});
                    }
                  },
                  onProviderState: async (providerState) => {
                    if (askUserSessionInfo?.segmentId && providerState.providerSessionId) {
                      await options.lifecycle.sessionSegmentRepo?.update(askUserSessionInfo.segmentId, {
                        provider_session_id: providerState.providerSessionId,
                      }).catch(() => {});
                      await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                        provider_session_id: providerState.providerSessionId,
                      }).catch(() => {});
                    }
                  },
                  onAskUser: async () => {
                    logger.info('Workflows', `SPLIT_TASK step ${templateStep.id} detected AskUserQuestion during continuation`);
                  },
                })
              : await executor.execute({
                  prompt: finalSplitPrompt,
                  worktreePath: state.worktreePath,
                  cwdSubdir: state.workDir,
                  executorConfig: {
                    type: agent.executorType,
                    skills: [...agent.skills],
                    mcpServers: [...agent.mcpServers],
                    env: agent.env ? { ...agent.env } : undefined,
                    settingsPath: agent.settingsPath || undefined,
                  },
                  ...(signalAlreadyAborted ? {} : { abortSignal }),
                  onEvent: async (event) => {
                    if (event.kind === 'ask_user') return;
                    if (sessionId && segmentId) {
                      await options.lifecycle.sessionEventRepo.append({
                        session_id: sessionId,
                        segment_id: segmentId,
                        kind: event.kind,
                        role: event.role,
                        content: event.content,
                        payload: event.payload || {},
                      }).catch(() => {});
                    }
                  },
                  onProviderState: async (providerState) => {
                    if (segmentId && providerState.providerSessionId) {
                      await options.lifecycle.sessionSegmentRepo?.update(segmentId, {
                        provider_session_id: providerState.providerSessionId,
                      }).catch(() => {});
                      await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                        provider_session_id: providerState.providerSessionId,
                      }).catch(() => {});
                    }
                  },
                  onAskUser: async () => {
                    logger.info('Workflows', `SPLIT_TASK step ${templateStep.id} detected AskUserQuestion during execution`);
                  },
                });

            // Write the final summary as the last event
            if (sessionId && segmentId) {
              const adaptedPreview = adaptStepResult(agent.executorType, executionResult);
              await options.lifecycle.sessionEventRepo.append({
                session_id: sessionId,
                segment_id: segmentId,
                kind: 'message',
                role: 'assistant',
                content: adaptedPreview.summary,
                payload: {},
              }).catch(() => {});
            }

            // Check for fresh abort signal after execution
            if (abortSignal?.aborted && !signalAlreadyAborted) {
              abort();
              return { summary: '' };
            }

            const adaptedResult = adaptStepResult(agent.executorType, executionResult);

            let rawSuggestions;
            try {
              rawSuggestions = extractJsonBlock(adaptedResult.summary);
            } catch (e) {
              throw new Error(`AI 输出未包含有效的 JSON 代码块: ${(e as Error).message}`);
            }

            if (!Array.isArray(rawSuggestions)) {
              throw new Error('AI 输出必须是 JSON 数组');
            }

            const suggestions = rawSuggestions.map((raw: any) => {
              const linkedId = raw.linked_project_id ?? matchProject(
                { title: raw.title ?? '', target_repo_url: raw.target_repo_url ?? null },
                allProjects,
              );
              const matchedProject = linkedId ? allProjects.find(p => p.id === linkedId) : null;
              const templateId = raw.template_id ?? matchedProject?.default_template_id ?? null;
              return {
                title: String(raw.title ?? '未命名任务'),
                description: String(raw.description ?? ''),
                template_id: templateId,
                linked_project_id: linkedId,
                target_repo_url: linkedId ? null : (raw.target_repo_url ?? null),
                depends_on_indices: Array.isArray(raw.depends_on_indices) ? raw.depends_on_indices : [],
                enabled: raw.enabled !== false,
                // AI can't infer worktree/auto-start preferences — default to true and let the user override in the split-suggestion card.
                create_worktree: true,
                auto_start: true,
                child_task_id: null,
              };
            });

            const splitEntity = {
              parent_task_id: options.task.id,
              workflow_run_id: options.runId,
              status: 'PENDING',
              suggestions,
              confirmed_at: null,
            } as {
              parent_task_id: number;
              workflow_run_id: number;
              status: 'PENDING';
              suggestions: Suggestion[];
              confirmed_at: string | null;
            };
            await splitSuggestionRepository.create(splitEntity);

            const summary = `已生成 ${suggestions.length} 条拆分建议，等待用户审核。`;
            await options.lifecycle.onStepComplete(options.runId, templateStep.id, { summary });

            return { summary };
          } catch (err) {
            const anyErr = err as any;
            const errorMessage = err instanceof Error ? err.message : String(err);

            // Handle AskUserQuestion: suspend the Mastra workflow so state persists across restarts.
            if (anyErr?.message === 'STEP_AWAITING_USER_INPUT' && anyErr?.askUserQuestion) {
              logger.info('Workflows', `SPLIT_TASK step ${templateStep.id} encountered AskUserQuestion, suspending workflow`);

              // Get providerSessionId from current run step
              const currentRun = await options.lifecycle.workflowRunRepo.findById(options.runId);
              providerSessionId = currentRun?.steps.find((s: any) => s.step_id === templateStep.id)?.provider_session_id ?? providerSessionId;
              if (!providerSessionId) {
                throw new Error(`Cannot suspend SPLIT_TASK step ${templateStep.id}: provider_session_id not found. The AI session may have ended before asking the question.`);
              }

              if (!askUserHandled) {
                await options.lifecycle.onSessionAskUser(options.runId, templateStep.id, {
                  ask_user_question: anyErr.askUserQuestion,
                });
                askUserHandled = true;
              }

              return await suspend({
                reason: 'AI 提出了问题',
                stepName: templateStep.name,
                providerSessionId,
                askUserQuestion: anyErr.askUserQuestion,
              });
            }

            // Check for auto-retry
            const currentRetryCount = attempt;
            if (currentRetryCount < maxRetries) {
              const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
              if (sessionInfo?.sessionId && sessionInfo?.segmentId) {
                await options.lifecycle.sessionEventRepo.append({
                  session_id: sessionInfo.sessionId,
                  segment_id: sessionInfo.segmentId,
                  kind: 'status',
                  role: 'system',
                  content: `SPLIT_TASK步骤失败，准备第 ${currentRetryCount + 1} 次重试`,
                  payload: { retry_count: currentRetryCount + 1, max_retries: maxRetries },
                }).catch(() => {});
              }
              logger.info('Workflows', `Auto-retrying SPLIT_TASK step ${templateStep.id} (attempt ${currentRetryCount + 1}/${maxRetries}), workflowRun: ${options.runId}`);
              await new Promise(resolve => setTimeout(resolve, 1500));
              if (sessionInfo) {
                await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                  status: 'PENDING',
                  started_at: null,
                  completed_at: null,
                  error: null,
                  summary: null,
                });
              }
              continue;
            }

            await options.lifecycle.onStepError(options.runId, templateStep.id, errorMessage);
            throw err;
          }
          } // end for loop
        },
      });
    }

    return createStep({
      id: templateStep.id,
      inputSchema: isFirst ? firstStepInputSchema : stepOutputSchema,
      outputSchema: stepOutputSchema,
      stateSchema: sharedStateSchema,
      // All steps support suspend/resume for both confirmation and AskUserQuestion
      resumeSchema,
      suspendSchema,
      execute: async ({ inputData, state, abortSignal, abort, resumeData, suspend, suspendData }) => {
        logger.info('Workflows', `Step ${templateStep.id} starting, abortSignal exists: ${!!abortSignal}, workflowRun: ${options.runId}, resumeData: ${!!resumeData}`);

        // Capture whether the signal was already aborted at step start.
        // A stale signal (aborted before this step began) comes from a previously-cancelled
        // Mastra Run whose AbortController is permanently aborted. We must NOT treat it as a
        // live cancellation — doing so would abort a legitimate retry immediately.
        const signalAlreadyAborted = abortSignal?.aborted ?? false;
        if (signalAlreadyAborted) {
          logger.warn('Workflows', `Step ${templateStep.id} received stale abort signal (from previous cancel), ignoring for retry. workflowRun: ${options.runId}`);
        }

        if (abortSignal && !signalAlreadyAborted) {
          abortSignal.addEventListener('abort', () => {
            logger.info('Workflows', `Step ${templateStep.id} received abort signal! workflowRun: ${options.runId}`);
          });
        }

        // Type the resume data and suspend data
        const typedResumeData = resumeData as { approved?: boolean; comment?: string; ask_user_answer?: string } | undefined;
        const typedSuspendData = suspendData as { reason?: string; stepName?: string; summary?: string; providerSessionId?: string } | undefined;

        let sessionId: number | undefined;
        let segmentId: number | undefined;
        let askUserHandled = false;
        let providerSessionId: string | undefined;
        let pendingAnswer: string | undefined;

        // === Retry with note: continue prior Claude session by sending the note as the next user message ===
        // Only the step targeted by retryNoteStepId is affected; other steps fall through.
        // Falls back to first-execution if no provider_session_id is saved (rare — happens when the
        // previous run died before the executor reported any session_id).
        const isRetryWithNote = !typedResumeData?.ask_user_answer
          && state.retryNote
          && state.retryNoteStepId === templateStep.id;
        if (isRetryWithNote) {
          const currentRun = await options.lifecycle.workflowRunRepo.findById(options.runId);
          const savedProviderSessionId = currentRun?.steps.find((s) => s.step_id === templateStep.id)?.provider_session_id;
          if (savedProviderSessionId) {
            providerSessionId = savedProviderSessionId;
            pendingAnswer = state.retryNote;
            logger.info('Workflows', `Step ${templateStep.id} retry-with-note: will resume session ${savedProviderSessionId}, workflowRun: ${options.runId}`);
          } else {
            logger.warn('Workflows', `Step ${templateStep.id} retry-with-note requested but no provider_session_id saved; falling back to first execution with loopContextText`);
          }
        }

        // === Resume from AskUserQuestion (takes priority over confirmation) ===
        if (typedResumeData?.ask_user_answer) {
          const savedProviderSessionId = typedSuspendData?.providerSessionId;
          if (!savedProviderSessionId) {
            throw new Error(`Cannot resume AskUserQuestion in step ${templateStep.id}: provider_session_id not found`);
          }

          const askUserSessionInfo = await options.lifecycle.onStepAskUserResume(options.runId, templateStep.id);
          if (!askUserSessionInfo) {
            logger.info('Workflows', `Step ${templateStep.id} AskUser resume cancelled for workflowRun: ${options.runId}`);
            abort();
            return { summary: '' };
          }

          sessionId = askUserSessionInfo.sessionId;
          segmentId = askUserSessionInfo.segmentId;
          providerSessionId = savedProviderSessionId;
          // The AI already sees the prior question via the session continuation; sending the raw
          // answer keeps it from being interpreted as a placeholder template.
          pendingAnswer = typedResumeData.ask_user_answer;

          logger.info('Workflows', `Step ${templateStep.id} resuming from AskUserQuestion with answer, workflowRun: ${options.runId}`);
        }

        // === Resume execution (user confirmed for requiresConfirmation) ===
        if (requiresConfirmation && typedResumeData?.approved && !typedResumeData?.ask_user_answer) {
          // Get previous result from suspendData, don't re-execute
          const previousSummary = typedSuspendData?.summary || '';
          logger.info('Workflows', `Step ${templateStep.id} resuming with approved=true, using suspendData.summary`);

          const resumePayload: { approved: boolean; comment?: string } = { approved: true };
          if (typedResumeData.comment !== undefined) {
            resumePayload.comment = typedResumeData.comment;
          }
          await options.lifecycle.onStepResume(options.runId, templateStep.id, resumePayload);
          await options.lifecycle.onStepComplete(options.runId, templateStep.id, { summary: previousSummary });

          return { summary: previousSummary };
        }

        // === First execution (if not resuming from AskUser) ===
        // === Open a session segment if not already opened by AskUser resume ===
        // First execution and retry-with-note both fall here; they only differ in whether
        // pendingAnswer/providerSessionId were pre-seeded (continuation vs fresh prompt).
        if (sessionId === undefined) {
          const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
          if (!sessionInfo) {
            logger.info('Workflows', `Step ${templateStep.id} start was skipped or cancelled for workflowRun: ${options.runId}`);
            abort();
            return { summary: '' };
          }

          sessionId = sessionInfo.sessionId;
          segmentId = sessionInfo.segmentId;
        }

        // === Persist the retry note as the user message so the session log reflects it ===
        if (isRetryWithNote && pendingAnswer !== undefined && sessionId && segmentId) {
          await options.lifecycle.sessionEventRepo.append({
            session_id: sessionId,
            segment_id: segmentId,
            kind: 'message',
            role: 'user',
            content: pendingAnswer,
            payload: { retry_note: true },
          }).catch(() => {});
        }

        while (true) {
          try {
            let result;
            if (pendingAnswer !== undefined && providerSessionId) {
              // Continuation round: send user's answer into the existing AI conversation
              // Clear pendingAnswer BEFORE the call so a throw doesn't cause infinite retry
              const answerToSend = pendingAnswer;
              pendingAnswer = undefined;
              result = await continueWorkflowStepWithAnswer({
                workflowInstance,
                stepId: templateStep.id,
                worktreePath: state.worktreePath,
                cwdSubdir: state.workDir,
                providerSessionId,
                answerPrompt: answerToSend,
                ...(!signalAlreadyAborted && abortSignal ? { abortSignal } : {}),
                onEvent: async (event) => {
                  // ask_user events are handled by onSessionAskUser — skip here to avoid duplicates
                  if (event.kind === 'ask_user') return;
                  await options?.lifecycle.sessionEventRepo.append({
                    session_id: sessionId!,
                    segment_id: segmentId!,
                    kind: event.kind,
                    role: event.role,
                    content: event.content,
                    payload: event.payload || {},
                  });
                },
                onProviderState: async (providerState) => {
                  if (segmentId && options?.lifecycle.sessionSegmentRepo && providerState.providerSessionId) {
                    await options.lifecycle.sessionSegmentRepo.update(segmentId, {
                      provider_session_id: providerState.providerSessionId,
                    });
                    await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                      provider_session_id: providerState.providerSessionId,
                    });
                  }
                },
                // Detection-only callback: the runner already throws STEP_AWAITING_USER_INPUT when
                // an ASK_USER marker is parsed. Passing onAskUser keeps parity with the first-execution
                // path and gives any future spawnImpl variant a hook to fire side effects on detection.
                onAskUser: async () => {
                  logger.info('Workflows', `Step ${templateStep.id} detected AskUserQuestion during continuation`);
                },
              });
            } else {
              // First execution: fresh prompt
              const stepLoopContextText = options.loopContext && options.loopContext.fromStepId === templateStep.id
                ? options.loopContext.text
                : undefined;
              const stepRetryNote = state.retryNote && state.retryNoteStepId === templateStep.id
                ? state.retryNote
                : undefined;
              const effectiveLoopContextText = stepLoopContextText ?? stepRetryNote;
              result = await executeWorkflowStep({
                stepId: templateStep.id,
                worktreePath: state.worktreePath,
                cwdSubdir: state.workDir,
                state: {
                  taskTitle: state.taskTitle,
                  taskDescription: state.taskDescription,
                  worktreePath: state.worktreePath,
                  ...(state.taskExternalId ? { taskExternalId: state.taskExternalId } : {}),
                  ...(state.projectEnv ? { projectEnv: state.projectEnv } : {}),
                },
                inputData,
                workflowInstance,
                ...(!signalAlreadyAborted && abortSignal ? { abortSignal } : {}),
                upstreamStepIds: previousStepId ? [previousStepId] : [],
                isFirstStep: isFirst,
                ...(effectiveLoopContextText ? { loopContextText: effectiveLoopContextText } : {}),
                onEvent: async (event) => {
                  // ask_user events are handled by onSessionAskUser — skip here to avoid duplicates
                  if (event.kind === 'ask_user') return;
                  await options?.lifecycle.sessionEventRepo.append({
                    session_id: sessionId!,
                    segment_id: segmentId!,
                    kind: event.kind,
                    role: event.role,
                    content: event.content,
                    payload: event.payload || {},
                  });
                },
                onProviderState: async (providerState) => {
                  if (segmentId && options?.lifecycle.sessionSegmentRepo && providerState.providerSessionId) {
                    await options.lifecycle.sessionSegmentRepo.update(segmentId, {
                      provider_session_id: providerState.providerSessionId,
                    });
                    await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                      provider_session_id: providerState.providerSessionId,
                    });
                  }
                },
                onAssembledPrompt: async (prompt) => {
                  await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                    assembled_prompt: prompt,
                  });
                },
              });
            }

            // Only abort on a fresh signal — ignore stale signals from a previously-cancelled run
            if (abortSignal?.aborted && !signalAlreadyAborted) {
              abort();
              return { summary: '' };
            }

            // Check if confirmation is required
            if (requiresConfirmation && !typedResumeData?.approved) {
              const suspendReason = `请确认步骤 "${templateStep.name}" 是否完成`;

              await options.lifecycle.onStepSuspend(options.runId, templateStep.id, {
                reason: suspendReason,
                summary: result.summary,
              });

              // Call Mastra suspend with result stored in suspendData
              return await suspend({
                reason: suspendReason,
                stepName: templateStep.name,
                summary: result.summary,
              });
            }

            // Step completed successfully (no confirmation required)
            const earlyExitDecision = result.earlyExitDecision as 'CONTINUE' | 'SUCCESS_EXIT' | 'FAIL_EXIT' | undefined;
            const earlyExitReason = result.earlyExitReason as string | null | undefined;

            if (earlyExitDecision && (earlyExitDecision === 'SUCCESS_EXIT' || earlyExitDecision === 'FAIL_EXIT') && earlyExitReason) {
              await options.lifecycle.onStepComplete(options.runId, templateStep.id, { summary: result.summary });
              await options.lifecycle.onEarlyExit(options.runId, templateStep.id, earlyExitDecision, earlyExitReason);
              return { summary: result.summary, earlyExitDecision, earlyExitReason };
            }

            await options.lifecycle.onStepComplete(options.runId, templateStep.id, result as unknown as Record<string, unknown>);

            return result;
          } catch (err) {
            // Handle AskUserQuestion: suspend the Mastra workflow so state persists across restarts.
            const anyErr = err as any;
            const inContinuation = providerSessionId !== undefined && askUserHandled;
            logger.info(
              'Workflows',
              `Step ${templateStep.id} caught error: message=${anyErr?.message}, hasAskUserQuestion=${!!anyErr?.askUserQuestion}, inContinuation=${inContinuation}`,
            );
            if (anyErr?.message === 'STEP_AWAITING_USER_INPUT' && anyErr?.askUserQuestion) {
              logger.info('Workflows', `Step ${templateStep.id} encountered AskUserQuestion, suspending workflow`);

              // Check providerSessionId BEFORE committing SUSPENDED state to avoid inconsistent state
              const currentRun = await options.lifecycle.workflowRunRepo.findById(options.runId);
              providerSessionId = currentRun?.steps.find((s) => s.step_id === templateStep.id)?.provider_session_id ?? providerSessionId;
              if (!providerSessionId) {
                throw new Error(`Cannot suspend step ${templateStep.id}: provider_session_id not found. The AI session may have ended before asking the question.`);
              }

              // Save ask_user event to session and update workflow run/step to SUSPENDED.
              // askUserHandled guards against duplicate emission within a single execute() call;
              // a *second* AskUserQuestion within the same step lives in a fresh execute() invocation
              // (after Mastra resumed and re-called execute), so the flag is naturally reset.
              if (!askUserHandled) {
                await options.lifecycle.onSessionAskUser(options.runId, templateStep.id, {
                  ask_user_question: anyErr.askUserQuestion,
                });
                askUserHandled = true;
              }

              // Suspend the Mastra workflow — state is persisted to DB, survives server restart.
              // When resumed, execute() is called again with resumeData.ask_user_answer populated.
              return await suspend({
                reason: 'AI 提出了问题',
                stepName: templateStep.name,
                providerSessionId,
                askUserQuestion: anyErr.askUserQuestion,
              });
            }

            // Handle cancellation or timeout while waiting for user input
            if ((err as any)?.message === 'WORKFLOW_CANCELLED' || (err as any)?.message === 'ASK_USER_TIMEOUT') {
              const reason = (err as any).message === 'ASK_USER_TIMEOUT' ? 'Timed out waiting for user response' : 'Workflow cancelled';
              logger.info('Workflows', `Step ${templateStep.id} exiting: ${reason}`);
              await options.lifecycle.onStepCancel(options.runId, templateStep.id).catch(() => {});
              abort();
              return { summary: '' };
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            // Write error event to session so frontend can display it in the session panel
            // This is critical for spawn-level errors (e.g. ENOENT) that never produce stdout/stderr
            if (sessionId && segmentId) {
              await options.lifecycle.sessionEventRepo.append({
                session_id: sessionId,
                segment_id: segmentId,
                kind: 'error',
                role: 'system',
                content: errorMessage,
                payload: {},
              }).catch(() => {});
            }

            // Check for auto-retry
            const maxRetries = Math.min(templateStep.maxRetries ?? 0, 3);
            const currentRun = await options.lifecycle.workflowRunRepo.findById(options.runId);
            const currentStep = currentRun?.steps.find(s => s.step_id === templateStep.id);
            const currentRetryCount = currentStep?.retry_count ?? 0;

            if (currentRetryCount < maxRetries) {
              if (sessionId && segmentId) {
                await options.lifecycle.sessionEventRepo.append({
                  session_id: sessionId,
                  segment_id: segmentId,
                  kind: 'status',
                  role: 'system',
                  content: `步骤失败，准备第 ${currentRetryCount + 1} 次重试`,
                  payload: { retry_count: currentRetryCount + 1, max_retries: maxRetries },
                }).catch(() => {});
              }
              logger.info('Workflows', `Auto-retrying step ${templateStep.id} (attempt ${currentRetryCount + 1}/${maxRetries}), workflowRun: ${options.runId}`);
              await new Promise(resolve => setTimeout(resolve, 1500));
              await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                status: 'PENDING',
                started_at: null,
                completed_at: null,
                error: null,
                summary: null,
              });
              continue;
            }

            await options.lifecycle.onStepError(options.runId, templateStep.id, errorMessage);
            throw err;
          }
        }
      },
    });
  });

  let workflow = createWorkflow({
    id: workflowInstance.instance_id,
    inputSchema: firstStepInputSchema,
    outputSchema: stepOutputSchema,
    stateSchema: sharedStateSchema,
    options: {
      onFinish: async (result) => {
        if (result.status === 'success') {
          await options.lifecycle.onWorkflowComplete(options.runId, result.result ?? {});
        } else if (result.status === 'suspended') {
          // Workflow suspended - lifecycle already handled in onStepSuspend
          const suspendedSteps = (result as any).suspended as string[] | undefined;
          logger.info('Workflows', `Workflow suspended at steps: ${suspendedSteps?.join(', ') ?? 'unknown'}`);
        } else if (result.status === 'failed' || result.status === 'tripwire') {
          const errorMessage = result.error?.message || 'Workflow failed';
          await options.lifecycle.onWorkflowError(options.runId, errorMessage);
        }
      },
      onError: async (errorInfo) => {
        const errorMessage = errorInfo.error?.message || 'Workflow failed';
        await options.lifecycle.onWorkflowError(options.runId, errorMessage);
      },
    },
  });

  for (const step of steps) {
    workflow = workflow.then(step) as any;
  }

  workflow.commit();

  // Register workflow with Mastra for persistence and retrieval
  getMastra().addWorkflow(workflow);

  return workflow;
}

export { sharedStateSchema };