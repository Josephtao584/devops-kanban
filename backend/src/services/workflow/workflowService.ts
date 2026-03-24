import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { SessionRepository } from '../../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../../repositories/sessionSegmentRepository.js';
import { executeWorkflowStep } from './workflowStepExecutor.js';
import { runWithWorkflowExecutionContext } from './workflowExecutionContext.js';
import { WorkflowTemplateService, normalizeTemplate } from './workflowTemplateService.js';
import type { WorkflowTemplate } from './workflowTemplateService.js';
import type { SessionEntity, SessionSegmentEntity, WorkflowRunEntity, WorkflowStepEntity } from '../../types/entities.ts';
import type { ExecutorProcessHandle, ExecutorType } from '../../types/executors.js';

interface WorkflowTaskRecord {
  id: number;
  project_id: number;
  title?: string;
  description?: string;
  worktree_path?: string | null;
  worktree_branch?: string | null;
}

interface WorkflowExecutionContext {
  cancelled?: boolean;
  proc?: ExecutorProcessHandle | null;
  worktreePath?: string;
}

interface WorkflowAgentRecord {
  id: number;
  executorType: string;
  enabled: boolean;
  commandOverride?: unknown;
  args: unknown;
  env: unknown;
  skills?: unknown;
}

interface ActiveRunContext {
  cancel?: () => void;
  proc?: ExecutorProcessHandle | null;
  context?: WorkflowExecutionContext;
}

interface WorkflowRunResult {
  status: 'success' | 'failed' | 'cancelled';
  result?: Record<string, unknown>;
  error?: string;
}

interface RunWorkflowTemplateArgs {
  runId: number;
  task: WorkflowTaskRecord & { execution_path: string };
  templateSnapshot: WorkflowTemplate;
  context?: WorkflowExecutionContext;
}

const SUPPORTED_EXECUTOR_TYPES: ExecutorType[] = ['CLAUDE_CODE', 'CODEX', 'OPENCODE'];
const DEFAULT_RUNTIME_AVAILABLE_EXECUTOR_TYPES: ExecutorType[] = ['CLAUDE_CODE'];

function isDefaultRuntimeAvailableExecutorType(value: ExecutorType) {
  return DEFAULT_RUNTIME_AVAILABLE_EXECUTOR_TYPES.includes(value);
}

function createUnavailableExecutorValidationMessage(stepName: string, agentId: number, executorType: ExecutorType) {
  return `Step "${stepName}" references agent ${agentId} with unavailable executor type: ${executorType}`;
}

function createWorkflowContextError(message: string) {
  return { error: message };
}

function isContextCancelled(context?: WorkflowExecutionContext) {
  return context?.cancelled === true;
}

function assertExecutorAvailableInDefaultRuntime(stepName: string, agent: WorkflowAgentRecord) {
  if (isSupportedExecutorType(agent.executorType) && !isDefaultRuntimeAvailableExecutorType(agent.executorType)) {
    throw createValidationError(createUnavailableExecutorValidationMessage(stepName, agent.id, agent.executorType));
  }
}

function getWorkflowCancelledContext(resultError?: string) {
  return createWorkflowContextError(resultError || 'Workflow cancelled');
}

function getWorkflowFailedContext(resultError?: string) {
  return createWorkflowContextError(resultError || 'Workflow failed');
}

function getWorkflowErrorContext(errorMessage: string) {
  return createWorkflowContextError(errorMessage);
}

function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function isSupportedExecutorType(value: unknown): value is ExecutorType {
  return typeof value === 'string' && SUPPORTED_EXECUTOR_TYPES.includes(value as ExecutorType);
}

