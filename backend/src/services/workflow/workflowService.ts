import { existsSync } from 'fs';
import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { WorkflowInstanceService } from '../workflowInstanceService.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
import { buildWorkflowFromInstance, getWorkflowFromWorkflowId } from './workflows.js';
import { type WorkflowTaskRecord } from '../../types/workflow.js';
import { WorkflowInstanceEntity, WorkflowTemplateEntity } from '../../types/entities.js';


function createValidationError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}


function toStepState(instance: WorkflowInstanceEntity) {
  return instance.steps.map((step) => ({
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
  workflowTemplateId: string;
  workflowTemplateSnapshot?: WorkflowTemplateEntity | undefined;
};

class WorkflowService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  instanceService: WorkflowInstanceService;
  agentRepo: AgentRepository;
  lifecycle: WorkflowLifecycle;

  private async resetTaskToTodo(taskId: number) {
    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }

  constructor({ workflowRunRepo, taskRepo, projectRepo, instanceService, agentRepo, lifecycle }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    instanceService?: WorkflowInstanceService;
    agentRepo?: AgentRepository;
    lifecycle?: WorkflowLifecycle;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.instanceService = instanceService || new WorkflowInstanceService();
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

    const executionPath = await this.resolveExecutionPath(task);
    const existing = await this.workflowRunRepo.findLatestByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING' || existing.status === 'SUSPENDED')) {
      const error: any = new Error('Task already has an active workflow run');
      error.statusCode = 409;
      throw error;
    }

    if (!options.workflowTemplateId?.trim()) {
      throw createValidationError('workflow template id is required');
    }

    // Create WorkflowInstance (immutable snapshot)
    const instance = options.workflowTemplateSnapshot
      ? await this.instanceService.createFromTemplateSnapshot(options.workflowTemplateSnapshot)
      : await this.instanceService.createFromTemplate(options.workflowTemplateId);
    await this.validateInstanceAgents(instance);

    const run = await this.workflowRunRepo.create({
      task_id: taskId,
      workflow_instance_id: instance.instance_id,
      mastra_run_id: null,
      status: 'PENDING',
      current_step: null,
      steps: toStepState(instance),
      worktree_path: executionPath,
      branch: task.worktree_branch || `task/${taskId}`,
      context: {},
    });

    await this.taskRepo.update(taskId, { workflow_run_id: run.id });
    this.executeWorkflow(run.id, { ...task, execution_path: executionPath }, instance).catch((err) => {
      console.error(`[Workflow] Fatal error in workflow run #${run.id}:`, err);
    });

    return run;
  }

  async deleteByTaskId(taskId: number): Promise<void> {
    await this.workflowRunRepo.deleteByTaskId(taskId);
  }

  private async validateInstanceAgents(instance: WorkflowInstanceEntity) {
    for (const step of instance.steps) {
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
    }
  }

  private async resolveExecutionPath(task: { project_id: number; worktree_path?: string | null }) {
    if (task.worktree_path && existsSync(task.worktree_path)) {
      return task.worktree_path;
    }

    const project = await this.projectRepo.findById(task.project_id);
    if (project?.local_path && existsSync(project.local_path)) {
      return project.local_path;
    }

    const error: any = new Error('项目未配置本地路径或路径不存在，请先在项目设置中添加有效的 local_path');
    error.statusCode = 400;
    throw error;
  }

  private async getMastraRunContext(runId: number) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      const error: any = new Error('Workflow run not found');
      error.statusCode = 404;
      throw error;
    }

    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      const error: any = new Error('Mastra run ID not found');
      error.statusCode = 400;
      throw error;
    }

    const task = await this.taskRepo.findById(run.task_id ?? 0);
    if (!task) {
      const error: any = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const executionPath = run.worktree_path || await this.resolveExecutionPath(task);
    const { workflow } = await this.getOrRegisterWorkflowByInstanceId(
      run.workflow_instance_id,
      runId,
      { id: task.id, project_id: task.project_id, execution_path: executionPath },
    );

    const mastraRun = await workflow.createRun({ runId: mastraRunId });

    return { run, task, executionPath, workflow, mastraRun };
  }

  private async getOrRegisterWorkflowByInstanceId(
    instanceId: string,
    runId: number,
    task: { id: number; project_id: number; execution_path: string },
  ): Promise<any> {
    const workflow = getWorkflowFromWorkflowId(instanceId);
    if (workflow) {
        console.log('Type of then:', typeof workflow.then)
      return { workflow: workflow } as any;
    }
    const workflowInstance = await this.instanceService.getByInstanceId(instanceId);

    if (!workflowInstance) {
        const error: any = new Error('Workflow instance not found');
        error.statusCode = 404;
        throw error;
    }
    return { workflow: buildWorkflowFromInstance(workflowInstance, {
        runId,
        task,
        lifecycle: this.lifecycle,
    }) } as any;
  }

  private async executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, instance: WorkflowInstanceEntity) {
    try {
      const workflow = buildWorkflowFromInstance(instance, {
        runId,
        task: { id: task.id, project_id: task.project_id, execution_path: task.execution_path },
        lifecycle: this.lifecycle
      });

      // Let Mastra generate its own runId
      const mastraRun = await workflow.createRun();
      const mastraRunId = mastraRun.runId;

      // Store the mastra_run_id and mark as running
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
      await this.resetTaskToTodo(task.id);
    }
  }


  async getWorkflowRun(runId: number) {
    return this.workflowRunRepo.findById(runId);
  }

  async getAllRunsByTask(taskId: number) {
    return this.workflowRunRepo.findAllByTaskId(taskId);
  }

  async cancelWorkflow(runId: number) {
    console.log(`[WorkflowService] cancelWorkflow called for runId: ${runId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      const error: any = new Error('Workflow run not found');
      error.statusCode = 404;
      throw error;
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING' && run.status !== 'SUSPENDED') {
      const error: any = new Error(`Cannot cancel workflow in status: ${run.status}`);
      error.statusCode = 400;
      throw error;
    }

    const { mastraRun } = await this.getMastraRunContext(runId);

    console.log(`[WorkflowService] Cancelling Mastra run ${run.mastra_run_id}`);
    await mastraRun.cancel();

    // Finalize running or suspended step
    const runningStep = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && (candidate.status === 'RUNNING' || candidate.status === 'SUSPENDED'))
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING' || candidate.status === 'SUSPENDED');

    if (runningStep) {
      await this.lifecycle.onStepCancel(runId, runningStep.step_id).catch(() => {});
    }

    const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
    return updatedRun;
  }

  async resumeWorkflow(runId: number, resumeData: { approved: boolean; comment?: string }) {
    console.log(`[WorkflowService] resumeWorkflow called for runId: ${runId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      const error: any = new Error('Workflow run not found');
      error.statusCode = 404;
      throw error;
    }

    if (run.status !== 'SUSPENDED') {
      const error: any = new Error(`Cannot resume workflow in status: ${run.status}`);
      error.statusCode = 400;
      throw error;
    }

    // Find suspended step from steps
    const suspendedStep = run.steps.find(s => s.status === 'SUSPENDED');
    if (!suspendedStep) {
      const error: any = new Error('No suspended step found');
      error.statusCode = 400;
      throw error;
    }

    const { mastraRun } = await this.getMastraRunContext(runId);

    await this.lifecycle.onStepResume(runId, suspendedStep.step_id, resumeData);

    mastraRun.resume({
      step: suspendedStep.step_id,
      resumeData,
    }).then((result: any) => {
      console.log(`[Workflow] Resume result status: ${result?.status}`);
    }).catch((err: Error) => {
      console.error(`[Workflow] Resume error:`, err);
      this.lifecycle.onWorkflowError(runId, err.message).catch(() => {});
    });

    return await this.workflowRunRepo.findById(runId);
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

    // Find the step to retry from:
    // 1. The step that was running when cancelled
    // 2. Or the first failed step
    // 3. Or the first non-completed step
    const retryStep = run.steps.find(s => s.status === 'RUNNING')
      || run.steps.find(s => s.status === 'SUSPENDED')
      || run.steps.find(s => s.status === 'FAILED')
      || run.steps.find(s => s.status !== 'COMPLETED');

    if (!retryStep) {
      const error: any = new Error('No step found to retry from');
      error.statusCode = 400;
      throw error;
    }

    console.log(`[WorkflowService] Retrying from step: ${retryStep.step_id}`);

    const { task, executionPath, mastraRun } = await this.getMastraRunContext(runId);

    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING'
    });

    await this.workflowRunRepo.updateStep(runId, retryStep.step_id, {
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      error: null,
    });

    if (!mastraRun) {
      const error: any = new Error('Mastra run instance not found');
      error.statusCode = 400;
      throw error;
    }

    // Load instance for retry
    const instance = await this.instanceService.getByInstanceId(run.workflow_instance_id);
    if (!instance) {
      const error: any = new Error('Workflow instance not found');
      error.statusCode = 404;
      throw error;
    }

    // Execute retry in background (non-blocking)
    this.executeRetry(runId, mastraRun, retryStep.step_id, task, executionPath).catch((err) => {
      console.error(`[Workflow] Fatal error in retry run #${runId}:`, err);
    });

    return await this.workflowRunRepo.findById(runId);
  }

  private async executeRetry(
    runId: number,
    mastraRun: any,
    stepId: string,
    task: WorkflowTaskRecord,
    executionPath: string
  ) {
    try {
      console.log(`[WorkflowService] Calling timeTravelStream for step: ${stepId}`);

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
      await this.resetTaskToTodo(task.id);
    }
  }
}

export { WorkflowService };