import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { SessionRepository } from '../../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../../repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../../repositories/sessionEventRepository.js';
import { WorkflowInstanceRepository } from '../../repositories/workflowInstanceRepository.js';
import type { SessionEntity, SessionSegmentEntity, WorkflowRunEntity } from '../../types/entities.ts';
import { type WorkflowTaskRecord } from '../../types/workflow.js';
import { resolveAgentSkills } from './workflowSkillSync.js';
import { prepareExecutionSkills } from './executorSkillPreparation.js';
import { cleanupSkillsByManifest, writeSkillManifest } from '../../utils/skillSync.js';
import { resolveAgentMcpServersWithMeta, preCheckMcpServers } from './workflowMcpSync.js';
import { prepareExecutionMcp } from './executorMcpPreparation.js';
import { cleanupMcpJson, cleanupOpenCodeMcpJson } from '../../utils/mcpSync.js';
import { logger } from '../../utils/logger.js';
import { resolve } from 'node:path';
import { type StepSnapshot, WorkflowNotificationEvent } from '../notificationEvents.js';

class WorkflowLifecycle {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  agentRepo: AgentRepository;
  sessionRepo: SessionRepository;
  sessionSegmentRepo: SessionSegmentRepository;
  sessionEventRepo: SessionEventRepository;
  instanceRepo: WorkflowInstanceRepository;
  _stepAttemptSegmentIds: Map<string, number | null>;
  private onWorkflowNotification?: (event: WorkflowNotificationEvent) => void;

  constructor({
    workflowRunRepo,
    taskRepo,
    agentRepo,
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
    instanceRepo,
    onWorkflowNotification,
  }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    agentRepo?: AgentRepository;
    sessionRepo?: SessionRepository;
    sessionSegmentRepo?: SessionSegmentRepository;
    sessionEventRepo?: SessionEventRepository;
    instanceRepo?: WorkflowInstanceRepository;
    onWorkflowNotification?: (event: WorkflowNotificationEvent) => void;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.agentRepo = agentRepo || new AgentRepository();
    this.sessionRepo = sessionRepo || new SessionRepository();
    this.sessionSegmentRepo = sessionSegmentRepo || new SessionSegmentRepository();
    this.sessionEventRepo = sessionEventRepo || new SessionEventRepository();
    this.instanceRepo = instanceRepo || new WorkflowInstanceRepository();
    this._stepAttemptSegmentIds = new Map();
    if (onWorkflowNotification !== undefined) {
      this.onWorkflowNotification = onWorkflowNotification;
    }
  }

  private async _emitNotification(
    type: WorkflowNotificationEvent['type'],
    runId: number,
    taskId: number,
    extra?: {
      currentStepId?: string | null;
      suspendInfo?: {
        reason: string;
        summary?: string | null;
        askUserQuestion?: Record<string, unknown> | null;
      };
      errorMessage?: string;
      earlyExitInfo?: {
        decision: 'SUCCESS_EXIT' | 'FAIL_EXIT';
        reason: string;
        stepId: string;
      };
    },
  ) {
    if (!this.onWorkflowNotification) return;
    try {
      const task = await this.taskRepo.findById(taskId);
      const run = await this.workflowRunRepo.findById(runId);
      const steps: StepSnapshot[] = (run?.steps || []).map((s) => ({
        stepId: s.step_id,
        name: s.name,
        status: s.status,
        summary: s.summary,
      }));

      const notification: WorkflowNotificationEvent = {
        type,
        runId,
        taskId,
        taskTitle: task?.title || `Task #${taskId}`,
        steps,
        currentStepId: extra?.currentStepId ?? run?.current_step ?? null,
      };
      if (extra?.suspendInfo) {
        notification.suspendInfo = {
          reason: extra.suspendInfo.reason,
          ...(extra.suspendInfo.summary != null ? { summary: extra.suspendInfo.summary } : {}),
          ...(extra.suspendInfo.askUserQuestion != null ? { askUserQuestion: extra.suspendInfo.askUserQuestion } : {}),
        };
      }
      if (extra?.errorMessage != null) {
        notification.errorMessage = extra.errorMessage;
      }
      if (extra?.earlyExitInfo != null) {
        notification.earlyExitInfo = extra.earlyExitInfo;
      }
      this.onWorkflowNotification(notification);
    } catch (error) {
      logger.warn('WorkflowLifecycle', `Notification hook failed: ${(error as Error).message}`);
    }
  }

