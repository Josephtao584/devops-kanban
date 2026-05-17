import { existsSync } from 'fs';
import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { WorkflowInstanceService } from '../workflowInstanceService.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import {
  WorkflowInstanceEntity,
  WorkflowRunEntity,
  WorkflowStepEntity,
  WorkflowTemplateEntity,
  WorkflowTemplateStepEntity,
} from '../../types/entities.js';
import { ValidationError, NotFoundError, ConflictError, BusinessError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { type WorkflowTaskRecord } from '../../types/workflow.js';

/**
 * Result of phase-1 loop preparation: the new run is persisted and the
 * task's workflow_run_id pointer is updated. The caller (WorkflowService) is
 * responsible for fire-and-forget dispatch of executeWorkflow against the
 * returned newRun.
 */
type CreateLoopRunResult = {
  newRun: WorkflowRunEntity;
  instance: WorkflowInstanceEntity;
  task: WorkflowTaskRecord;
  parent: WorkflowRunEntity;
};

class WorkflowLoopService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  instanceService: WorkflowInstanceService;
  templateService: WorkflowTemplateService;

  constructor({ workflowRunRepo, taskRepo, instanceService, templateService }: {
    workflowRunRepo: WorkflowRunRepository;
    taskRepo: TaskRepository;
    instanceService: WorkflowInstanceService;
    templateService: WorkflowTemplateService;
  }) {
    this.workflowRunRepo = workflowRunRepo;
    this.taskRepo = taskRepo;
    this.instanceService = instanceService;
    this.templateService = templateService;
  }

  /**
   * Validate the loop request and create a new "loop" workflow run that
   * re-executes a portion of a failed parent run. Steps before `fromStepId`
   * are inherited from the parent as SKIPPED; steps from `fromStepId` onward
   * are reset to PENDING. The new run reuses the parent's worktree and
   * branch, increments iteration, and carries forward the failure context
   * for prompt augmentation.
   *
   * Returns the loaded instance, task, and parent so that the caller can
   * dispatch executeWorkflow without re-fetching them.
   */
  async createLoopRun(
    parentRunId: number,
    fromStepId: string,
    failureContext?: { failed_step_id: string; error: string; summary: string | null },
    override = false,
  ): Promise<CreateLoopRunResult> {
    logger.info('WorkflowLoopService', `createLoopRun called for parentRunId: ${parentRunId}, fromStepId: ${fromStepId}, override: ${override}`);

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

    const instance = await this.instanceService.getByInstanceId(parent.workflow_instance_id);
    if (!instance) {
      throw new NotFoundError('未找到工作流实例', 'Workflow instance not found', { instanceId: parent.workflow_instance_id });
    }
    const template = await this.templateService.getTemplateById(instance.template_id);
    const maxLoops = template?.maxLoops ?? 0;

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

    const newIteration = parent.iteration + 1;
    if (!override && newIteration > maxLoops) {
      throw new BusinessError(
        `无法循环：迭代将达到 ${newIteration}，超过 maxLoops=${maxLoops}`,
        `Cannot loop: would reach iteration ${newIteration}, exceeds maxLoops=${maxLoops}`,
        { newIteration, maxLoops },
      );
    }

    const inflight = await this.workflowRunRepo.findInFlightChild(parentRunId);
    if (inflight) {
      throw new ConflictError(
        `父运行 ${parentRunId} 已有进行中的子运行 (${inflight.id})`,
        `Parent run ${parentRunId} already has an in-flight child run (${inflight.id})`,
        { parentRunId, childRunId: inflight.id },
      );
    }

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
      // The repo's atomic check returns the conflicting row. If it shares our
      // parent_run_id, the conflict is a concurrent loop attempt; otherwise
      // the task already has some other active run. Distinguish so the
      // user-facing message matches the actual collision.
      const existing = result.existing;
      if (existing && existing.parent_run_id === parentRunId) {
        throw new ConflictError(
          `父运行 ${parentRunId} 已有进行中的子运行 (${existing.id})`,
          `Parent run ${parentRunId} already has an in-flight child run (${existing.id})`,
          { parentRunId, childRunId: existing.id },
        );
      }
      throw new ConflictError(
        '无法创建循环运行：任务已有活跃运行',
        'Failed to create loop run: task already has an active run',
        { parentRunId, existingRunId: existing?.id },
      );
    }

    const newRun = result.created;
    await this.taskRepo.update(parent.task_id, { workflow_run_id: newRun.id }).catch(() => {});

    return { newRun, instance, task, parent };
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
  async enrichWithTemplateSnapshot(
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
}

export { WorkflowLoopService };
export type { CreateLoopRunResult };