function getInvalidAgentConfigReason(agent: WorkflowAgentRecord): string | null {
  if (agent.commandOverride != null && (typeof agent.commandOverride !== 'string' || agent.commandOverride.trim().length === 0)) {
    return 'commandOverride must be null, undefined, or a non-empty string';
  }

  if (!Array.isArray(agent.args) || agent.args.some((arg) => typeof arg !== 'string')) {
    return 'args must be an array of strings';
  }

  if (agent.env == null || typeof agent.env !== 'object' || Array.isArray(agent.env) || Object.values(agent.env).some((value) => typeof value !== 'string')) {
    return 'env must be a string map';
  }

  if (!Array.isArray(agent.skills) || agent.skills.some((skill) => typeof skill !== 'string')) {
    return 'skills must be an array of strings';
  }

  return null;
}

function toStepState(template: WorkflowTemplate) {
  return template.steps.map((step) => ({
    step_id: step.id,
    name: step.name,
    status: 'PENDING',
    started_at: null,
    completed_at: null,
    retry_count: 0,
    session_id: null,
    summary: null,
    error: null,
  }));
}

function normalizeStepResult(result: unknown): Record<string, unknown> {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }

  return {
    summary: typeof result === 'string' ? result : JSON.stringify(result ?? null),
  };
}

function buildWorkflowSharedState({
  taskTitle,
  taskDescription,
  worktreePath,
}: {
  taskTitle: string;
  taskDescription: string;
  worktreePath: string;
}) {
  return {
    taskTitle,
    taskDescription,
    worktreePath,
  };
}