  private _getStepAttemptSegmentKey(runId: number, stepId: string) {
    return `${runId}:${stepId}`;
  }

  private _getStepAttemptSegmentId(runId: number, stepId: string) {
    return this._stepAttemptSegmentIds.get(this._getStepAttemptSegmentKey(runId, stepId)) ?? null;
  }

  private _rememberStepAttemptSegmentId(runId: number, stepId: string, segmentId: number | null) {
    this._stepAttemptSegmentIds.set(this._getStepAttemptSegmentKey(runId, stepId), segmentId);
  }

  private _clearStepAttemptSegmentId(runId: number, stepId: string) {
    this._stepAttemptSegmentIds.delete(this._getStepAttemptSegmentKey(runId, stepId));
  }

  private async _getRunStep(runId: number, stepId: string) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    const step = (run.steps || []).find((candidate) => candidate.step_id === stepId);
    if (!step) {
      throw new Error(`Workflow step not found: ${stepId}`);
    }

    return { run, step };
  }

  private async _getTemplateStepBinding(runId: number, stepId: string) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    const instance = await this.instanceRepo.findByInstanceId(run.workflow_instance_id);
    if (!instance) {
      throw new Error(`Workflow instance not found for run: ${runId}`);
    }
    const stepBinding = instance.steps.find((candidate) => candidate.id === stepId) || null;
    if (!stepBinding) {
      throw new Error(`Workflow template step not found: ${stepId}`);
    }

    return stepBinding;
  }

  private async _createLogicalStepSession(
    runId: number,
    stepId: string,
    task: WorkflowTaskRecord & { execution_path: string },
  ) {
    const stepBinding = await this._getTemplateStepBinding(runId, stepId);
    if (typeof stepBinding.agentId !== 'number') {
      throw new Error(`Workflow template step ${stepId} has no bound agent`);
    }

    const agent = await this.agentRepo.findById(stepBinding.agentId);
    if (!agent) {
      throw new Error(`Workflow step ${stepId} has no valid bound agent`);
    }

    return await this.sessionRepo.create({
      task_id: task.id,
      workflow_run_id: runId,
      workflow_step_id: stepId,
      status: 'RUNNING',
      worktree_path: task.execution_path,
      branch: task.worktree_branch || `task/${task.id}`,
      initial_prompt: stepBinding.instructionPrompt,
      agent_id: stepBinding.agentId,
      executor_type: agent.executorType,
      started_at: new Date().toISOString(),
      completed_at: null,
    });
  }

  private async _createStepAttemptSegment(
    runId: number,
    stepId: string,
    session: SessionEntity,
    triggerType: SessionSegmentEntity['trigger_type'],
    parentSegmentId: number | null,
  ) {
    const segment = await this.sessionSegmentRepo.create({
      session_id: session.id,
      status: 'RUNNING',
      executor_type: session.executor_type,
      agent_id: session.agent_id ?? null,
      provider_session_id: null,
      resume_token: null,
      checkpoint_ref: null,
      trigger_type: triggerType,
      parent_segment_id: parentSegmentId,
      started_at: new Date().toISOString(),
      completed_at: null,
      metadata: {},
    });

    this._rememberStepAttemptSegmentId(runId, stepId, segment.id);
    return segment;
  }

  private async _getCurrentAttemptSegment(runId: number, stepId: string, sessionId: number) {
    const attemptSegmentId = this._getStepAttemptSegmentId(runId, stepId);
    if (!attemptSegmentId) {
      return null;
    }

    const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(sessionId);
    if (!latestSegment || latestSegment.id !== attemptSegmentId) {
      return null;
    }

    return latestSegment;
  }

  private async _isWorkflowStepCancelled(runId: number, stepId: string) {
    const { run, step } = await this._getRunStep(runId, stepId);
    return run.status === 'CANCELLED' || step.status === 'CANCELLED';
  }

  private async _cleanupPreviousStepSkills(executionPath: string, runId: number, executorType?: string): Promise<void> {
    try {
      // Cleanup Claude Code skills
      const claudeSkillsDir = resolve(executionPath, '.claude', 'skills');
      await cleanupSkillsByManifest(claudeSkillsDir, runId);

      // Cleanup OpenCode skills
      if (executorType === 'OPEN_CODE' || !executorType) {
        const openCodeSkillsDir = resolve(executionPath, '.opencode', 'skills');
        await cleanupSkillsByManifest(openCodeSkillsDir, runId);
      }
    } catch (err) {
      logger.warn('WorkflowLifecycle', `Failed to cleanup previous step skills: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _prepareCurrentStepSkills(runId: number, stepId: string, executionPath: string): Promise<void> {
    try {
      const stepBinding = await this._getTemplateStepBinding(runId, stepId);
      if (typeof stepBinding.agentId !== 'number') {
        return;
      }

      const { skillNames, executorType } = await resolveAgentSkills(stepBinding.agentId);
      if (skillNames.length === 0) {
        return;
      }

      await prepareExecutionSkills({
        executorType,
        skillNames,
        executionPath,
      });

      // Write manifest to the correct directory based on executor type
      const skillsDir = executorType === 'OPEN_CODE'
        ? resolve(executionPath, '.opencode', 'skills')
        : resolve(executionPath, '.claude', 'skills');
      await writeSkillManifest(skillsDir, {
        runId,
        stepId,
        installedSkills: skillNames,
        updatedAt: new Date().toISOString(),
      });

      logger.info('WorkflowLifecycle', `Prepared ${skillNames.length} skills for step ${stepId}: ${skillNames.join(', ')}`);
    } catch (err) {
      logger.warn('WorkflowLifecycle', `Failed to prepare step skills: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _prepareCurrentStepMcp(runId: number, stepId: string, executionPath: string): Promise<void> {
    try {
      const stepBinding = await this._getTemplateStepBinding(runId, stepId);
      if (typeof stepBinding.agentId !== 'number') {
        return;
      }

      const { executorType } = await resolveAgentSkills(stepBinding.agentId);

      // Resolve with metadata (auto_install, install_command) for pre-check
      const serversWithMeta = await resolveAgentMcpServersWithMeta(stepBinding.agentId);
      if (serversWithMeta.length === 0) {
        await cleanupMcpJson(executionPath);
        await cleanupOpenCodeMcpJson(executionPath);
        return;
      }

      // Pre-check: validate commands, auto-install if configured
      const mcpServerConfigs = await preCheckMcpServers(serversWithMeta);
      if (mcpServerConfigs.length === 0) {
        logger.warn('WorkflowLifecycle', `All MCP servers failed pre-check for step ${stepId}`);
        await cleanupMcpJson(executionPath);
        await cleanupOpenCodeMcpJson(executionPath);
        return;
      }

      await prepareExecutionMcp({
        executorType,
        mcpServerConfigs,
        executionPath,
      });

      logger.info('WorkflowLifecycle', `Prepared ${mcpServerConfigs.length} MCP servers for step ${stepId}`);
    } catch (err) {
      logger.warn('WorkflowLifecycle', `Failed to prepare step MCP config: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _finalizeCancelledStepStart(
    runId: number,
    stepId: string,
    startedAt: string,
    session: SessionEntity | null,
    segment: SessionSegmentEntity | null,
  ) {
    if (!await this._isWorkflowStepCancelled(runId, stepId)) {
      return false;
    }

    const completedAt = new Date().toISOString();
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'CANCELLED',
      started_at: startedAt,
      completed_at: completedAt,
      ...(session ? { session_id: session.id } : {}),
      summary: null,
      error: 'Workflow cancelled',
    });

    if (session) {
      await this.sessionRepo.update(session.id, {
        status: 'CANCELLED',
        completed_at: completedAt,
      });

      const attemptSegment = segment || await this._getCurrentAttemptSegment(runId, stepId, session.id);
      if (attemptSegment?.status === 'RUNNING') {
        await this.sessionSegmentRepo.update(attemptSegment.id, {
          status: 'CANCELLED',
          completed_at: completedAt,
        });
      }
    }

    return true;
  }

  private async _syncCancelledStepArtifacts(runId: number, stepId: string, completedAt: string) {
    const { step } = await this._getRunStep(runId, stepId);

    if (!step.session_id) {
      this._clearStepAttemptSegmentId(runId, stepId);
      return;
    }

    await this.sessionRepo.update(step.session_id, {
      status: 'CANCELLED',
      completed_at: completedAt,
    });

    const attemptSegment = await this._getCurrentAttemptSegment(runId, stepId, step.session_id);
    if (attemptSegment?.status === 'RUNNING') {
      await this.sessionSegmentRepo.update(attemptSegment.id, {
        status: 'CANCELLED',
        completed_at: completedAt,
      });
    }
  }

  private async _finalizeStepArtifacts(
    runId: number,
    stepId: string,
    status: 'COMPLETED' | 'FAILED' | 'CANCELLED',
    stepUpdate: { summary?: string | null; error?: string | null },
  ) {
    const completedAt = new Date().toISOString();
    const { run, step } = await this._getRunStep(runId, stepId);

    if (step.status === 'CANCELLED' || run.status === 'CANCELLED') {
      if (status !== 'CANCELLED') {
        await this._syncCancelledStepArtifacts(runId, stepId, completedAt);
      }
      return;
    }

    await this.workflowRunRepo.updateStep(runId, stepId, {
      status,
      completed_at: completedAt,
      ...stepUpdate,
    });

    if (status !== 'CANCELLED' && await this._isWorkflowStepCancelled(runId, stepId)) {
      await this._syncCancelledStepArtifacts(runId, stepId, completedAt);
      return;
    }

    if (step.session_id) {
      await this.sessionRepo.update(step.session_id, {
        status,
        completed_at: completedAt,
      });

      if (status !== 'CANCELLED' && await this._isWorkflowStepCancelled(runId, stepId)) {
        await this._syncCancelledStepArtifacts(runId, stepId, completedAt);
        return;
      }

      const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(step.session_id);
      if (latestSegment?.status === 'RUNNING' || latestSegment?.status === 'ASK_USER') {
        if (status !== 'CANCELLED' && await this._isWorkflowStepCancelled(runId, stepId)) {
          await this._syncCancelledStepArtifacts(runId, stepId, completedAt);
          return;
        }

        await this.sessionSegmentRepo.update(latestSegment.id, {
          status,
          completed_at: completedAt,
        });
      }
    }

    if (status !== 'CANCELLED') {
      this._clearStepAttemptSegmentId(runId, stepId);
    }
  }

  async onStepStart(runId: number, stepId: string, task: WorkflowTaskRecord & { execution_path: string }) {
    if (await this._isWorkflowStepCancelled(runId, stepId)) {
      return;
    }

    // Step-level skill isolation: cleanup previous step's skills, prepare current step's skills
    await this._cleanupPreviousStepSkills(task.execution_path, runId);
    await this._prepareCurrentStepSkills(runId, stepId, task.execution_path);
    await this._prepareCurrentStepMcp(runId, stepId, task.execution_path);

    const startedAt = new Date().toISOString();
    const { step } = await this._getRunStep(runId, stepId);

    let session = step.session_id ? await this.sessionRepo.findById(step.session_id) : null;
    const latestSegment = session ? await this.sessionSegmentRepo.findLatestBySessionId(session.id) : null;

    if (!session) {
      session = await this._createLogicalStepSession(runId, stepId, task);
    } else {
      await this.sessionRepo.update(session.id, {
        status: 'RUNNING',
        completed_at: null,
      });
      session = await this.sessionRepo.findById(session.id);
      if (!session) {
        throw new Error(`Workflow step session not found after update: ${stepId}`);
      }
    }

    if (await this._finalizeCancelledStepStart(runId, stepId, startedAt, session, latestSegment)) {
      return;
    }

    const attemptSegment = await this._createStepAttemptSegment(
      runId,
      stepId,
      session,
      latestSegment ? 'RETRY' : 'START',
      latestSegment?.id ?? null,
    );

    if (await this._finalizeCancelledStepStart(runId, stepId, startedAt, session, attemptSegment)) {
      return;
    }

    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'RUNNING',
      started_at: startedAt,
      completed_at: null,
      retry_count: latestSegment ? step.retry_count + 1 : step.retry_count,
      session_id: session.id,
      summary: null,
      error: null,
      assembled_prompt: null,
    });

    if (await this._isWorkflowStepCancelled(runId, stepId)) {
      await this._finalizeCancelledStepStart(runId, stepId, startedAt, session, attemptSegment);
      return;
    }

    await this.workflowRunRepo.update(runId, { current_step: stepId });

    if (await this._isWorkflowStepCancelled(runId, stepId)) {
      await this._finalizeCancelledStepStart(runId, stepId, startedAt, session, attemptSegment);
      return;
    }

    return { sessionId: session.id, segmentId: attemptSegment.id };
  }

  async onStepComplete(runId: number, stepId: string, result: Record<string, unknown>) {
    const summary = typeof result.summary === 'string' ? result.summary.trim() : '';

    await this._finalizeStepArtifacts(runId, stepId, 'COMPLETED', {
      summary: summary || null,
      error: null,
    });
  }

  async onEarlyExit(
    runId: number,
    stepId: string,
    decision: 'SUCCESS_EXIT' | 'FAIL_EXIT',
    reason: string,
  ) {
    // Update current step with early exit info
    await this.workflowRunRepo.updateStep(runId, stepId, {
      early_exit: true,
      early_exit_reason: reason,
    });

    // Cancel all PENDING steps
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) return;

    const completedAt = new Date().toISOString();
    for (const step of run.steps) {
      if (step.status === 'PENDING') {
        await this.workflowRunRepo.updateStep(runId, step.step_id, {
          status: 'CANCELLED',
          started_at: completedAt,
          completed_at: completedAt,
          summary: null,
          error: 'Skipped — previous step triggered early exit',
        });
      }
    }

    // Update workflow run status
    if (decision === 'SUCCESS_EXIT') {
      await this.workflowRunRepo.update(runId, {
        status: 'COMPLETED',
        current_step: null,
      });
      if (run.task_id) {
        await this.taskRepo.update(run.task_id, { status: 'DONE' });
      }
      await this._emitNotification('COMPLETED', runId, run.task_id, {
        currentStepId: stepId,
        earlyExitInfo: { decision: 'SUCCESS_EXIT', reason, stepId },
      });
    } else {
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
      });
      if (run.task_id) {
        await this.taskRepo.update(run.task_id, { status: 'TODO' });
      }
      await this._emitNotification('FAILED', runId, run.task_id, {
        currentStepId: stepId,
        earlyExitInfo: { decision: 'FAIL_EXIT', reason, stepId },
      });
    }
  }

  async onStepError(runId: number, stepId: string, errorMessage: string) {
    await this._finalizeStepArtifacts(runId, stepId, 'FAILED', {
      error: errorMessage || 'Step failed',
    });
  }

  async onStepSuspend(
    runId: number,
    stepId: string,
    suspendInfo: { reason: string; summary?: string; ask_user_question?: Record<string, unknown> | null },
  ) {
    const completedAt = new Date().toISOString();

    // Update step status to SUSPENDED
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'SUSPENDED',
      completed_at: completedAt,
      suspend_reason: suspendInfo.reason,
      summary: suspendInfo.summary || null,
      ask_user_question: suspendInfo.ask_user_question || null,
    });

    // Update workflow run status to SUSPENDED
    await this.workflowRunRepo.update(runId, {
      status: 'SUSPENDED',
      current_step: stepId,
    });

    // Update session status
    const { step } = await this._getRunStep(runId, stepId);
    if (step.session_id) {
      await this.sessionRepo.update(step.session_id, {
        status: 'SUSPENDED',
        completed_at: completedAt,
      });

      const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(step.session_id);
      if (latestSegment?.status === 'RUNNING') {
        await this.sessionSegmentRepo.update(latestSegment.id, {
          status: 'SUSPENDED',
          completed_at: completedAt,
        });
      }
    }

    this._clearStepAttemptSegmentId(runId, stepId);

    // Emit notification hook
    const { run: suspendRun } = await this._getRunStep(runId, stepId);
    if (suspendRun?.task_id) {
      await this._emitNotification('SUSPENDED', runId, suspendRun.task_id, {
        currentStepId: stepId,
        suspendInfo: {
          reason: suspendInfo.reason,
          ...(suspendInfo.summary != null ? { summary: suspendInfo.summary } : {}),
          ...(suspendInfo.ask_user_question != null ? { askUserQuestion: suspendInfo.ask_user_question } : {}),
        },
      });
    }
  }

  /**
   * Called when an executor encounters AskUserQuestion during a step.
   * Saves the ask_user event to session, sets session to ASK_USER,
   * and updates the workflow run and step to SUSPENDED so the Mastra workflow
   * can be resumed after server restart.
   */
  async onSessionAskUser(
    runId: number,
    stepId: string,
    data: { ask_user_question: Record<string, unknown> },
  ) {
    const { run, step } = await this._getRunStep(runId, stepId);
    const completedAt = new Date().toISOString();

    // Save ask_user event to session
    if (step.session_id) {
      const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(step.session_id);

      if (latestSegment?.status === 'RUNNING') {
        await this.sessionSegmentRepo.update(latestSegment.id, {
          status: 'ASK_USER',
          completed_at: completedAt,
        });
      }

      if (latestSegment?.id) {
        await this.sessionEventRepo.append({
          session_id: step.session_id,
          segment_id: latestSegment.id,
          kind: 'ask_user',
          role: 'assistant',
          content: '',
          payload: {
            ask_user_question: data.ask_user_question,
          },
        });
      }

      await this.sessionRepo.update(step.session_id, {
        status: 'ASK_USER',
      });
    }

    // Update step to SUSPENDED with ask_user_question data
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'SUSPENDED',
      completed_at: completedAt,
      suspend_reason: 'AI 提出了问题',
      ask_user_question: data.ask_user_question,
    });

    // Update workflow run to SUSPENDED
    await this.workflowRunRepo.update(runId, {
      status: 'SUSPENDED',
      current_step: stepId,
    });

    this._clearStepAttemptSegmentId(runId, stepId);

    // Emit notification so frontend updates immediately
    if (run?.task_id) {
      await this._emitNotification('SUSPENDED', runId, run.task_id, {
        currentStepId: stepId,
        suspendInfo: {
          reason: 'AI 提出了问题',
          askUserQuestion: data.ask_user_question,
        },
      });
    }
  }

  /**
   * Polls session status until it transitions away from ASK_USER.
   * Returns the latest user message content.
   * Used by the step function to wait for user answers without suspending the workflow.
   */
  async waitForSessionResponse(sessionId: number, abortSignal?: AbortSignal, runId?: number): Promise<string> {
    const POLL_INTERVAL_MS = 1000;
    // Stale signal: already aborted before this wait started (from a previously-cancelled run).
    // Don't treat it as a live cancellation — the retry should be allowed to proceed.
    const signalAlreadyAborted = abortSignal?.aborted ?? false;

    while (true) {
      // Only honour a fresh abort (signal flipped during this wait, not before)
      if (abortSignal?.aborted && !signalAlreadyAborted) {
        throw new Error('WORKFLOW_CANCELLED');
      }

      // When the signal is stale we fall back to a DB check so that a cancel
      // issued *during* a retry is still detected.
      if (runId !== undefined) {
        const run = await this.workflowRunRepo.findById(runId);
        if (run?.status === 'CANCELLED') {
          throw new Error('WORKFLOW_CANCELLED');
        }
      }

      const session = await this.sessionRepo.findById(sessionId);
      if (!session || session.status !== 'ASK_USER') {
        // Session is no longer ASK_USER — user has responded
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Get the latest user message from session events
    const events = await this.sessionEventRepo.listBySessionId(sessionId);
    const userMessages = events.filter(
      (e) => e.kind === 'message' && e.role === 'user',
    );
    const latestMessage = userMessages[userMessages.length - 1];
    return latestMessage?.content || '';
  }

  /**
   * Called when resuming from AskUserQuestion. Restores run/step/session/segment
   * back to RUNNING without creating a new segment or incrementing retry_count.
   */
  async onStepAskUserResume(runId: number, stepId: string) {
    const run = await this.workflowRunRepo.findById(runId);
    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING',
      context: { ...(run?.context || {}), error: null },
    });

    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'RUNNING',
      completed_at: null,
    });

    const { step } = await this._getRunStep(runId, stepId);
    if (step.session_id) {
      await this.sessionRepo.update(step.session_id, { status: 'RUNNING', completed_at: null });
      const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(step.session_id);
      if (latestSegment?.status === 'ASK_USER') {
        await this.sessionSegmentRepo.update(latestSegment.id, { status: 'RUNNING', completed_at: null });
        this._rememberStepAttemptSegmentId(runId, stepId, latestSegment.id);
      }
      return { sessionId: step.session_id, segmentId: latestSegment?.id };
    }
  }

  async onStepResume(
    runId: number,
    stepId: string,
    resumeData: { approved: boolean; comment?: string; ask_user_answer?: string },
  ) {
    await this.workflowRunRepo.updateStep(runId, stepId, {
      confirmation_note: resumeData.comment || null,
      confirmed_at: new Date().toISOString(),
      ask_user_answer: resumeData.ask_user_answer || null,
    });

    const run = await this.workflowRunRepo.findById(runId);
    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING',
      context: {
        ...(run?.context || {}),
        error: null,
        stale_mastra_run_id: null,
        stale_mastra_takeover_at: null,
      },
    });
  }

  async onStepCancel(runId: number, stepId: string) {
    const { run } = await this._getRunStep(runId, stepId);
    if (run.worktree_path) {
      await cleanupMcpJson(run.worktree_path);
      await cleanupOpenCodeMcpJson(run.worktree_path);
    }
    await this._finalizeStepArtifacts(runId, stepId, 'CANCELLED', {
      error: 'Workflow cancelled',
    });
  }

  async onUnexpectedError(runId: number, errorMessage: string) {
    const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
    if (!run) {
      return;
    }

    const step = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && candidate.status === 'RUNNING')
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING');

    if (!step) {
      return;
    }

    await this.onStepError(runId, step.step_id, errorMessage || 'Workflow failed');
  }

  async onWorkflowStart(runId: number) {
    const run = await this.workflowRunRepo.findById(runId);
    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING',
      context: {
        ...(run?.context || {}),
        error: null,
        stale_mastra_run_id: null,
        stale_mastra_takeover_at: null,
      },
    });
  }

  async onWorkflowComplete(runId: number, result: Record<string, unknown>) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) return;

    // Cleanup last step's skills (keep MCP config in worktree for subsequent use)
    if (run.worktree_path) {
      await this._cleanupPreviousStepSkills(run.worktree_path, runId);
    }

    await this.workflowRunRepo.update(runId, {
      status: 'COMPLETED',
      context: result ?? {},
      current_step: null,
    });

    if (run.task_id) {
      await this.taskRepo.update(run.task_id, { status: 'DONE' });
    }

    // Emit notification hook
    if (run.task_id) {
      await this._emitNotification('COMPLETED', runId, run.task_id);
    }
  }

  async onWorkflowError(runId: number, errorMessage: string) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) return;

    const failedStepId = run.current_step;

    // Cleanup last step's skills (keep MCP config in worktree for subsequent use)
    if (run.worktree_path) {
      await this._cleanupPreviousStepSkills(run.worktree_path, runId);
    }

    await this.workflowRunRepo.update(runId, {
      status: 'FAILED',
      context: { error: errorMessage },
      current_step: null,
    });

    if (run.task_id) {
      await this.taskRepo.update(run.task_id, { status: 'TODO' });
    }

    // Emit notification hook
    if (run.task_id) {
      await this._emitNotification('FAILED', runId, run.task_id, {
        currentStepId: failedStepId,
        errorMessage,
      });
    }
  }

}

export { WorkflowLifecycle };