/**
 * Workflow Service
 * Business logic for triggering, querying, and cancelling workflows.
 */

import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { TaskRepository } from '../../repositories/taskRepository.js';
import { ProjectRepository } from '../../repositories/projectRepository.js';
import { getDevWorkflow, buildWorkflowSharedState } from './workflows.js';
import { runWithWorkflowExecutionContext } from './workflowExecutionContext.js';

const STEP_DEFINITIONS = [
  { step_id: 'requirement-design', name: '需求设计' },
  { step_id: 'code-development', name: '代码开发' },
  { step_id: 'testing', name: '测试' },
  { step_id: 'code-review', name: '代码审查' },
];

class WorkflowService {
  constructor({ workflowRunRepo, taskRepo, projectRepo } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this._activeRuns = new Map();
  }

  /**
   * Start a workflow for a given task
   */
  async startWorkflow(taskId) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }

    const executionPath = await this._resolveExecutionPath(task);

    const existing = await this.workflowRunRepo.findByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING')) {
      const error = new Error('Task already has an active workflow run');
      error.statusCode = 409;
      throw error;
    }

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

  async _resolveExecutionPath(task) {
    if (task.worktree_path) {
      return task.worktree_path;
    }

    const project = await this.projectRepo.findById(task.project_id);
    if (project?.local_path) {
      return project.local_path;
    }

    const error = new Error('No workspace path configured for workflow execution');
    error.statusCode = 400;
    throw error;
  }

  _buildInitialWorkflowState(task) {
    return buildWorkflowSharedState({
      taskTitle: task.title || 'Untitled Task',
      taskDescription: task.description || '',
      worktreePath: task.execution_path,
    });
  }

  async _executeWorkflow(runId, task) {
    let cancelled = false;
    this._activeRuns.set(runId, {
      cancel: () => { cancelled = true; },
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

      console.log(`[Workflow] Starting workflow run #${runId} for task #${task.id}`);

      const context = {
        cancelled: false,
        proc: null,
        worktreePath: inputData.worktreePath,
      };

      this._activeRuns.set(runId, {
        cancel: () => { context.cancelled = true; },
        proc: null,
        context,
      });

      const mastraRun = await workflow.createRun();
      const stream = await runWithWorkflowExecutionContext(context, async () => mastraRun.stream({ inputData, initialState }));

      for await (const event of stream.fullStream) {
        console.log(`[Workflow] Stream event: ${event.type}`, event.payload?.stepName || '');

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

      console.log(`[Workflow] Mastra workflow finished, status: ${result.status}`);

      if (result.status === 'success') {
        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: result.result || {},
        });

        await this.taskRepo.update(task.id, { status: 'DONE' });

        console.log(`[Workflow] Run #${runId} completed successfully, task #${task.id} marked DONE`);
        console.log('[Workflow] Result:', JSON.stringify(result.result));
      } else {
        await this.workflowRunRepo.update(runId, {
          status: 'FAILED',
          context: { error: result.error || 'Workflow failed' },
        });
        console.error(`[Workflow] Run #${runId} failed:`, result.error || result);
      }
    } catch (err) {
      console.error(`[Workflow] Run #${runId} error:`, err.message);
      console.error(err.stack);
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: { error: err.message },
      }).catch(() => {});
    } finally {
      this._activeRuns.delete(runId);
    }
  }

  async getWorkflowRun(runId) {
    return await this.workflowRunRepo.findById(runId);
  }

  async getWorkflowRunByTask(taskId) {
    return await this.workflowRunRepo.findByTaskId(taskId);
  }

  async getAllRunsByTask(taskId) {
    return await this.workflowRunRepo.findAllByTaskId(taskId);
  }

  async cancelWorkflow(runId) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      const error = new Error('Workflow run not found');
      error.statusCode = 404;
      throw error;
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      const error = new Error(`Cannot cancel workflow in status: ${run.status}`);
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