class WorkflowService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  workflowTemplateService: WorkflowTemplateService;
  agentRepo: Pick<AgentRepository, 'findById'>;
  sessionRepo: Pick<SessionRepository, 'create' | 'findById' | 'update'>;
  sessionSegmentRepo: Pick<SessionSegmentRepository, 'create' | 'findLatestBySessionId' | 'update'>;
  _activeRuns: Map<number, ActiveRunContext>;
  _stepAttemptSegmentIds: Map<string, number | null>;

  async _resetTaskToTodo(taskId: number) {
    if (typeof this.taskRepo.update !== 'function' || !Number.isFinite(taskId) || taskId <= 0) {
      return;
    }

    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }

  constructor({ workflowRunRepo, taskRepo, projectRepo, workflowTemplateService, agentRepo, sessionRepo, sessionSegmentRepo }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    workflowTemplateService?: WorkflowTemplateService;
    agentRepo?: Pick<AgentRepository, 'findById'>;
    sessionRepo?: Pick<SessionRepository, 'create' | 'findById' | 'update'>;
    sessionSegmentRepo?: Pick<SessionSegmentRepository, 'create' | 'findLatestBySessionId' | 'update'>;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowTemplateService = workflowTemplateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    this.sessionRepo = sessionRepo || new SessionRepository();
    this.sessionSegmentRepo = sessionSegmentRepo || new SessionSegmentRepository();
    this._activeRuns = new Map();
    this._stepAttemptSegmentIds = new Map();
  }

  async startWorkflow(taskId: number, workflowTemplateId?: string, workflowTemplateSnapshot?: WorkflowTemplate) {
    if (workflowTemplateId !== undefined && (typeof workflowTemplateId !== 'string' || workflowTemplateId.trim().length === 0)) {
      throw createValidationError('Workflow template id must be a non-empty string');
    }

    const task = await this.taskRepo.findById(taskId) as WorkflowTaskRecord | null;
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const executionPath = await this._resolveExecutionPath(task);
    const existing = await this.workflowRunRepo.findByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING')) {
      const error = new Error('Task already has an active workflow run') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    const template = await this._loadTemplate(workflowTemplateId, workflowTemplateSnapshot);
    await this._validateTemplateAgents(template);

    const run = await this.workflowRunRepo.create({
      task_id: taskId,
      workflow_id: template.template_id,
      workflow_template_id: workflowTemplateId?.trim() || template.template_id,
      workflow_template_snapshot: template,
      status: 'PENDING',
      current_step: null,
      steps: toStepState(template),
      worktree_path: executionPath,
      branch: task.worktree_branch || `task/${taskId}`,
      context: {},
    });

    await this.taskRepo.update(taskId, { workflow_run_id: run.id });
    this._executeWorkflow(run.id, { ...task, execution_path: executionPath }, template).catch((err) => {
      console.error(`[Workflow] Fatal error in workflow run #${run.id}:`, err);
    });

    return run;
  }

  async _loadTemplate(templateId?: string, templateSnapshot?: WorkflowTemplate): Promise<WorkflowTemplate> {
    if (templateSnapshot !== undefined) {
      return normalizeTemplate(templateSnapshot);
    }

    if (templateId !== undefined) {
      const normalizedTemplateId = templateId.trim();
      const selectedTemplate = await this.workflowTemplateService.getTemplateById(normalizedTemplateId);
      if (!selectedTemplate) {
        throw createValidationError(`Workflow template not found: ${normalizedTemplateId}`);
      }
      return selectedTemplate;
    }

    if (typeof this.workflowTemplateService.getTemplate === 'function') {
      return await this.workflowTemplateService.getTemplate();
    }

    const defaultTemplate = await this.workflowTemplateService.getTemplateById('dev-workflow-v1');
    if (!defaultTemplate) {
      throw createValidationError('Workflow template not found: dev-workflow-v1');
    }
    return defaultTemplate;
  }

  async _validateTemplateAgents(template: WorkflowTemplate) {
    for (const step of template.steps) {
      if (typeof step.agentId !== 'number' || !Number.isFinite(step.agentId)) {
        throw createValidationError(`Step "${step.name}" has no agent assigned`);
      }

      const agent = await this.agentRepo.findById(step.agentId) as WorkflowAgentRecord | null;
      if (!agent) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} that was not found`);
      }

      if (!agent.enabled) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} that is disabled`);
      }

      if (!isSupportedExecutorType(agent.executorType)) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} with unsupported executor type: ${String(agent.executorType)}`);
      }

      assertExecutorAvailableInDefaultRuntime(step.name, agent);

      const invalidConfigReason = getInvalidAgentConfigReason(agent);
      if (invalidConfigReason) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} with invalid executor configuration: ${invalidConfigReason}`);
      }
    }
  }

  async _resolveExecutionPath(task: Pick<WorkflowTaskRecord, 'project_id' | 'worktree_path'>) {
    if (task.worktree_path) {
      return task.worktree_path;
    }

    const project = await this.projectRepo.findById(task.project_id);
    if (project?.local_path) {
      return project.local_path as string;
    }

    const error = new Error('No workspace path configured for workflow execution') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  _buildInitialWorkflowState(task: Pick<WorkflowTaskRecord, 'title' | 'description'> & { execution_path: string }) {
    return buildWorkflowSharedState({
      taskTitle: task.title || 'Untitled Task',
      taskDescription: task.description || '',
      worktreePath: task.execution_path,
    });
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
    const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    const step = (run.steps || []).find((candidate) => candidate.step_id === stepId) as WorkflowStepEntity | null;
    if (!step) {
      throw new Error(`Workflow step not found: ${stepId}`);
    }

    return { run, step };
  }

  private async _getTemplateStepBinding(runId: number, stepId: string) {
    const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    const template = (run.workflow_template_snapshot as WorkflowTemplate | null) ?? await this._loadTemplate(run.workflow_template_id ?? undefined);
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

    const agent = await this.agentRepo.findById(stepBinding.agentId) as WorkflowAgentRecord | null;
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
    } as Omit<SessionEntity, 'id'>);
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
      executor_type: (session.executor_type || 'CLAUDE_CODE') as SessionSegmentEntity['executor_type'],
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

  private async _isWorkflowRunCancelled(runId: number) {
    const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
    return run?.status === 'CANCELLED';
  }

  private async _isWorkflowStepCancelled(runId: number, stepId: string) {
    const { run, step } = await this._getRunStep(runId, stepId);
    return run.status === 'CANCELLED' || step.status === 'CANCELLED';
  }

  private async _shouldSkipWorkflowSuccessFinalization(runId: number, context: WorkflowExecutionContext) {
    return context.cancelled === true || await this._isWorkflowRunCancelled(runId);
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

  async _handleWorkflowStepStart(runId: number, stepId: string, task: WorkflowTaskRecord & { execution_path: string }) {
    if (await this._isWorkflowStepCancelled(runId, stepId)) {
      return;
    }

    const startedAt = new Date().toISOString();
    const { step } = await this._getRunStep(runId, stepId);

    let session = step.session_id ? await this.sessionRepo.findById(step.session_id) as SessionEntity | null : null;
    const latestSegment = session ? await this.sessionSegmentRepo.findLatestBySessionId(session.id) : null;

    if (!session) {
      session = await this._createLogicalStepSession(runId, stepId, task);
    } else {
      await this.sessionRepo.update(session.id, {
        status: 'RUNNING',
        completed_at: null,
      });
      session = await this.sessionRepo.findById(session.id) as SessionEntity | null;
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
    }
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
    stepUpdate: Partial<Pick<WorkflowStepEntity, 'summary' | 'error'>>,
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

  async _handleWorkflowStepCompletion(runId: number, stepId: string, result: Record<string, unknown>) {
    const summary = typeof result.summary === 'string' ? result.summary.trim() : '';

    await this._finalizeStepArtifacts(runId, stepId, 'COMPLETED', {
      summary: summary || null,
      error: null,
    });
  }

  async _handleWorkflowStepFailure(runId: number, stepId: string, errorMessage: string) {
    await this._finalizeStepArtifacts(runId, stepId, 'FAILED', {
      error: errorMessage || 'Step failed',
    });
  }

  async _handleWorkflowStepCancellation(runId: number, stepId: string) {
    await this._finalizeStepArtifacts(runId, stepId, 'CANCELLED', {
      error: 'Workflow cancelled',
    });
  }

  async _finalizeRunningStepAfterUnexpectedError(runId: number, errorMessage: string) {
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

    await this._handleWorkflowStepFailure(runId, step.step_id, errorMessage || 'Workflow failed');
  }

  async _runWorkflowTemplate({ runId, task, templateSnapshot, context }: RunWorkflowTemplateArgs): Promise<WorkflowRunResult> {
    const state = this._buildInitialWorkflowState(task);
    let inputData: Record<string, unknown> = {
      taskId: task.id,
      taskTitle: task.title || 'Untitled Task',
      taskDescription: task.description || '',
      worktreePath: task.execution_path,
    };
    let previousStepId: string | null = null;

    for (const step of templateSnapshot.steps) {
      if (context?.cancelled || await this._isWorkflowRunCancelled(runId).catch(() => false)) {
        await this._handleWorkflowStepCancellation(runId, step.id).catch(() => {});
        return {
          status: 'cancelled',
          error: 'Workflow cancelled',
        };
      }

      await this._handleWorkflowStepStart(runId, step.id, task);

      try {
        const stepResult = await runWithWorkflowExecutionContext(context || {}, async () => await executeWorkflowStep({
          ...(context ? { context } : {}),
          stepId: step.id,
          templateSnapshot,
          worktreePath: task.execution_path,
          state,
          inputData,
          upstreamStepIds: previousStepId ? [previousStepId] : [],
        }));

        const normalizedResult = normalizeStepResult(stepResult);
        if (context) {
          const activeRun = this._activeRuns.get(runId);
          if (activeRun) {
            activeRun.proc = context.proc ?? null;
          }
        }

        if (await this._isWorkflowStepCancelled(runId, step.id).catch(() => false)) {
          await this._handleWorkflowStepCancellation(runId, step.id).catch(() => {});
          return {
            status: 'cancelled',
            error: 'Workflow cancelled',
          };
        }

        await this._handleWorkflowStepCompletion(runId, step.id, normalizedResult);
        inputData = normalizedResult;
        previousStepId = step.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (context?.cancelled || await this._isWorkflowRunCancelled(runId).catch(() => false) || await this._isWorkflowStepCancelled(runId, step.id).catch(() => false)) {
          await this._handleWorkflowStepCancellation(runId, step.id).catch(() => {});
          return {
            status: 'cancelled',
            error: 'Workflow cancelled',
          };
        }

        await this._handleWorkflowStepFailure(runId, step.id, message).catch(() => {});
        return {
          status: 'failed',
          error: message,
        };
      }
    }

    return {
      status: 'success',
      result: inputData,
    };
  }

  async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, templateSnapshot?: WorkflowTemplate) {
    let context: WorkflowExecutionContext | undefined;
    let cancellationRequested = false;
    const requestCancellation = () => {
      cancellationRequested = true;
      if (context) {
        context.cancelled = true;
      }
    };

    this._activeRuns.set(runId, {
      cancel: requestCancellation,
    });

    try {
      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

      context = {
        cancelled: cancellationRequested,
        proc: null,
        worktreePath: task.execution_path,
      };

      this._activeRuns.set(runId, {
        cancel: requestCancellation,
        proc: null,
        context,
      });

      const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
      const effectiveTemplate = templateSnapshot ?? (run?.workflow_template_snapshot as WorkflowTemplate | null) ?? await this._loadTemplate(run?.workflow_template_id ?? undefined);

      const result = await this._runWorkflowTemplate({
        runId,
        task,
        templateSnapshot: effectiveTemplate,
        context,
      });

      if (cancellationRequested || isContextCancelled(context) || result.status === 'cancelled' || await this._isWorkflowRunCancelled(runId).catch(() => false)) {
        await this.workflowRunRepo.update(runId, {
          status: 'CANCELLED',
          context: getWorkflowCancelledContext(result.error),
          current_step: null,
        });
        await this._resetTaskToTodo(task.id);
        return;
      }

      if (result.status === 'success') {
        if (await this._shouldSkipWorkflowSuccessFinalization(runId, context)) {
          return;
        }

        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: result.result || {},
          current_step: null,
        });

        if (await this._shouldSkipWorkflowSuccessFinalization(runId, context)) {
          return;
        }

        await this.taskRepo.update(task.id, { status: 'DONE' });
        return;
      }

      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: getWorkflowFailedContext(result.error),
        current_step: null,
      });
      await this._resetTaskToTodo(task.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (cancellationRequested || isContextCancelled(context) || await this._isWorkflowRunCancelled(runId).catch(() => false)) {
        await this.workflowRunRepo.update(runId, {
          status: 'CANCELLED',
          context: getWorkflowCancelledContext(errorMessage),
          current_step: null,
        }).catch(() => {});
        await this._resetTaskToTodo(task.id);
        return;
      }

      await this._finalizeRunningStepAfterUnexpectedError(runId, errorMessage).catch(() => {});
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: getWorkflowErrorContext(errorMessage),
        current_step: null,
      }).catch(() => {});
      await this._resetTaskToTodo(task.id);
    } finally {
      this._activeRuns.delete(runId);
    }
  }

  async getWorkflowRun(runId: number) {
    return await this.workflowRunRepo.findById(runId);
  }

  async getWorkflowRunByTask(taskId: number) {
    return await this.workflowRunRepo.findByTaskId(taskId);
  }

  async getAllRunsByTask(taskId: number) {
    return await this.workflowRunRepo.findAllByTaskId(taskId);
  }

  async cancelWorkflow(runId: number) {
    const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
    if (!run) {
      const error = new Error('Workflow run not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      const error = new Error(`Cannot cancel workflow in status: ${run.status}`) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const activeRun = this._activeRuns.get(runId);
    if (activeRun) {
      activeRun.cancel?.();
      activeRun.proc?.kill?.('SIGTERM');
      activeRun.context?.proc?.kill?.('SIGTERM');
    }

    const runningStep = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && candidate.status === 'RUNNING')
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING');

    if (runningStep) {
      await this._handleWorkflowStepCancellation(runId, runningStep.step_id).catch(() => {});
    }

    const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
    await this._resetTaskToTodo((run as { task_id?: number }).task_id ?? 0);
    return updatedRun;
  }
}

export { WorkflowService };
