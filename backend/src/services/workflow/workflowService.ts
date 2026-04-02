import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
import { buildWorkflowFromTemplate, getMastra, getWorkflowFromWorkflowId } from './workflows.js';
import { isSupportedExecutorType, type WorkflowTaskRecord } from '../../types/workflow.js';
import { WorkflowStepEntity, WorkflowTemplateEntity } from '../../types/entities.js';
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
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING' || existing.status === 'SUSPENDED')) {
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

  async deleteByTaskId(taskId: number): Promise<void> {
    await this.workflowRunRepo.deleteByTaskId(taskId);
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

  _getOrRegisterWorkflow(
    runId: number,
    template: WorkflowTemplateEntity,
    task: { id: number; project_id: number; execution_path: string },
  ) {
    const workflow = getWorkflowFromWorkflowId(template.template_id);
    if (workflow) {
      return workflow;
    }

    return buildWorkflowFromTemplate(template, {
      runId,
      task,
      lifecycle: this.lifecycle,
    });
  }

  async _loadMastraSnapshot(workflowName: string, mastraRunId: string) {
    const workflowsStore = await getMastra().getStorage()?.getStore('workflows');
    return await workflowsStore?.loadWorkflowSnapshot({
      workflowName,
      runId: mastraRunId,
    });
  }

  async _takeOverStaleMastraRun(
    runId: number,
    run: { mastra_run_id: string | null; workflow_template_snapshot: WorkflowTemplateEntity; context: Record<string, unknown> },
  ) {
    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      return null;
    }

    const workflowName = run.workflow_template_snapshot.template_id;
    const workflow = getWorkflowFromWorkflowId(workflowName);
    const inMemoryRun = workflow?.runs.get(mastraRunId);
    const snapshot = await this._loadMastraSnapshot(workflowName, mastraRunId);

    if (!snapshot || snapshot.status !== 'running' || inMemoryRun) {
      return snapshot;
    }

    const workflowsStore = await getMastra().getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName,
      runId: mastraRunId,
      snapshot: {
        ...snapshot,
        status: 'failed',
        error: snapshot.error || {
          name: 'StaleWorkflowRunError',
          message: 'Recovered stale running workflow after backend restart',
        },
      },
    });

    await this.workflowRunRepo.update(runId, {
      context: {
        ...run.context,
        stale_mastra_run_id: mastraRunId,
        stale_mastra_takeover_at: new Date().toISOString(),
      },
    });

    return await this._loadMastraSnapshot(workflowName, mastraRunId);
  }

  async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, workflowTemplate: WorkflowTemplateEntity) {
    try {
      const skillNames = await resolveWorkflowSkills(workflowTemplate);
      await prepareExecutionSkills({
        executorType: 'CLAUDE_CODE',
        skillNames,
        executionPath: task.execution_path,
      });

      const existingRun = await this.workflowRunRepo.findById(runId);
      await this.workflowRunRepo.update(runId, {
        status: 'RUNNING',
        context: {
          ...(existingRun?.context || {}),
          error: null,
          stale_mastra_run_id: null,
          stale_mastra_takeover_at: null,
        },
      });

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

    if (run.status !== 'RUNNING' && run.status !== 'PENDING' && run.status !== 'SUSPENDED') {
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

    const template = run.workflow_template_snapshot;
    if (!template) {
      const error: any = new Error('Workflow template snapshot not found');
      error.statusCode = 400;
      throw error;
    }

    const task = await this.taskRepo.findById(run.task_id ?? 0);
    if (!task) {
      const error: any = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const executionPath = run.worktree_path || await this._resolveExecutionPath(task);
    const workflow = this._getOrRegisterWorkflow(runId, template, {
      id: task.id,
      project_id: task.project_id,
      execution_path: executionPath,
    });

    const mastraRun = workflow.runs.get(mastraRunId);
    if (mastraRun) {
      console.log(`[WorkflowService] Cancelling Mastra run ${mastraRunId}`);
      await mastraRun.cancel();
    } else {
      console.log(`[WorkflowService] Mastra run ${mastraRunId} not in memory, skipping Mastra cancel`);
    }

    // Finalize running or suspended step
    const runningStep = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && (candidate.status === 'RUNNING' || candidate.status === 'SUSPENDED'))
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING' || candidate.status === 'SUSPENDED');

    if (runningStep) {
      await this.lifecycle.onStepCancel(runId, runningStep.step_id).catch(() => {});
    }

    const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
    await this._resetTaskToTodo(run.task_id ?? 0);
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

    const template = run.workflow_template_snapshot;
    if (!template) {
      const error: any = new Error('Workflow template snapshot not found');
      error.statusCode = 400;
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

    const executionPath = run.worktree_path || await this._resolveExecutionPath(task);
    const workflow = this._getOrRegisterWorkflow(runId, template, {
      id: task.id,
      project_id: task.project_id,
      execution_path: executionPath,
    });

    await this._takeOverStaleMastraRun(runId, run);
    await this.workflowRunRepo.update(runId, {
      context: {
        ...run.context,
        error: null,
        stale_mastra_run_id: null,
        stale_mastra_takeover_at: null,
      },
    });
    const mastraRun = await workflow.createRun({ runId: mastraRunId });

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
      || run.steps.find(s => s.status === 'SUSPENDED')
      || run.steps.find(s => s.status === 'FAILED')
      || run.steps.find(s => s.status !== 'COMPLETED');

    if (!retryStep) {
      const error: any = new Error('No step found to retry from');
      error.statusCode = 400;
      throw error;
    }

    console.log(`[WorkflowService] Retrying from step: ${retryStep.step_id}`);

    // Get task info
    const task = await this.taskRepo.findById(run.task_id ?? 0);
    if (!task) {
      const error: any = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const executionPath = run.worktree_path || await this._resolveExecutionPath(task);

    const workflow = this._getOrRegisterWorkflow(runId, template, {
      id: task.id,
      project_id: task.project_id,
      execution_path: executionPath,
    });

    const persistedMastraSnapshot = await this._takeOverStaleMastraRun(runId, run);
    const persistedMastraRun = await workflow.getWorkflowRunById(mastraRunId, { withNestedWorkflows: false });
    if ((persistedMastraSnapshot?.status === 'running' || persistedMastraRun?.status === 'running')) {
      const error: any = new Error('Workflow run is still running in Mastra storage and cannot be retried yet');
      error.statusCode = 409;
      throw error;
    }

    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING',
      context: {
        ...run.context,
        error: null,
        stale_mastra_run_id: null,
        stale_mastra_takeover_at: null,
      },
    });

    await this.workflowRunRepo.updateStep(runId, retryStep.step_id, {
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      error: null,
    });

    const mastraRun = await workflow.createRun({ runId: mastraRunId });
    if (!mastraRun) {
      const error: any = new Error('Mastra run instance not found');
      error.statusCode = 400;
      throw error;
    }

    // Execute retry in background (non-blocking)
    this._executeRetry(runId, mastraRun, retryStep.step_id, task, executionPath, template, run.steps).catch((err) => {
      console.error(`[Workflow] Fatal error in retry run #${runId}:`, err);
    });

    return await this.workflowRunRepo.findById(runId);
  }

  async _executeRetry(
    runId: number,
    mastraRun: any,
    stepId: string,
    task: WorkflowTaskRecord,
    executionPath: string,
    template: WorkflowTemplateEntity,
    steps: WorkflowStepEntity[],
  ) {
    try {
      console.log(`[WorkflowService] Calling timeTravelStream for step: ${stepId}`);

      await this.lifecycle.onWorkflowStart(runId);

      const stepIndex = template.steps.findIndex(candidate => candidate.id === stepId);
      const inputData = stepIndex <= 0
        ? {
          taskId: task.id,
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: executionPath,
        }
        : {
          summary: steps[stepIndex - 1]?.summary || '',
        };

      const output = mastraRun.timeTravelStream({
        step: stepId,
        inputData,
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