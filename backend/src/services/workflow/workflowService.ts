import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { SessionRepository } from '../../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../../repositories/sessionSegmentRepository.js';
import { buildWorkflowFromTemplate, initWorkflows } from './workflows.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
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

interface WorkflowAgentRecord {
  id: number;
  executorType: string;
  enabled: boolean;
  commandOverride?: unknown;
  args: unknown;
  env: unknown;
  skills?: unknown;
}

const SUPPORTED_EXECUTOR_TYPES: ExecutorType[] = ['CLAUDE_CODE', 'CODEX', 'OPENCODE'];

function hasDuplicateWorkflowStepIds(template: WorkflowTemplate) {
  const actualStepIds = template.steps.map((step) => step.id);
  return new Set(actualStepIds).size !== actualStepIds.length;
}

function createDuplicateWorkflowStepIdValidationError() {
  return createValidationError('Workflow template step ids must be unique');
}

function createWorkflowTemplateStepCountValidationError() {
  return createValidationError('Workflow template must include at least two steps');
}

function createUnavailableExecutorValidationMessage(stepName: string, agentId: number, executorType: ExecutorType) {
  return `Step "${stepName}" references agent ${agentId} with unavailable executor type: ${executorType}`;
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

class WorkflowService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  workflowTemplateService: WorkflowTemplateService;
  agentRepo: Pick<AgentRepository, 'findById'>;
  sessionRepo: Pick<SessionRepository, 'create' | 'findById' | 'update'>;
  sessionSegmentRepo: Pick<SessionSegmentRepository, 'create' | 'findLatestBySessionId' | 'update'>;
  lifecycle: WorkflowLifecycle;
  _activeRuns: Map<number, { run: any }>;

  async _resetTaskToTodo(taskId: number) {
    if (typeof this.taskRepo.update !== 'function' || !Number.isFinite(taskId) || taskId <= 0) {
      return;
    }

    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }

  constructor({ workflowRunRepo, taskRepo, projectRepo, workflowTemplateService, agentRepo, sessionRepo, sessionSegmentRepo, lifecycle }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    workflowTemplateService?: WorkflowTemplateService;
    agentRepo?: Pick<AgentRepository, 'findById'>;
    sessionRepo?: Pick<SessionRepository, 'create' | 'findById' | 'update'>;
    sessionSegmentRepo?: Pick<SessionSegmentRepository, 'create' | 'findLatestBySessionId' | 'update'>;
    lifecycle?: WorkflowLifecycle;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowTemplateService = workflowTemplateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    this.sessionRepo = sessionRepo || new SessionRepository();
    this.sessionSegmentRepo = sessionSegmentRepo || new SessionSegmentRepository();
    this.lifecycle = lifecycle || new WorkflowLifecycle({
      workflowRunRepo: this.workflowRunRepo,
      agentRepo: this.agentRepo,
      sessionRepo: this.sessionRepo,
      sessionSegmentRepo: this.sessionSegmentRepo,
      workflowTemplateService: this.workflowTemplateService,
    });
    this._activeRuns = new Map();
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
    const existing = await this.workflowRunRepo.findLatestByTaskId(taskId);
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
    if (!Array.isArray(template.steps) || template.steps.length < 2) {
      throw createWorkflowTemplateStepCountValidationError();
    }

    if (hasDuplicateWorkflowStepIds(template)) {
      throw createDuplicateWorkflowStepIdValidationError();
    }

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

  async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, templateSnapshot: WorkflowTemplate) {
    try {
      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

      const workflow = buildWorkflowFromTemplate(templateSnapshot, {
        runId,
        task: { id: task.id, project_id: task.project_id, execution_path: task.execution_path },
        lifecycle: this.lifecycle,
        templateSnapshot,
      });

      const run = await workflow.createRun({ runId: String(runId) });
      this._activeRuns.set(runId, { run });

      const output = run.stream({
        inputData: {
          taskId: task.id,
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
        },
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
        },
      });

      for await (const event of output.fullStream) {
        if (event.type === 'workflow-step-result') {
          const stepId = event.payload?.id;
          const result = event.payload?.output ?? {};
          if (stepId) {
            await this.lifecycle.onStepComplete(runId, stepId, normalizeStepResult(result));
          }
        }
      }

      const result = await output.result;

      if (result.status === 'success') {
        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: result.result ?? {},
          current_step: null,
        });
        await this.taskRepo.update(task.id, { status: 'DONE' });
      } else if (result.status === 'failed' || result.status === 'tripwire') {
        await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
        await this._resetTaskToTodo(task.id);
      } else {
        await this.workflowRunRepo.update(runId, {
          status: 'FAILED',
          context: { error: 'Workflow failed' },
          current_step: null,
        });
        await this._resetTaskToTodo(task.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.lifecycle.onUnexpectedError(runId, errorMessage).catch(() => {});
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: { error: errorMessage },
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

    // Cancel via in-memory run reference (sends AbortSignal to running step)
    const activeRun = this._activeRuns.get(runId);
    if (activeRun?.run) {
      await activeRun.run.cancel();
    } else {
      // Fallback: reconstruct from storage (handles edge cases where
      // _activeRuns entry was cleaned up but run is still marked RUNNING)
      const template = (run.workflow_template_snapshot as WorkflowTemplate | null)
        ?? await this._loadTemplate(run.workflow_template_id ?? undefined);
      const workflow = buildWorkflowFromTemplate(template);
      const reconstructedRun = await workflow.createRun({ runId: String(runId) });
      await reconstructedRun.cancel();
    }

    // Finalize running step
    const runningStep = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && candidate.status === 'RUNNING')
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING');

    if (runningStep) {
      await this.lifecycle.onStepCancel(runId, runningStep.step_id).catch(() => {});
    }

    const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
    await this._resetTaskToTodo((run as { task_id?: number }).task_id ?? 0);
    return updatedRun;
  }
}

export { WorkflowService };
