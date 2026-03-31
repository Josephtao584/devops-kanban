import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
import { buildWorkflowFromTemplate, getWorkflowFromWorkflowId } from './workflows.js';
import { isSupportedExecutorType, type WorkflowTaskRecord } from '../../types/workflow.js';
import {WorkflowTemplateEntity} from "../../types/entities.js";
import { resolveWorkflowSkills } from './workflowSkillSync.js';
import { prepareExecutionSkills } from './executorSkillPreparation.js';


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
    resolveWorkflowSkillsFn?: typeof resolveWorkflowSkills;
    prepareExecutionSkillsFn?: typeof prepareExecutionSkills;
    workflowBuilder?: typeof buildWorkflowFromTemplate;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.workflowTemplateService = workflowTemplateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    this.lifecycle = lifecycle || new WorkflowLifecycle({ workflowRunRepo: this.workflowRunRepo, taskRepo: this.taskRepo });
  }

  async startWorkflow(taskId: number, options: StartWorkflowOptions) {
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

    const workflowTemplateId = options.workflowTemplateId;
    const workflowTemplateSnapshot = options.workflowTemplateSnapshot;

    if (!workflowTemplateSnapshot && !workflowTemplateId?.trim()) {
      throw createValidationError('workflow template id or snapshot is required');
    }

    const template = workflowTemplateSnapshot ?? await this._loadTemplate(workflowTemplateId ?? '');
    await this._validateTemplateAgents(template);

    const run = await this.workflowRunRepo.create({
      task_id: taskId,
      workflow_template_id: workflowTemplateId?.trim() || template.template_id,
      workflow_template_snapshot: template,
      mastra_run_id: null,
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
      const skillNames = await resolveWorkflowSkills(workflowTemplate);
      await prepareExecutionSkills({
        executorType: 'CLAUDE_CODE',
        skillNames,
        executionPath: task.execution_path,
      });

      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

      const workflow = buildWorkflowFromTemplate(workflowTemplate, {
        runId,
        task: { id: task.id, project_id: task.project_id, execution_path: task.execution_path },
        lifecycle: this.lifecycle
      });

      // Let Mastra generate its own runId
      const mastraRun = await workflow.createRun();
      const mastraRunId = mastraRun.runId;

      // Store the mastra_run_id for later retrieval
      await this.workflowRunRepo.update(runId, { mastra_run_id: mastraRunId, status: 'RUNNING' });
      console.log(`[WorkflowService] Created Mastra run ${mastraRunId} for workflowRun ${runId}`);

      // Notify workflow start
      await this.lifecycle.onWorkflowStart(runId);

      // Fire-and-forget: start async without blocking
      await mastraRun.startAsync({
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

      // Workflow lifecycle callbacks (onFinish/onError) handle final state updates
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.lifecycle.onUnexpectedError(runId, errorMessage).catch(() => {});
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: { error: errorMessage },
        current_step: null,
      }).catch(() => {});
      await this._resetTaskToTodo(task.id);
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
    console.log(`[WorkflowService] cancelWorkflow called for runId: ${runId}`);

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

    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      const error: any = new Error('Mastra run ID not found');
      error.statusCode = 400;
      throw error;
    }

    // Get the registered workflow and retrieve the Run instance from its runs Map
    const template = run.workflow_template_snapshot;
    if (!template) {
      const error: any = new Error('Workflow template snapshot not found');
      error.statusCode = 400;
      throw error;
    }

    const workflow = getWorkflowFromWorkflowId(template.template_id);
    if (!workflow) {
      const error: any = new Error('Workflow not registered');
      error.statusCode = 400;
      throw error;
    }

    // Access the runs Map from the workflow to get the actual Run instance
    const mastraRun = workflow.runs.get(mastraRunId);
    if (!mastraRun) {
      const error: any = new Error('Mastra run instance not found');
      error.statusCode = 400;
      throw error;
    }

    console.log(`[WorkflowService] Cancelling Mastra run ${mastraRunId}`);
    await mastraRun.cancel();

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

  async retryWorkflow(runId: number) {
    console.log(`[WorkflowService] retryWorkflow called for runId: ${runId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      const error: any = new Error('Workflow run not found');
      error.statusCode = 404;
      throw error;
    }

    if (run.status === 'RUNNING' || run.status === 'PENDING') {
      const error: any = new Error('Cannot retry a running or pending workflow');
      error.statusCode = 400;
      throw error;
    }

    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      const error: any = new Error('Mastra run ID not found');
      error.statusCode = 400;
      throw error;
    }

    const template = run.workflow_template_snapshot;
    if (!template) {
      const error: any = new Error('Workflow template snapshot not found');
      error.statusCode = 400;
      throw error;
    }

    // Find the step to retry from:
    // 1. The step that was running when cancelled
    // 2. Or the first failed step
    // 3. Or the first non-completed step
    const retryStep = run.steps.find(s => s.status === 'RUNNING')
      || run.steps.find(s => s.status === 'FAILED')
      || run.steps.find(s => s.status !== 'COMPLETED');

    if (!retryStep) {
      const error: any = new Error('No step found to retry from');
      error.statusCode = 400;
      throw error;
    }

    console.log(`[WorkflowService] Retrying from step: ${retryStep.step_id}`);

    // Update run status to RUNNING first (needed to allow step status update)
    await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

    // Reset the retry step status to PENDING before retry
    await this.workflowRunRepo.updateStep(runId, retryStep.step_id, {
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      error: null,
    });

    // Get task info
    const task = await this.taskRepo.findById(run.task_id ?? 0);
    if (!task) {
      const error: any = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const executionPath = run.worktree_path || await this._resolveExecutionPath(task);

    // Get the registered workflow
    const workflow = getWorkflowFromWorkflowId(template.template_id);
    if (!workflow) {
      const error: any = new Error('Workflow not registered');
      error.statusCode = 400;
      throw error;
    }

    // Get the existing Run instance from workflow.runs
    const mastraRun = await workflow.createRun({runId:mastraRunId});
    if (!mastraRun) {
      const error: any = new Error('Mastra run instance not found');
      error.statusCode = 400;
      throw error;
    }

    // Execute retry in background (non-blocking)
    this._executeRetry(runId, mastraRun, retryStep.step_id, task, executionPath).catch((err) => {
      console.error(`[Workflow] Fatal error in retry run #${runId}:`, err);
    });

    return await this.workflowRunRepo.findById(runId);
  }

  async _executeRetry(
    runId: number,
    mastraRun: any,
    stepId: string,
    task: WorkflowTaskRecord,
    executionPath: string
  ) {
    try {
      console.log(`[WorkflowService] Calling timeTravelStream for step: ${stepId}`);

      // Notify workflow start
      await this.lifecycle.onWorkflowStart(runId);

      const output = mastraRun.timeTravelStream({
        step: stepId,
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: executionPath,
        },
      });

      // Wait for completion - lifecycle callbacks handle step events internally
      const result = await output.result;

      console.log(`[WorkflowService] timeTravel result status: ${result.status}`);
      // Workflow lifecycle callbacks (onFinish/onError) handle final state updates
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.lifecycle.onWorkflowError(runId, errorMessage).catch(() => {});
      await this._resetTaskToTodo(task.id);
    }
  }
}

export { WorkflowService };