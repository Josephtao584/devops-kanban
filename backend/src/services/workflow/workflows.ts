import * as path from 'node:path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../../config/index.js';
import { executeWorkflowStep, continueWorkflowStepWithAnswer } from './workflowStepExecutor.js';
import type { WorkflowInstanceEntity } from '../../types/entities.js';
import type { WorkflowLifecycle } from './workflowLifecycle.js';
import { logger } from '../../utils/logger.js';

const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
  projectEnv: z.record(z.string()).optional(),
});

const stepOutputSchema = z.object({ summary: z.string() });

const firstStepInputSchema = z.object({
  taskId: z.number(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
  projectEnv: z.record(z.string()).optional(),
});

// Suspend/resume schemas for confirmation steps
const resumeSchema = z.object({
  approved: z.boolean(),
  comment: z.string().optional(),
  ask_user_answer: z.string().optional(),
});

const suspendSchema = z.object({
  reason: z.string(),
  stepName: z.string(),
  summary: z.string().optional(),
  ask_user_question: z.object({
    tool_use_id: z.string(),
    questions: z.array(z.object({
      question: z.string(),
      header: z.string().optional(),
      options: z.array(z.object({
        label: z.string(),
        value: z.string().optional(),
        description: z.string().optional(),
      })).optional(),
      multiSelect: z.boolean().optional(),
    })).optional(),
  }).optional(),
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
  task: { id: number; project_id: number; execution_path: string };
  lifecycle: WorkflowLifecycle;
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

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            logger.info('Workflows', `Step ${templateStep.id} received abort signal! workflowRun: ${options.runId}`);
          });
        }

        // Type the resume data and suspend data
        const typedResumeData = resumeData as { approved?: boolean; comment?: string; ask_user_answer?: string } | undefined;
        const typedSuspendData = suspendData as { reason?: string; stepName?: string; summary?: string; ask_user_question?: Record<string, unknown> } | undefined;

        // === Resume after AskUserQuestion (user answered) ===
        if (typedResumeData?.ask_user_answer !== undefined && typedSuspendData?.ask_user_question) {
          logger.info('Workflows', `Step ${templateStep.id} resuming with AskUserQuestion answer`);

          const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
          if (!sessionInfo) {
            abort();
            return { summary: '' };
          }

          await options.lifecycle.onStepResume(options.runId, templateStep.id, {
            approved: true,
            ask_user_answer: typedResumeData.ask_user_answer,
          });

          // Get provider_session_id from the suspended step
          const run = await options.lifecycle.workflowRunRepo.findById(options.runId);
          const suspendedStep = run?.steps.find(s => s.step_id === templateStep.id);
          const providerSessionId = suspendedStep?.provider_session_id;

          if (!providerSessionId) {
            logger.warn('Workflows', `Step ${templateStep.id} has no provider_session_id for AskUserQuestion resume`);
            await options.lifecycle.onStepError(options.runId, templateStep.id, 'No provider session ID found for AskUserQuestion resume');
            throw new Error('No provider session ID found for AskUserQuestion resume');
          }

          const answerPrompt = `${typedResumeData.ask_user_answer}`;

          try {
            // Save user's answer as a user message event
            await options?.lifecycle.sessionEventRepo.append({
              session_id: sessionInfo.sessionId,
              segment_id: sessionInfo.segmentId,
              kind: 'message',
              role: 'user',
              content: answerPrompt,
              payload: {},
            });

            const result = await continueWorkflowStepWithAnswer({
              workflowInstance,
              stepId: templateStep.id,
              worktreePath: state.worktreePath,
              providerSessionId,
              answerPrompt,
              onEvent: async (event) => {
                await options?.lifecycle.sessionEventRepo.append({
                  session_id: sessionInfo.sessionId,
                  segment_id: sessionInfo.segmentId,
                  kind: event.kind,
                  role: event.role,
                  content: event.content,
                  payload: event.payload || {},
                });
              },
              onProviderState: async (providerState) => {
                if (sessionInfo.segmentId && options?.lifecycle.sessionSegmentRepo && providerState.providerSessionId) {
                  await options.lifecycle.sessionSegmentRepo.update(sessionInfo.segmentId, {
                    provider_session_id: providerState.providerSessionId,
                  });
                  await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                    provider_session_id: providerState.providerSessionId,
                  });
                }
              },
            });

            // If step requires confirmation, re-suspend for confirmation instead of auto-completing
            if (requiresConfirmation) {
              logger.info('Workflows', `Step ${templateStep.id} requires confirmation after AskUserQuestion, re-suspending for confirmation`);
              const now = new Date().toISOString();
              await options.lifecycle.workflowRunRepo.updateStep(options.runId, templateStep.id, {
                status: 'SUSPENDED',
                completed_at: now,
                suspend_reason: '等待确认',
                summary: result.summary || null,
              });
              await options.lifecycle.workflowRunRepo.update(options.runId, {
                status: 'SUSPENDED',
                current_step: templateStep.id,
              });

              return await suspend({
                reason: '等待确认',
                stepName: templateStep.name,
                summary: result.summary || '',
              });
            }

            await options.lifecycle.onStepComplete(options.runId, templateStep.id, result);
            return result;
          } catch (err) {
            // Handle another AskUserQuestion during resumed execution
            const anyErr = err as any;
            if (anyErr?.message === 'STEP_AWAITING_USER_INPUT' && anyErr?.askUserQuestion) {
              logger.info('Workflows', `Step ${templateStep.id} suspended again for AskUserQuestion during resume`);

              await options.lifecycle.onStepSuspend(options.runId, templateStep.id, {
                reason: 'AI 需要用户提供更多信息',
                summary: '',
                ask_user_question: anyErr.askUserQuestion,
              });

              return await suspend({
                reason: 'AI 需要用户提供更多信息',
                stepName: templateStep.name,
                summary: '',
                ask_user_question: anyErr.askUserQuestion,
              });
            }

            const errorMessage = err instanceof Error ? err.message : String(err);
            await options.lifecycle.onStepError(options.runId, templateStep.id, errorMessage);
            throw err;
          }
        }

        // === Resume execution (user confirmed for requiresConfirmation) ===
        if (requiresConfirmation && typedResumeData?.approved && !typedSuspendData?.ask_user_question) {
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

        // === First execution ===
        let sessionId: number | undefined;
        let segmentId: number | undefined;
        const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
        if (!sessionInfo) {
          logger.info('Workflows', `Step ${templateStep.id} start was skipped or cancelled for workflowRun: ${options.runId}`);
          abort();
          return { summary: '' };
        }

        sessionId = sessionInfo.sessionId;
        segmentId = sessionInfo.segmentId;

        // Loop for AskUserQuestion rounds: instead of suspending the workflow,
        // wait internally for user to respond, then re-execute with the answer.
        while (true) {
          try {
            const result = await executeWorkflowStep({
              stepId: templateStep.id,
              worktreePath: state.worktreePath,
              state: {
                taskTitle: state.taskTitle,
                taskDescription: state.taskDescription,
                worktreePath: state.worktreePath,
                ...(state.projectEnv ? { projectEnv: state.projectEnv } : {}),
              },
              inputData,
              workflowInstance,
              abortSignal,
              upstreamStepIds: previousStepId ? [previousStepId] : [],
              onEvent: async (event) => {
                await options?.lifecycle.sessionEventRepo.append({
                  session_id: sessionId,
                  segment_id: segmentId,
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

            if (abortSignal?.aborted) {
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
            await options.lifecycle.onStepComplete(options.runId, templateStep.id, result);

            return result;
          } catch (err) {
            // Handle AskUserQuestion: set session to ASK_USER and wait for response internally.
            // Do NOT suspend the workflow — the step polls for the user's answer.
            const anyErr = err as any;
            if (anyErr?.message === 'STEP_AWAITING_USER_INPUT' && anyErr?.askUserQuestion) {
              logger.info('Workflows', `Step ${templateStep.id} encountered AskUserQuestion, waiting for user response`);

              await options.lifecycle.onSessionAskUser(options.runId, templateStep.id, {
                ask_user_question: anyErr.askUserQuestion,
              });

              // Wait for user to respond via chat (continueSession changes session from ASK_USER to RUNNING)
              const userAnswer = await options.lifecycle.waitForSessionResponse(sessionId!);

              logger.info('Workflows', `Step ${templateStep.id} received user response, re-executing with answer`);

              // Use the user's answer as the new prompt for the next execution round
              inputData = { ...inputData, userAnswer };

              // Loop back to re-execute with the answer
              continue;
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
          logger.info('Workflows', `Workflow suspended at steps: ${suspendedSteps?.join(', ')}`);
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