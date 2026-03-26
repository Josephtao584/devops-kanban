import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
import {buildWorkflowFromTemplate, getWorkflowFromWorkflowId} from './workflows.js';
import { isSupportedExecutorType, type WorkflowTaskRecord } from '../../types/workflow.js';
import {WorkflowTemplateEntity} from "../../types/entities.js";


function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}


function toStepState(template: WorkflowTemplateEntity) {
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

type StartWorkflowOptions = {
  workflowTemplateId?: string | undefined;
  workflowTemplateSnapshot?: WorkflowTemplateEntity | undefined;
};

class WorkflowService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  workflowTemplateService: WorkflowTemplateService;
  agentRepo: AgentRepository;
  lifecycle: WorkflowLifecycle;

  async _resetTaskToTodo(taskId: number) {
    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }

  constructor({ workflowRunRepo, taskRepo, projectRepo, workflowTemplateService, agentRepo, lifecycle }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    workflowTemplateService?: WorkflowTemplateService;
    agentRepo?: AgentRepository;
    lifecycle?: WorkflowLifecycle;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowTemplateService = workflowTemplateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    this.lifecycle = lifecycle || new WorkflowLifecycle();
  }

  async startWorkflow(taskId: number, options: string | StartWorkflowOptions) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error: any = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const executionPath = await this._resolveExecutionPath(task);
    const existing = await this.workflowRunRepo.findLatestByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING')) {
      const error: any = new Error('Task already has an active workflow run');
      error.statusCode = 409;
      throw error;
    }

    const workflowTemplateId = typeof options === 'string' ? options : options.workflowTemplateId;
    const workflowTemplateSnapshot = typeof options === 'string' ? undefined : options.workflowTemplateSnapshot;

    if (!workflowTemplateSnapshot && !workflowTemplateId?.trim()) {
      throw createValidationError('workflow template id or snapshot is required');
    }

    const template = workflowTemplateSnapshot ?? await this._loadTemplate(workflowTemplateId ?? '');
    await this._validateTemplateAgents(template);

    const run = await this.workflowRunRepo.create({
      task_id: taskId,
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

  async _loadTemplate(templateId: string): Promise<WorkflowTemplateEntity> {
    const template = await this.workflowTemplateService.getTemplateById(templateId);
    if (!template) {
      throw createValidationError(`Workflow template not found: ${templateId}`);
    }
    return template;
  }

  async _validateTemplateAgents(template: WorkflowTemplateEntity) {
    for (const step of template.steps) {
      if (!Number.isFinite(step.agentId)) {
        throw createValidationError(`Step "${step.name}" has no agent assigned`);
      }

      const agent = await this.agentRepo.findById(step.agentId);
      if (!agent) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} that was not found`);
      }

      if (!agent.enabled) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} that is disabled`);
      }

      if (!isSupportedExecutorType(agent.executorType)) {
        throw createValidationError(`Step "${step.name}" references agent ${step.agentId} with unsupported executor type: ${String(agent.executorType)}`);
      }
    }
  }

  async _resolveExecutionPath(task: { project_id: number; worktree_path?: string | null }) {
    if (task.worktree_path) {
      return task.worktree_path;
    }

    const project = await this.projectRepo.findById(task.project_id);
    if (project?.local_path) {
      return project.local_path;
    }

    const error: any = new Error('No workspace path configured for workflow execution');
    error.statusCode = 400;
    throw error;
  }

  async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, workflowTemplate: WorkflowTemplateEntity) {
    try {
      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

      const workflow = buildWorkflowFromTemplate(workflowTemplate, {
        runId,
        task: { id: task.id, project_id: task.project_id, execution_path: task.execution_path },
        lifecycle: this.lifecycle
      });

      const run = await workflow.createRun({ runId: String(runId) });

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
      const error: any = new Error('Workflow run not found');
      error.statusCode = 404;
      throw error;
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      const error: any = new Error(`Cannot cancel workflow in status: ${run.status}`);
      error.statusCode = 400;
      throw error;
    }

    const workflow = getWorkflowFromWorkflowId(run.workflow_template_id);
    const reconstructedRun = await workflow.createRun({ runId: String(runId) });
    await reconstructedRun.cancel();

    // Finalize running step
    const runningStep = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && candidate.status === 'RUNNING')
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING');

    if (runningStep) {
      await this.lifecycle.onStepCancel(runId, runningStep.step_id).catch(() => {});
    }

    const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
    await this._resetTaskToTodo(run.task_id ?? 0);
    return updatedRun;
  }
}

export { WorkflowService };
