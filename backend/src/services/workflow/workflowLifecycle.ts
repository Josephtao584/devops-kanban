import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { SessionRepository } from '../../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../../repositories/sessionSegmentRepository.js';
import { SessionEventRepository } from '../../repositories/sessionEventRepository.js';
import type { SessionEntity, SessionSegmentEntity, WorkflowRunEntity } from '../../types/entities.ts';
import { isSupportedExecutorType, type WorkflowTaskRecord } from '../../types/workflow.js';

class WorkflowLifecycle {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  agentRepo: AgentRepository;
  sessionRepo: SessionRepository;
  sessionSegmentRepo: SessionSegmentRepository;
  sessionEventRepo: SessionEventRepository;
  _stepAttemptSegmentIds: Map<string, number | null>;

  constructor({
    workflowRunRepo,
    taskRepo,
    agentRepo,
    sessionRepo,
    sessionSegmentRepo,
    sessionEventRepo,
  }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    agentRepo?: AgentRepository;
    sessionRepo?: SessionRepository;
    sessionSegmentRepo?: SessionSegmentRepository;
    sessionEventRepo?: SessionEventRepository;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.agentRepo = agentRepo || new AgentRepository();
    this.sessionRepo = sessionRepo || new SessionRepository();
    this.sessionSegmentRepo = sessionSegmentRepo || new SessionSegmentRepository();
    this.sessionEventRepo = sessionEventRepo || new SessionEventRepository();
    this._stepAttemptSegmentIds = new Map();
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

    const template = run.workflow_template_snapshot;
    if (!template) {
      throw new Error(`Workflow template not found for run: ${runId}`);
    }
    const stepBinding = template.steps.find((candidate) => candidate.id === stepId) || null;
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
    if (!agent || !isSupportedExecutorType(agent.executorType)) {
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
      executor_type: session.executor_type || 'CLAUDE_CODE',
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
      if (latestSegment?.status === 'RUNNING') {
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

  async onStepError(runId: number, stepId: string, errorMessage: string) {
    await this._finalizeStepArtifacts(runId, stepId, 'FAILED', {
      error: errorMessage || 'Step failed',
    });
  }

  async onStepSuspend(
    runId: number,
    stepId: string,
    suspendInfo: { reason: string; summary?: string },
  ) {
    const completedAt = new Date().toISOString();

    // Update step status to SUSPENDED
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'SUSPENDED',
      completed_at: completedAt,
      suspend_reason: suspendInfo.reason,
      summary: suspendInfo.summary || null,
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
  }

  async onStepResume(
    runId: number,
    stepId: string,
    resumeData: { approved: boolean; comment?: string },
  ) {
    await this.workflowRunRepo.updateStep(runId, stepId, {
      confirmation_note: resumeData.comment || null,
      confirmed_at: new Date().toISOString(),
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

    await this.workflowRunRepo.update(runId, {
      status: 'COMPLETED',
      context: result ?? {},
      current_step: null,
    });

    if (run.task_id) {
      await this.taskRepo.update(run.task_id, { status: 'DONE' });
    }
  }

  async onWorkflowError(runId: number, errorMessage: string) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) return;

    await this.workflowRunRepo.update(runId, {
      status: 'FAILED',
      context: { error: errorMessage },
      current_step: null,
    });

    if (run.task_id) {
      await this.taskRepo.update(run.task_id, { status: 'TODO' });
    }
  }

}

export { WorkflowLifecycle };