import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { executeWorkflowStep } from './workflowStepExecutor.js';
import { runWithWorkflowExecutionContext } from './workflowExecutionContext.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import type { WorkflowTemplate } from './workflowTemplateService.js';
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
    output: null,
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
  _activeRuns: Map<number, ActiveRunContext>;

  async _resetTaskToTodo(taskId: number) {
    if (typeof this.taskRepo.update !== 'function' || !Number.isFinite(taskId) || taskId <= 0) {
      return;
    }

    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }


  constructor({ workflowRunRepo, taskRepo, projectRepo, workflowTemplateService, agentRepo }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    workflowTemplateService?: WorkflowTemplateService;
    agentRepo?: Pick<AgentRepository, 'findById'>;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowTemplateService = workflowTemplateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    this._activeRuns = new Map();
  }

  async startWorkflow(taskId: number, workflowTemplateId?: string) {
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

    const template = await this._loadTemplate(workflowTemplateId);
    await this._validateTemplateAgents(template);

    const run = await this.workflowRunRepo.create({
      task_id: taskId,
      workflow_id: template.template_id,
      workflow_template_id: template.template_id,
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

  async _loadTemplate(templateId?: string): Promise<WorkflowTemplate> {
    if (templateId !== undefined) {
      if (typeof templateId !== 'string' || templateId.trim().length === 0) {
        throw createValidationError('Workflow template id must be a non-empty string');
      }

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
      if (context?.cancelled) {
        return {
          status: 'cancelled',
          error: 'Workflow cancelled',
        };
      }

      await this.workflowRunRepo.updateStep(runId, step.id, {
        status: 'RUNNING',
        started_at: new Date().toISOString(),
      });
      await this.workflowRunRepo.update(runId, { current_step: step.id });

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

        await this.workflowRunRepo.updateStep(runId, step.id, {
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          output: normalizedResult,
          error: null,
        });

        inputData = normalizedResult;
        previousStepId = step.id;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.workflowRunRepo.updateStep(runId, step.id, {
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          error: message,
        });

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

  async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, templateSnapshot: WorkflowTemplate) {
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

      const result = await this._runWorkflowTemplate({
        runId,
        task,
        templateSnapshot,
        context,
      });

      if (cancellationRequested || isContextCancelled(context) || result.status === 'cancelled') {
        await this.workflowRunRepo.update(runId, {
          status: 'CANCELLED',
          context: getWorkflowCancelledContext(result.error),
          current_step: null,
        });
        await this._resetTaskToTodo(task.id);
        return;
      }

      if (result.status === 'success') {
        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: result.result || {},
          current_step: null,
        });
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

      if (cancellationRequested || isContextCancelled(context)) {
        await this.workflowRunRepo.update(runId, {
          status: 'CANCELLED',
          context: getWorkflowCancelledContext(errorMessage),
          current_step: null,
        }).catch(() => {});
        await this._resetTaskToTodo(task.id);
        return;
      }

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
    const run = await this.workflowRunRepo.findById(runId);
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

    const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
    await this._resetTaskToTodo((run as { task_id?: number }).task_id ?? 0);
    return updatedRun;
  }
}

export { WorkflowService };
