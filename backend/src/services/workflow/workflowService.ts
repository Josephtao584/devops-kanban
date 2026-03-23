import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { getDevWorkflow, buildWorkflowSharedState } from './workflows.js';
import { runWithWorkflowExecutionContext } from './workflowExecutionContext.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import type { ExecutorProcessHandle, ExecutorType } from '../../types/executors.js';

const STEP_DEFINITIONS = [
  { step_id: 'requirement-design', name: '需求设计' },
  { step_id: 'code-development', name: '代码开发' },
  { step_id: 'testing', name: '测试' },
  { step_id: 'code-review', name: '代码审查' },
] as const;

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

interface WorkflowTemplateStepBinding {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
}

interface WorkflowTemplateRecord {
  template_id: string;
  name: string;
  steps: WorkflowTemplateStepBinding[];
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

interface WorkflowStreamEvent {
  type: string;
  payload?: {
    stepName?: string;
    result?: Record<string, unknown>;
    error?: string;
  };
}

interface WorkflowRunResult {
  status: string;
  result?: Record<string, unknown>;
  error?: string;
}

interface WorkflowStreamHandle {
  fullStream: AsyncIterable<WorkflowStreamEvent>;
  result: Promise<WorkflowRunResult>;
}

const SUPPORTED_EXECUTOR_TYPES: ExecutorType[] = ['CLAUDE_CODE', 'CODEX', 'OPENCODE'];

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

class WorkflowService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  workflowTemplateService: WorkflowTemplateService;
  agentRepo: Pick<AgentRepository, 'findById'>;
  _activeRuns: Map<number, ActiveRunContext>;

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

  async startWorkflow(taskId: number) {
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

    const template = await this._loadTemplate();
    await this._validateTemplateAgents(template);

    const steps = STEP_DEFINITIONS.map((def) => ({
      step_id: def.step_id,
      name: def.name,
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      retry_count: 0,
      output: null,
      error: null,
    }));

    const run = await this.workflowRunRepo.create({
      task_id: taskId,
      workflow_id: 'dev-workflow-v1',
      status: 'PENDING',
      current_step: null,
      steps,
      worktree_path: executionPath,
      branch: task.worktree_branch || `task/${taskId}`,
      context: {},
    });

    await this.taskRepo.update(taskId, { workflow_run_id: run.id });
    this._executeWorkflow(run.id, { ...task, execution_path: executionPath }).catch((err) => {
      console.error(`[Workflow] Fatal error in workflow run #${run.id}:`, err);
    });

    return run;
  }

  async _loadTemplate() {
    return await this.workflowTemplateService.getTemplate() as WorkflowTemplateRecord;
  }

  async _validateTemplateAgents(template: WorkflowTemplateRecord) {
    const expectedStepIds = STEP_DEFINITIONS.map((step) => step.step_id);
    const actualStepIds = template.steps.map((step) => step.id);
    const hasExpectedStructure = actualStepIds.length === expectedStepIds.length
      && new Set(actualStepIds).size === expectedStepIds.length
      && expectedStepIds.every((stepId, index) => actualStepIds[index] === stepId);

    if (!hasExpectedStructure) {
      throw createValidationError('Workflow template steps do not match the workflow definition');
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

  _buildInitialWorkflowState(task: Pick<WorkflowTaskRecord, 'title' | 'description'> & { execution_path: string }) {
    return buildWorkflowSharedState({
      taskTitle: task.title || 'Untitled Task',
      taskDescription: task.description || '',
      worktreePath: task.execution_path,
    });
  }

  async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }) {
    this._activeRuns.set(runId, {
      cancel: () => {},
    });

    try {
      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });
      const workflow = getDevWorkflow();
      const inputData = {
        taskId: task.id,
        taskTitle: task.title || 'Untitled Task',
        taskDescription: task.description || '',
        worktreePath: task.execution_path,
      };
      const initialState = this._buildInitialWorkflowState(task);

      const context: WorkflowExecutionContext = {
        cancelled: false,
        proc: null,
        worktreePath: inputData.worktreePath,
      };

      this._activeRuns.set(runId, {
        cancel: () => {
          context.cancelled = true;
        },
        proc: null,
        context,
      });

      const mastraRun = await workflow.createRun();
      const stream = await runWithWorkflowExecutionContext(context, async () => mastraRun.stream({ inputData, initialState })) as WorkflowStreamHandle;

      for await (const event of stream.fullStream) {
        if (event.type === 'workflow-step-start' && event.payload?.stepName) {
          const stepId = event.payload.stepName;
          await this.workflowRunRepo.updateStep(runId, stepId, {
            status: 'RUNNING',
            started_at: new Date().toISOString(),
          });
          await this.workflowRunRepo.update(runId, { current_step: stepId });
        }

        if (event.type === 'workflow-step-result' && event.payload?.stepName) {
          const stepId = event.payload.stepName;
          const activeRun = this._activeRuns.get(runId);
          if (activeRun && activeRun.context?.proc) {
            activeRun.proc = activeRun.context.proc;
          }
          await this.workflowRunRepo.updateStep(runId, stepId, {
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
            output: event.payload.result || null,
          });
        }

        if (event.type === 'workflow-step-error' && event.payload?.stepName) {
          const stepId = event.payload.stepName;
          await this.workflowRunRepo.updateStep(runId, stepId, {
            status: 'FAILED',
            completed_at: new Date().toISOString(),
            error: event.payload.error || 'Step failed',
          });
        }
      }

      const result = await stream.result;
      if (result.status === 'success') {
        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: result.result || {},
        });
        await this.taskRepo.update(task.id, { status: 'DONE' });
      } else {
        await this.workflowRunRepo.update(runId, {
          status: 'FAILED',
          context: { error: result.error || 'Workflow failed' },
        });
      }
    } catch (err) {
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: { error: (err as Error).message },
      }).catch(() => {});
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

    return await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
  }
}

export { WorkflowService };
