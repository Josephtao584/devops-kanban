import { existsSync } from 'fs';
import { WorkflowRunRepository, sharedWorkflowRunRepo } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { WorkflowInstanceService } from '../workflowInstanceService.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
import { buildWorkflowFromInstance, getWorkflowFromWorkflowId, cropInstanceForLoop, formatLoopContext, collectPriorSummaries } from './workflows.js';
import { type WorkflowTaskRecord } from '../../types/workflow.js';
import { WorkflowInstanceEntity, WorkflowRunEntity, WorkflowStepEntity, WorkflowTemplateEntity, WorkflowTemplateStepEntity } from '../../types/entities.js';
import { ValidationError, NotFoundError, ConflictError, BusinessError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { NotificationService } from '../notificationService.js';
import { STORAGE_PATH, BACKEND_ROOT } from '../../config/index.js';
import { ensureExternalRepo } from '../../utils/git.js';
import * as path from 'node:path';


function toStepState(instance: WorkflowInstanceEntity) {
  return instance.steps.map((step: any) => ({
    step_id: step.id,
    name: step.name,
    type: step.type,
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
  templateService: WorkflowTemplateService;
  agentRepo: AgentRepository;
  lifecycle: WorkflowLifecycle;

  private async resetTaskToTodo(taskId: number) {
    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }

  constructor({ workflowRunRepo, taskRepo, projectRepo, instanceService, templateService, agentRepo, lifecycle }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    instanceService?: WorkflowInstanceService;
    templateService?: WorkflowTemplateService;
    agentRepo?: AgentRepository;
    lifecycle?: WorkflowLifecycle;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || sharedWorkflowRunRepo;
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.instanceService = instanceService || new WorkflowInstanceService();
    this.templateService = templateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    const notificationService = new NotificationService({
      filePath: path.join(STORAGE_PATH, 'notification-config.json'),
      defaultYamlPath: path.join(BACKEND_ROOT, 'notification-config.yaml'),
    });

    this.lifecycle = lifecycle || new WorkflowLifecycle({
      workflowRunRepo: this.workflowRunRepo,
      taskRepo: this.taskRepo,
      onTaskStatusChange: async (taskId, status) => {
        // Dynamic import avoids the workflowService → workflowLifecycle → taskService
        // → workflowService module cycle at load time. By the time this hook fires
        // (during a running workflow), all modules are fully evaluated.
        const { taskService } = await import('../taskService.js');
        await taskService.onTaskStatusChange(taskId, status);
      },
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
              ? `[Coplat:${projectName}] ${event.taskTitle}`
              : `[Coplat] ${event.taskTitle}`;

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

    // Inject self into the lifecycle so onStepError can auto-trigger loops via
    // createLoopRun. Done as a setter (not constructor arg) to break the
    // workflowLifecycle ↔ workflowService cycle. Guarded so that test stubs
    // injecting a partial lifecycle remain valid.
    if (typeof this.lifecycle.setWorkflowService === 'function') {
      this.lifecycle.setWorkflowService(this);
    }
  }

  async startWorkflow(taskId: number, options: StartWorkflowOptions) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundError('未找到任务', 'Task not found', { taskId });
    }

    const executionPath = await this.resolveExecutionPath(task);

    if (!options.workflowTemplateId?.trim()) {
      throw new ValidationError('工作流模板 ID 不能为空', 'workflow template id is required');
    }

    // Create WorkflowInstance (immutable snapshot)
    const instance = options.workflowTemplateSnapshot
      ? await this.instanceService.createFromTemplateSnapshot(options.workflowTemplateSnapshot)
      : await this.instanceService.createFromTemplate(options.workflowTemplateId);
    await this.validateInstanceAgents(instance);

    // Atomically check for active runs and create a new one if none exist.
    // This prevents race conditions where two concurrent calls both see no
    // active run and both create one.
    const result = await this.workflowRunRepo.createIfNoActiveRun({
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

    if (result.existing) {
      throw new ConflictError('任务已有活跃的工作流运行', 'Task already has an active workflow run', { taskId, existingRunId: result.existing.id });
    }

    const run = result.created;
    await this.taskRepo.update(taskId, { workflow_run_id: run.id });
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};
    this.executeWorkflow(run.id, { ...task, execution_path: executionPath, project_env: projectEnv }, instance).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('WorkflowService', `Fatal error in workflow run #${run.id}: ${errorMessage}`);
      this.workflowRunRepo.update(run.id, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch(() => {});
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

  private async resolveExecutionPath(task: { project_id: number; worktree_path?: string | null; target_repo_url?: string | null }) {
    if (task.worktree_path && existsSync(task.worktree_path)) {
      return task.worktree_path;
    }

    if (task.target_repo_url) {
      return await ensureExternalRepo(task.target_repo_url);
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
      // For loop runs, crop the instance to start at the looped_from_step_id
      // and pre-render the loop-context preamble that gets injected into the
      // start step's prompt. Plain (non-loop) runs use the full instance and
      // no loopContext.
      const run = await this.workflowRunRepo.findById(runId);
      let workflowInstance = instance;
      let loopContext: { fromStepId: string; text: string } | undefined;
      if (run?.looped_from_step_id) {
        workflowInstance = cropInstanceForLoop(instance, run.looped_from_step_id);
        const priors = await collectPriorSummaries(this.workflowRunRepo, run.id, run.looped_from_step_id);
        loopContext = {
          fromStepId: run.looped_from_step_id,
          text: formatLoopContext({
            fromStepId: run.looped_from_step_id,
            failureContext: run.loop_failure_context,
            priorSummaries: priors,
          }),
        };
      }

      const workflow = buildWorkflowFromInstance(workflowInstance, {
        runId,
        task: { id: task.id, project_id: task.project_id, execution_path: task.execution_path },
        lifecycle: this.lifecycle,
        ...(loopContext ? { loopContext } : {}),
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
          taskExternalId: task.external_id || '',
        },
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
          projectEnv: task.project_env,
          taskExternalId: task.external_id || '',
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


  /**
   * Enrich a workflow run with `workflow_template_snapshot` so the frontend
   * can render template-derived fields (steps, maxLoops, onFailureLoopTo)
   * without a separate fetch. Both `getWorkflowRun` and `getAllRunsByTask`
   * call through this helper so the shape stays consistent across endpoints.
   *
   * The optional caches let bulk callers (i.e. `getAllRunsByTask`) avoid
   * re-fetching the same instance/template once per run.
   */
  private async _enrichWithTemplateSnapshot(
    run: WorkflowRunEntity,
    caches?: {
      instances?: Map<string, WorkflowInstanceEntity | null>;
      templates?: Map<string, WorkflowTemplateEntity | null>;
    },
  ): Promise<WorkflowRunEntity> {
    if (!run.workflow_instance_id) return run;

    const instanceCache = caches?.instances;
    const templateCache = caches?.templates;

    let instance: WorkflowInstanceEntity | null;
    if (instanceCache?.has(run.workflow_instance_id)) {
      instance = instanceCache.get(run.workflow_instance_id)!;
    } else {
      instance = await this.instanceService.getByInstanceId(run.workflow_instance_id);
      instanceCache?.set(run.workflow_instance_id, instance);
    }
    if (!instance) return run;

    let template: WorkflowTemplateEntity | null;
    if (templateCache?.has(instance.template_id)) {
      template = templateCache.get(instance.template_id)!;
    } else {
      template = await this.templateService.getTemplateById(instance.template_id);
      templateCache?.set(instance.template_id, template);
    }

    run.workflow_template_snapshot = {
      id: instance.id,
      template_id: instance.template_id,
      name: instance.name,
      steps: instance.steps.map(s => {
        const step: WorkflowTemplateStepEntity = {
          id: s.id,
          name: s.name,
          instructionPrompt: s.instructionPrompt,
          agentId: s.agentId,
          maxRetries: s.maxRetries ?? 0,
          onFailureLoopTo: s.onFailureLoopTo ?? null,
        };
        if (s.requiresConfirmation !== undefined) step.requiresConfirmation = s.requiresConfirmation;
        if (s.canEarlyExit !== undefined) step.canEarlyExit = s.canEarlyExit;
        if (s.type !== undefined) step.type = s.type;
        return step;
      }),
      maxLoops: template?.maxLoops ?? 0,
      created_at: instance.created_at,
      updated_at: instance.updated_at,
    };

    return run;
  }

  async getWorkflowRun(runId: number) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) return null;
    return this._enrichWithTemplateSnapshot(run);
  }

  async getAllRunsByTask(taskId: number) {
    const runs = await this.workflowRunRepo.findAllByTaskIdOrdered(taskId);
    // Cache instance + template lookups across runs so a 5-iteration loop
    // doesn't issue 10+ DB reads when one would do.
    const instances = new Map<string, WorkflowInstanceEntity | null>();
    const templates = new Map<string, WorkflowTemplateEntity | null>();
    for (const run of runs) {
      await this._enrichWithTemplateSnapshot(run, { instances, templates });
    }
    return runs;
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

    // Skip onStepResume for ASK_USER resumes — it writes confirmation fields that don't apply here
    if (!resumeData.ask_user_answer) {
      await this.lifecycle.onStepResume(runId, suspendedStep.step_id, resumeData);
    }

    // Fire-and-forget: resume() blocks until the entire remaining workflow finishes.
    // Run it in the background so the HTTP handler returns immediately.
    mastraRun.resume({
      step: suspendedStep.step_id,
      resumeData,
    }).then((result: any) => {
      logger.info('WorkflowService', `Resume result status: ${result?.status}`);
    }).catch(async (err: any) => {
      logger.error('WorkflowService', `Resume error: ${err.message}`);
      await this.lifecycle.onWorkflowError(runId, err.message).catch(() => {});
    });

    return await this.workflowRunRepo.findById(runId);
  }

  /**
   * Retry a specific step of a workflow run (e.g. to regenerate a SPLIT_TASK
   * suggestion). Resets the target step and any subsequent steps, flips the
   * run back to RUNNING, and drives Mastra via timeTravelStream to re-execute
   * from that step.
   *
   * Mastra can only rewind to a step on an existing run, so the run must
   * already have a mastra_run_id (i.e. it has started at least once). The
   * caller is responsible for first clearing any downstream artifacts such
   * as pending split_suggestion rows.
   */
  async retryStep(runId: number, stepId: string): Promise<void> {
    logger.info('WorkflowService', `retryStep called for runId: ${runId}, stepId: ${stepId}`);

    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw new NotFoundError('未找到工作流运行', 'Workflow run not found', { runId });
    }

    if (run.status === 'RUNNING' || run.status === 'PENDING') {
      throw new BusinessError('无法重试正在运行或等待中的工作流', 'Cannot retry a running or pending workflow', { runId, status: run.status });
    }

    const stepIndex = run.steps.findIndex((s) => s.step_id === stepId);
    if (stepIndex === -1) {
      throw new ValidationError('未找到指定步骤', 'Step not found in run', { runId, stepId });
    }

    // Reset the target step to PENDING and clear all execution artifacts so
    // onStepStart treats this as a fresh attempt.
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      error: null,
      summary: null,
      assembled_prompt: null,
      provider_session_id: null,
      suspend_reason: null,
      confirmation_note: null,
      confirmed_at: null,
      ask_user_question: null,
      ask_user_answer: null,
      early_exit: null,
      early_exit_reason: null,
    });

    // Reset every subsequent step as well — they must re-run after the
    // retried step emits new output. Leave earlier steps untouched so their
    // completed outputs remain visible to the user.
    for (let i = stepIndex + 1; i < run.steps.length; i++) {
      const downstream = run.steps[i];
      if (!downstream) continue;
      await this.workflowRunRepo.updateStep(runId, downstream.step_id, {
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        error: null,
        summary: null,
        assembled_prompt: null,
        provider_session_id: null,
        suspend_reason: null,
        confirmation_note: null,
        confirmed_at: null,
        ask_user_question: null,
        ask_user_answer: null,
        early_exit: null,
        early_exit_reason: null,
      });
    }

    await this.workflowRunRepo.update(runId, { status: 'RUNNING', current_step: stepId });

    const { task, executionPath, mastraRun } = await this.getMastraRunContext(runId);
    if (!mastraRun) {
      throw new ValidationError('未找到 Mastra 运行实例', 'Mastra run instance not found', { runId });
    }

    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};

    // Fire-and-forget — timeTravelStream.result resolves when the (re-run)
    // workflow finishes or suspends. Lifecycle callbacks drive state updates.
    this.executeRetry(runId, mastraRun, stepId, task, executionPath, projectEnv).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('WorkflowService', `Fatal error in retryStep run #${runId}: ${errorMessage}`);
      this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch(() => {});
    });
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
      throw new ValidationError('未找到 Mastra 运行实例', 'Mastra run instance not found', { runId });
    }

    // Load instance for retry
    const instance = await this.instanceService.getByInstanceId(run.workflow_instance_id);
    if (!instance) {
      throw new NotFoundError('未找到工作流实例', 'Workflow instance not found', { instanceId: run.workflow_instance_id });
    }

    // Load project env for retry
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};

    // Execute retry in background (non-blocking)
    this.executeRetry(runId, mastraRun, retryStep.step_id, task, executionPath, projectEnv).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('WorkflowService', `Fatal error in retry run #${runId}: ${errorMessage}`);
      this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch(() => {});
    });

    return await this.workflowRunRepo.findById(runId);
  }

  /**
   * Create a new "loop" workflow run that re-executes a portion of a failed
   * parent run. Steps before `fromStepId` are inherited from the parent as
   * SKIPPED; steps from `fromStepId` onward are reset to PENDING. The new
   * run reuses the parent's worktree and branch, increments iteration, and
   * carries forward the failure context for prompt augmentation.
   */
  async createLoopRun(
    parentRunId: number,
    fromStepId: string,
    failureContext?: { failed_step_id: string; error: string; summary: string | null },
    override = false,
  ): Promise<WorkflowRunEntity> {
    logger.info('WorkflowService', `createLoopRun called for parentRunId: ${parentRunId}, fromStepId: ${fromStepId}, override: ${override}`);

    const parent = await this.workflowRunRepo.findById(parentRunId);
    if (!parent) {
      throw new NotFoundError('未找到父工作流运行', `Parent workflow run ${parentRunId} not found`, { parentRunId });
    }
    if (parent.status !== 'FAILED') {
      throw new BusinessError(
        `父运行 ${parentRunId} 不在 FAILED 状态（当前: ${parent.status}）`,
        `Parent run ${parentRunId} is not in FAILED state (got ${parent.status})`,
        { parentRunId, status: parent.status },
      );
    }

    // Resolve template for maxLoops via the workflow instance.
    const instance = await this.instanceService.getByInstanceId(parent.workflow_instance_id);
    if (!instance) {
      throw new NotFoundError('未找到工作流实例', 'Workflow instance not found', { instanceId: parent.workflow_instance_id });
    }
    const template = await this.templateService.getTemplateById(instance.template_id);
    const maxLoops = template?.maxLoops ?? 0;

    // Validate fromStepId is in instance and strictly earlier than the failed step.
    const fromIdx = instance.steps.findIndex((s) => s.id === fromStepId);
    if (fromIdx === -1) {
      throw new ValidationError(
        `fromStepId "${fromStepId}" 不在工作流实例中`,
        `fromStepId "${fromStepId}" not found in workflow instance`,
        { fromStepId },
      );
    }
    const failedStepId = parent.current_step
      ?? parent.steps.find((s) => s.status === 'FAILED')?.step_id
      ?? null;
    if (failedStepId == null) {
      // A FAILED parent run should always have an identifiable failed step
      // (either current_step or a step with status='FAILED'). If neither
      // exists the run is in an inconsistent state — reject loudly rather
      // than silently skipping the order check below.
      throw new BusinessError(
        `父运行 ${parentRunId} 处于 FAILED 状态但找不到失败步骤`,
        `Parent run ${parentRunId} is FAILED but has no identifiable failed step`,
        { parentRunId },
      );
    }
    const failedIdx = instance.steps.findIndex((s) => s.id === failedStepId);
    if (failedIdx === -1) {
      throw new BusinessError(
        `失败步骤 "${failedStepId}" 不在工作流实例中`,
        `Failed step "${failedStepId}" not found in workflow instance`,
        { failedStepId },
      );
    }
    if (fromIdx >= failedIdx) {
      throw new ValidationError(
        `fromStepId "${fromStepId}" 必须早于失败步骤 "${failedStepId}"`,
        `fromStepId "${fromStepId}" must be earlier than the failed step "${failedStepId}"`,
        { fromStepId, failedStepId },
      );
    }

    // Validate iteration vs maxLoops.
    const newIteration = parent.iteration + 1;
    if (!override && newIteration > maxLoops) {
      throw new BusinessError(
        `无法循环：迭代将达到 ${newIteration}，超过 maxLoops=${maxLoops}`,
        `Cannot loop: would reach iteration ${newIteration}, exceeds maxLoops=${maxLoops}`,
        { newIteration, maxLoops },
      );
    }

    // Validate no in-flight child run.
    const inflight = await this.workflowRunRepo.findInFlightChild(parentRunId);
    if (inflight) {
      throw new ConflictError(
        `父运行 ${parentRunId} 已有进行中的子运行 (${inflight.id})`,
        `Parent run ${parentRunId} already has an in-flight child run (${inflight.id})`,
        { parentRunId, childRunId: inflight.id },
      );
    }

    // Validate worktree path still exists on disk.
    if (!existsSync(parent.worktree_path)) {
      throw new ValidationError(
        `工作树路径 ${parent.worktree_path} 已不存在，无法循环`,
        `Worktree path ${parent.worktree_path} no longer exists; cannot loop`,
        { worktreePath: parent.worktree_path },
      );
    }

    // Resolve loop_failure_context: prefer caller-supplied, otherwise derive
    // from the failed step.
    const failedStep = parent.steps.find((s) => s.step_id === failedStepId);
    const resolvedFailureContext: { failed_step_id: string; error: string; summary: string | null } | null =
      failureContext
        ?? (failedStep && failedStep.error
          ? { failed_step_id: failedStep.step_id, error: failedStep.error, summary: failedStep.summary ?? null }
          : null);

    // Load the task up front so we never create an orphan PENDING run if
    // the parent task was deleted between the failure and the loop attempt.
    const task = await this.taskRepo.findById(parent.task_id);
    if (!task) {
      throw new NotFoundError(
        `任务 ${parent.task_id} 不存在`,
        `Task ${parent.task_id} not found`,
        { taskId: parent.task_id },
      );
    }

    // Build new steps array: SKIPPED+inherited for prefix, PENDING+reset for suffix.
    const newSteps: WorkflowStepEntity[] = parent.steps.map((step, idx) => {
      if (idx < fromIdx) {
        return {
          ...step,
          status: 'SKIPPED',
          inherited_from_run_id: parent.id,
        };
      }
      return {
        ...step,
        status: 'PENDING',
        started_at: null,
        completed_at: null,
        retry_count: 0,
        error: null,
        session_id: null,
        provider_session_id: null,
        summary: null,
        assembled_prompt: null,
        suspend_reason: null,
        confirmation_note: null,
        confirmed_at: null,
        ask_user_question: null,
        ask_user_answer: null,
        early_exit: null,
        early_exit_reason: null,
        inherited_from_run_id: null,
      };
    });

    const result = await this.workflowRunRepo.createIfNoActiveRun({
      task_id: parent.task_id,
      workflow_instance_id: parent.workflow_instance_id,
      mastra_run_id: null,
      status: 'PENDING',
      current_step: fromStepId,
      steps: newSteps,
      worktree_path: parent.worktree_path,
      branch: parent.branch,
      context: parent.context,
      parent_run_id: parent.id,
      iteration: newIteration,
      looped_from_step_id: fromStepId,
      loop_failure_context: resolvedFailureContext,
    });

    if (!result.created) {
      throw new ConflictError(
        '无法创建循环运行：任务已有活跃运行',
        'Failed to create loop run: task already has an active run',
        { parentRunId, existingRunId: result.existing?.id },
      );
    }

    const newRun = result.created;
    await this.taskRepo.update(parent.task_id, { workflow_run_id: newRun.id }).catch(() => {});

    // Fire-and-forget execution, mirroring startWorkflow.
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};
    this.executeWorkflow(
      newRun.id,
      { ...task, execution_path: parent.worktree_path, project_env: projectEnv },
      instance,
    ).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('WorkflowService', `Fatal error in loop run #${newRun.id}: ${errorMessage}`);
      this.workflowRunRepo.update(newRun.id, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch(() => {});
    });

    return newRun;
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
          taskExternalId: task.external_id || '',
        },
      });

      // Wait for completion - lifecycle callbacks handle step events internally
      const result = await output.result;

      logger.info('WorkflowService', `timeTravel result status: ${result.status}`);
      // Workflow lifecycle callbacks (onFinish/onError) handle final state updates
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.lifecycle.onWorkflowError(runId, errorMessage).catch(() => {});
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch(() => {});
      await this.resetTaskToTodo(task.id);
    }
  }
}

export { WorkflowService };