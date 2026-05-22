import { existsSync } from 'fs';
import { WorkflowRunRepository, sharedWorkflowRunRepo } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { WorkflowInstanceService } from '../workflowInstanceService.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import { WorkflowLifecycle } from './workflowLifecycle.js';
import { WorkflowLoopService } from './workflowLoopService.js';
import { buildWorkflowFromInstance, getWorkflowFromWorkflowId, cropInstanceForLoop, formatLoopContext, collectPriorSummaries } from './workflows.js';
import { type WorkflowTaskRecord } from '../../types/workflow.js';
import { WorkflowInstanceEntity, WorkflowRunEntity, WorkflowTemplateEntity } from '../../types/entities.js';
import { ValidationError, NotFoundError, ConflictError, BusinessError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { NotificationService } from '../notificationService.js';
import { STORAGE_PATH, BACKEND_ROOT } from '../../config/index.js';
import { ensureExternalRepo } from '../../utils/git.js';
import { writeErrorToFile } from './workflowSummaryWriter.js';
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
  loopService: WorkflowLoopService;

  private async resetTaskToTodo(taskId: number) {
    await this.taskRepo.update(taskId, { status: 'TODO' }).catch(() => {});
  }

  constructor({ workflowRunRepo, taskRepo, projectRepo, instanceService, templateService, agentRepo, lifecycle, loopService }: {
    workflowRunRepo?: WorkflowRunRepository;
    taskRepo?: TaskRepository;
    projectRepo?: ProjectRepository;
    instanceService?: WorkflowInstanceService;
    templateService?: WorkflowTemplateService;
    agentRepo?: AgentRepository;
    lifecycle?: WorkflowLifecycle;
    loopService?: WorkflowLoopService;
  } = {}) {
    this.workflowRunRepo = workflowRunRepo || sharedWorkflowRunRepo;
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this.instanceService = instanceService || new WorkflowInstanceService();
    this.templateService = templateService || new WorkflowTemplateService();
    this.agentRepo = agentRepo || new AgentRepository();
    this.loopService = loopService || new WorkflowLoopService({
      workflowRunRepo: this.workflowRunRepo,
      taskRepo: this.taskRepo,
      instanceService: this.instanceService,
      templateService: this.templateService,
    });
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
          logger.warn('WorkflowService', `Notification event check failed: ${err instanceof Error ? err.message : String(err)}`);
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

    if (typeof options.workflowTemplateId !== 'string' || !options.workflowTemplateId.trim()) {
      throw new ValidationError('工作流模板 ID 不能为空', 'workflow template id is required and must be a string');
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
      const stack = err instanceof Error ? err.stack : null;
      logger.error('WorkflowService', `Fatal error in workflow run #${run.id}: ${errorMessage}${stack ? '\n' + stack : ''}`);
      this.workflowRunRepo.update(run.id, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch((dbErr) => {
        logger.warn('WorkflowService', `Failed to mark run ${run.id} as FAILED after startWorkflow error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      });
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

  private async resolveExecutionPath(task: { project_id: number; worktree_path?: string | null; work_dir?: string | null; target_repo_url?: string | null }) {
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

  private async getMastraRunContext(runId: number, options: { evictCachedRun?: boolean } = {}) {
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
      { id: task.id, project_id: task.project_id, execution_path: executionPath, work_dir: task.work_dir ?? null },
    );

    // Mastra caches Run instances by runId in workflow.runs. A cached Run that
    // was previously cancelled holds a permanently-aborted AbortController; the
    // execution engine checks signal.aborted after every step and rewrites the
    // result to "canceled", which prevents retry from advancing past the first
    // step. Evicting the cached Run forces createRun() to construct a fresh
    // instance with a new AbortController. The snapshot in storage is keyed by
    // runId, so timeTravel still resumes from the correct state.
    if (options.evictCachedRun) {
      workflow?.runs?.delete?.(mastraRunId);
    }

    const mastraRun = await workflow.createRun({ runId: mastraRunId });

    return { run, task, executionPath, workflow, mastraRun };
  }

  private async getOrRegisterWorkflowByInstanceId(
    instanceId: string,
    runId: number,
    task: { id: number; project_id: number; execution_path: string; work_dir?: string | null },
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
        let failureContext = run.loop_failure_context;
        if (failureContext?.error && task.execution_path) {
          const errorPath = await writeErrorToFile(task.execution_path, run.id, failureContext.failed_step_id, failureContext.error);
          if (errorPath) {
            failureContext = { ...failureContext, error: `错误内容已写入文件 ${errorPath}，请读取该文件获取完整错误信息。` };
          }
        }
        const priors = await collectPriorSummaries(this.workflowRunRepo, run.id, run.looped_from_step_id);
        loopContext = {
          fromStepId: run.looped_from_step_id,
          text: formatLoopContext({
            fromStepId: run.looped_from_step_id,
            failureContext,
            priorSummaries: priors,
          }),
        };
      }

      const workflow = buildWorkflowFromInstance(workflowInstance, {
        runId,
        task: { id: task.id, project_id: task.project_id, execution_path: task.execution_path, work_dir: task.work_dir ?? null },
        lifecycle: this.lifecycle,
        ...(loopContext ? { loopContext } : {}),
      });

      // Let Mastra generate its own runId
      const mastraRun = await workflow.createRun();
      const mastraRunId = mastraRun.runId;

      // Store the mastra_run_id and mark as running
      // CRITICAL: Re-read the current status before updating — the user may have
      // cancelled this run between createIfNoActiveRun (which created it as PENDING)
      // and here. Without this check, we would overwrite CANCELLED → RUNNING and
      // the Mastra run would proceed despite the user's cancellation.
      const currentRun = await this.workflowRunRepo.findById(runId);
      if (currentRun?.status === 'CANCELLED') {
        logger.info('WorkflowService', `Run ${runId} was cancelled before executeWorkflow could start, skipping Mastra start. Not overriding status.`);
        // Still save the mastra_run_id so future retries can find this run,
        // but leave status as CANCELLED.
        await this.workflowRunRepo.update(runId, { mastra_run_id: mastraRunId });
        return;
      }
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
          workDir: task.work_dir || '',
          projectEnv: task.project_env,
          taskExternalId: task.external_id || '',
        },
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
          workDir: task.work_dir || '',
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
   * Delegates to WorkflowLoopService.enrichWithTemplateSnapshot. Kept on the
   * service so its callers (and tests that rely on the public API surface)
   * continue to work without changes.
   */
  private _enrichWithTemplateSnapshot(
    run: WorkflowRunEntity,
    caches?: {
      instances?: Map<string, WorkflowInstanceEntity | null>;
    },
  ): Promise<WorkflowRunEntity> {
    return this.loopService.enrichWithTemplateSnapshot(run, caches);
  }

  async getWorkflowRun(runId: number) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) return null;
    return this._enrichWithTemplateSnapshot(run);
  }

  async getAllRunsByTask(taskId: number) {
    const runs = await this.workflowRunRepo.findAllByTaskIdOrdered(taskId);
    // Cache instance lookups across runs so a 5-iteration loop doesn't issue
    // 5+ DB reads when one would do.
    const instances = new Map<string, WorkflowInstanceEntity | null>();
    for (const run of runs) {
      await this._enrichWithTemplateSnapshot(run, { instances });
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

    // Best-effort cancel: under rapid cancel+retry the cached Mastra Run may be
    // mid-teardown / already-finished, and createRun() / cancel() can throw.
    // Still flip the DB row to CANCELLED so the UI reflects user intent and
    // a subsequent retry can proceed. Surfacing the error to the route causes
    // the user to keep clicking cancel, which compounds the race.
    try {
      const { mastraRun } = await this.getMastraRunContext(runId);
      logger.info('WorkflowService', `Cancelling Mastra run ${run.mastra_run_id}`);
      await mastraRun.cancel();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('WorkflowService', `Mastra cancel failed for runId ${runId}, proceeding to DB cancel: ${errorMessage}`);
    }

    // Finalize running or suspended step
    const runningStep = (run.current_step
      ? run.steps.find((candidate) => candidate.step_id === run.current_step && (candidate.status === 'RUNNING' || candidate.status === 'SUSPENDED'))
      : null) || run.steps.find((candidate) => candidate.status === 'RUNNING' || candidate.status === 'SUSPENDED');

    if (runningStep) {
      await this.lifecycle.onStepCancel(runId, runningStep.step_id).catch((err) => {
        logger.warn('WorkflowService', `onStepCancel failed for runId ${runId}, step ${runningStep.step_id}: ${err instanceof Error ? err.message : String(err)}`);
      });
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : null;
      logger.error('WorkflowService', `Resume error for runId ${runId}: ${errorMessage}${stack ? '\n' + stack : ''}`);
      // Defensive: onWorkflowError can itself throw (DB serialization queue
      // reset, txn close failures). Don't let that bubble into an
      // unhandledRejection — main.ts treats those as fatal.
      try {
        await this.lifecycle.onWorkflowError(runId, errorMessage);
      } catch (hookErr) {
        logger.warn('WorkflowService', `onWorkflowError hook failed during resume catch: ${hookErr instanceof Error ? hookErr.message : String(hookErr)}`);
      }
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
  async retryStep(runId: number, stepId: string, retryNote?: string): Promise<void> {
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
    // onStepStart treats this as a fresh attempt. When a retryNote is provided,
    // preserve provider_session_id so the step handler can continue the prior
    // Claude session by sending the note as the next user message.
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      error: null,
      summary: null,
      assembled_prompt: null,
      ...(retryNote ? {} : { provider_session_id: null }),
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

    const { task, executionPath, mastraRun } = await this.getMastraRunContext(runId, { evictCachedRun: true });
    if (!mastraRun) {
      throw new ValidationError('未找到 Mastra 运行实例', 'Mastra run instance not found', { runId });
    }

    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};

    // Fire-and-forget — timeTravelStream.result resolves when the (re-run)
    // workflow finishes or suspends. Lifecycle callbacks drive state updates.
    this.executeRetry(runId, mastraRun, stepId, task, executionPath, projectEnv, retryNote).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : null;
      logger.error('WorkflowService', `Fatal error in retryStep run #${runId}: ${errorMessage}${stack ? '\n' + stack : ''}`);
      this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch((dbErr) => {
        logger.warn('WorkflowService', `Failed to mark run ${runId} as FAILED after retryStep error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      });
    });
  }

  async retryWorkflow(runId: number, retryNote?: string) {
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

    const { task, executionPath, mastraRun } = await this.getMastraRunContext(runId, { evictCachedRun: true });

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
    this.executeRetry(runId, mastraRun, retryStep.step_id, task, executionPath, projectEnv, retryNote).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : null;
      logger.error('WorkflowService', `Fatal error in retry run #${runId}: ${errorMessage}${stack ? '\n' + stack : ''}`);
      this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch((dbErr) => {
        logger.warn('WorkflowService', `Failed to mark run ${runId} as FAILED after retry error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      });
    });

    return await this.workflowRunRepo.findById(runId);
  }

  /**
   * Create a new "loop" workflow run that re-executes a portion of a failed
   * parent run. Validation and record creation are delegated to
   * WorkflowLoopService; this wrapper handles the fire-and-forget dispatch
   * of executeWorkflow so the lifecycle hook and HTTP route surfaces stay
   * unchanged.
   */
  async createLoopRun(
    parentRunId: number,
    fromStepId: string,
    failureContext?: { failed_step_id: string; error: string; summary: string | null },
    override = false,
  ): Promise<WorkflowRunEntity> {
    const { newRun, instance, task } = await this.loopService.createLoopRun(
      parentRunId,
      fromStepId,
      failureContext,
      override,
    );

    // Fire-and-forget execution, mirroring startWorkflow.
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};
    this.executeWorkflow(
      newRun.id,
      { ...task, execution_path: newRun.worktree_path, project_env: projectEnv },
      instance,
    ).catch((err) => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : null;
      logger.error('WorkflowService', `Fatal error in loop run #${newRun.id}: ${errorMessage}${stack ? '\n' + stack : ''}`);
      this.workflowRunRepo.update(newRun.id, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch((dbErr) => {
        logger.warn('WorkflowService', `Failed to mark loop run ${newRun.id} as FAILED: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      });
    });

    return newRun;
  }

  private async executeRetry(
    runId: number,
    mastraRun: any,
    stepId: string,
    task: WorkflowTaskRecord,
    executionPath: string,
    projectEnv: Record<string, string>,
    retryNote?: string
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
          workDir: task.work_dir || '',
          projectEnv,
          taskExternalId: task.external_id || '',
          ...(retryNote ? { retryNote, retryNoteStepId: stepId } : {}),
        },
      });

      // Mastra's stream object exposes promise-shaped properties (e.g. `result`)
      // that throw when accessed if the stream has already errored synchronously.
      // Re-thrown rejections that escape the .result await get reported as
      // unhandledRejection — and main.ts kills the process. Wrap so any failure
      // is logged + funneled through onWorkflowError.
      const result = await output.result;

      logger.info('WorkflowService', `timeTravel result status: ${result?.status}`);
      // Workflow lifecycle callbacks (onFinish/onError) handle final state updates
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : null;
      logger.error('WorkflowService', `executeRetry failed for runId ${runId}, step ${stepId}: ${errorMessage}${stack ? '\n' + stack : ''}`);
      await this.lifecycle.onWorkflowError(runId, errorMessage).catch((hookErr) => {
        logger.warn('WorkflowService', `onWorkflowError hook failed: ${hookErr instanceof Error ? hookErr.message : String(hookErr)}`);
      });
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        current_step: null,
        context: { error: errorMessage },
      }).catch((dbErr) => {
        logger.warn('WorkflowService', `Failed to mark run ${runId} as FAILED after executeRetry error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      });
      await this.resetTaskToTodo(task.id);
    }
  }
}

export { WorkflowService };