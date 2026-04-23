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
import { ValidationError, NotFoundError, ConflictError, BusinessError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { NotificationService } from '../notificationService.js';
import { STORAGE_PATH, BACKEND_ROOT } from '../../config/index.js';
import * as path from 'node:path';


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
    early_exit: null,
    early_exit_reason: null,
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
    const notificationService = new NotificationService({
      filePath: path.join(STORAGE_PATH, 'notification-config.json'),
      defaultYamlPath: path.join(BACKEND_ROOT, 'notification-config.yaml'),
    });

    this.lifecycle = lifecycle || new WorkflowLifecycle({
      workflowRunRepo: this.workflowRunRepo,
      taskRepo: this.taskRepo,
      onWorkflowNotification: (event) => {
        notificationService.shouldNotify(event.type).then(async (enabled) => {
          if (!enabled) return;

          try {
            // Fetch project name for header
            const task = await this.taskRepo.findById(event.taskId);
            let projectName = '';
            if (task?.project_id) {
              const project = await this.projectRepo.findById(task.project_id);
              projectName = project?.name || '';
            }
            const header = projectName
              ? `[DevOps-Kanban:${projectName}] ${event.taskTitle}`
              : `[DevOps-Kanban] ${event.taskTitle}`;

            const completedSteps = event.steps
              .filter((s) => s.status === 'COMPLETED' && s.summary)
              .map((s) => `${s.name}: ${s.summary}`);

            let content = '';
            if (event.type === 'SUSPENDED') {
              const stepName = event.steps.find((s) => s.stepId === event.currentStepId)?.name || event.currentStepId || '';
              const parts = [`${header} - 工作流等待确认`];
              if (stepName) parts.push(`步骤: ${stepName}`);
              if (event.suspendInfo?.reason) parts.push(`原因: ${event.suspendInfo.reason}`);
              const question = event.suspendInfo?.askUserQuestion;
              if (question && typeof question === 'object' && 'question' in question) {
                parts.push(`问题: ${(question as { question: string }).question}`);
              }
              if (completedSteps.length > 0) {
                parts.push(`已完成步骤: ${completedSteps.join('; ')}`);
              }
              content = parts.join('\n');
            } else if (event.type === 'COMPLETED') {
              const parts = [`${header} - 工作流已完成`];
              if (completedSteps.length > 0) {
                parts.push(`步骤概要: ${completedSteps.join('; ')}`);
              }
              content = parts.join('\n');
            } else if (event.type === 'FAILED') {
              const failedStep = event.steps.find((s) => s.status === 'FAILED');
              const stepName = failedStep?.name || event.steps.find((s) => s.stepId === event.currentStepId)?.name || '';
              const parts = [`${header} - 工作流执行失败`];
              if (stepName) parts.push(`失败步骤: ${stepName}`);
              parts.push(`错误: ${event.errorMessage || '未知错误'}`);
              if (completedSteps.length > 0) {
                parts.push(`已完成步骤: ${completedSteps.join('; ')}`);
              }
              content = parts.join('\n');
            } else {
              content = `${header}: ${event.type}`;
            }

            await notificationService.sendNotification(content);
          } catch (err) {
            logger.warn('WorkflowService', `Notification enrichment failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }).catch((err) => {
          logger.warn('WorkflowService', `Notification event check failed: ${err.message}`);
        });
      },
    });
  }

  async startWorkflow(taskId: number, options: StartWorkflowOptions) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId });
    }

    const executionPath = await this.resolveExecutionPath(task);
    const existing = await this.workflowRunRepo.findLatestByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING' || existing.status === 'SUSPENDED')) {
      throw new ConflictError('任务已有活跃的工作流运行', 'Task already has an active workflow run', { taskId, existingRunId: existing.id });
    }

    if (!options.workflowTemplateId?.trim()) {
      throw new ValidationError('工作流模板 ID 不能为空', 'workflow template id is required');
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
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};
    this.executeWorkflow(run.id, { ...task, execution_path: executionPath, project_env: projectEnv }, instance).catch((err) => {
      logger.error('WorkflowService', `Fatal error in workflow run #${run.id}: ${err instanceof Error ? err.message : String(err)}`);
    });

    return run;
  }

  async deleteByTaskId(taskId: number): Promise<void> {
    await this.workflowRunRepo.deleteByTaskId(taskId);
  }

  private async validateInstanceAgents(instance: WorkflowInstanceEntity) {
    for (const step of instance.steps) {
      if (!Number.isFinite(step.agentId)) {
        throw new ValidationError(`步骤 "${step.name}" 未分配代理`, `Step "${step.name}" has no agent assigned`, { stepId: step.id, stepName: step.name });
      }

      const agent = await this.agentRepo.findById(step.agentId);
      if (!agent) {
        throw new ValidationError(`步骤 "${step.name}" 引用的代理 ${step.agentId} 未找到`, `Step "${step.name}" references agent ${step.agentId} that was not found`, { stepId: step.id, agentId: step.agentId });
      }

      if (!agent.enabled) {
        throw new ValidationError(`步骤 "${step.name}" 引用的代理 ${step.agentId} 已禁用`, `Step "${step.name}" references agent ${step.agentId} that is disabled`, { stepId: step.id, agentId: step.agentId });
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

    throw new ValidationError('项目未配置本地路径或路径不存在，请先在项目设置中添加有效的 local_path', 'Project local_path is not configured or does not exist', { projectId: task.project_id });
  }

  private async getMastraRunContext(runId: number) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new NotFoundError('未找到工作流运行', 'Workflow run not found', { runId });
    }

    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      throw new ValidationError('未找到 Mastra 运行 ID', 'Mastra run ID not found', { runId });
    }

    const task = await this.taskRepo.findById(run.task_id ?? 0);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId: run.task_id });
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
      return { workflow: workflow } as any;
    }
    const workflowInstance = await this.instanceService.getByInstanceId(instanceId);

    if (!workflowInstance) {
        throw new NotFoundError('未找到工作流实例', 'Workflow instance not found', { instanceId });
    }
    return { workflow: buildWorkflowFromInstance(workflowInstance, {
        runId,
        task,
        lifecycle: this.lifecycle,
    }) } as any;
  }

  private async executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string; project_env: Record<string, string> }, instance: WorkflowInstanceEntity) {
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
      logger.info('WorkflowService', `Created Mastra run ${mastraRunId} for workflowRun ${runId}`);

      // Notify workflow start
      await this.lifecycle.onWorkflowStart(runId);

      // Fire-and-forget: start async without blocking
      await mastraRun.startAsync({
        inputData: {
          taskId: task.id,
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
          projectEnv: task.project_env,
        },
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
          projectEnv: task.project_env,
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
    logger.info('WorkflowService', `cancelWorkflow called for runId: ${runId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new NotFoundError('未找到工作流运行', 'Workflow run not found', { runId });
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING' && run.status !== 'SUSPENDED') {
      throw new BusinessError(`无法取消状态为 ${run.status} 的工作流`, `Cannot cancel workflow in status: ${run.status}`, { runId, status: run.status });
    }

    const { mastraRun } = await this.getMastraRunContext(runId);

    logger.info('WorkflowService', `Cancelling Mastra run ${run.mastra_run_id}`);
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

  async resumeWorkflow(runId: number, resumeData: { approved: boolean; comment?: string; ask_user_answer?: string }) {
    logger.info('WorkflowService', `resumeWorkflow called for runId: ${runId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new NotFoundError('未找到工作流运行', 'Workflow run not found', { runId });
    }

    if (run.status !== 'SUSPENDED') {
      throw new BusinessError(`无法恢复状态为 ${run.status} 的工作流`, `Cannot resume workflow in status: ${run.status}`, { runId, status: run.status });
    }

    // Find suspended step from steps
    const suspendedStep = run.steps.find(s => s.status === 'SUSPENDED');
    if (!suspendedStep) {
      throw new ValidationError('未找到挂起的步骤', 'No suspended step found', { runId });
    }

    const { mastraRun } = await this.getMastraRunContext(runId);

    await this.lifecycle.onStepResume(runId, suspendedStep.step_id, resumeData);

    // Fire-and-forget: resume() blocks until the entire remaining workflow finishes.
    // Run it in the background so the HTTP handler returns immediately.
    mastraRun.resume({
      step: suspendedStep.step_id,
      resumeData,
    }).then((result) => {
      logger.info('WorkflowService', `Resume result status: ${(result as any)?.status}`);
    }).catch(async (err: any) => {
      logger.error('WorkflowService', `Resume error: ${err.message}`);
      await this.lifecycle.onWorkflowError(runId, err.message).catch(() => {});
    });

    return await this.workflowRunRepo.findById(runId);
  }

  async retryWorkflow(runId: number) {
    logger.info('WorkflowService', `retryWorkflow called for runId: ${runId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new NotFoundError('未找到工作流运行', 'Workflow run not found', { runId });
    }

    if (run.status === 'RUNNING' || run.status === 'PENDING') {
      throw new BusinessError('无法重试正在运行或等待中的工作流', 'Cannot retry a running or pending workflow', { runId, status: run.status });
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
      throw new ValidationError('未找到可重试的步骤', 'No step found to retry from', { runId });
    }

    logger.info('WorkflowService', `Retrying from step: ${retryStep.step_id}`);

    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING'
    });

    await this.workflowRunRepo.updateStep(runId, retryStep.step_id, {
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      error: null,
    });

    // Load task and resolve execution path
    const task = await this.taskRepo.findById(run.task_id ?? 0);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId: run.task_id });
    }

    const executionPath = run.worktree_path || await this.resolveExecutionPath(task);

    // Load instance for retry
    const instance = await this.instanceService.getByInstanceId(run.workflow_instance_id);
    if (!instance) {
      throw new NotFoundError('未找到工作流实例', 'Workflow instance not found', { instanceId: run.workflow_instance_id });
    }

    // Build a fresh workflow to get a new Run with a clean (non-aborted) AbortController.
    // Reusing the cached Run from a cancelled workflow keeps the old AbortController in
    // "aborted" state, which causes timeTravelStream to immediately kill the spawned process.
    const freshWorkflow = buildWorkflowFromInstance(instance, {
      runId,
      task: { id: task.id, project_id: task.project_id, execution_path: executionPath },
      lifecycle: this.lifecycle,
    });

    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      throw new ValidationError('未找到 Mastra 运行 ID', 'Mastra run ID not found', { runId });
    }
    const mastraRun = await freshWorkflow.createRun({ runId: mastraRunId });

    // Load project env for retry
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};

    // Execute retry in background (non-blocking)
    this.executeRetry(runId, mastraRun, retryStep.step_id, task, executionPath, projectEnv).catch((err) => {
      logger.error('WorkflowService', `Fatal error in retry run #${runId}: ${err instanceof Error ? err.message : String(err)}`);
    });

    return await this.workflowRunRepo.findById(runId);
  }

  private async executeRetry(
    runId: number,
    mastraRun: any,
    stepId: string,
    task: WorkflowTaskRecord,
    executionPath: string,
    projectEnv: Record<string, string>
  ) {
    try {
      logger.info('WorkflowService', `Calling timeTravelStream for step: ${stepId}`);

      await this.lifecycle.onWorkflowStart(runId);

      const output = mastraRun.timeTravelStream({
        step: stepId,
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: executionPath,
          projectEnv,
        },
      });

      // Wait for completion - lifecycle callbacks handle step events internally
      const result = await output.result;

      logger.info('WorkflowService', `timeTravel result status: ${result.status}`);
      // Workflow lifecycle callbacks (onFinish/onError) handle final state updates
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.lifecycle.onWorkflowError(runId, errorMessage).catch(() => {});
      await this.resetTaskToTodo(task.id);
    }
  }
}

export { WorkflowService };