/**
 * Workflow Service
 * Business logic for triggering, querying, and cancelling workflows.
 */

import { WorkflowRunRepository } from '../repositories/workflowRunRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { getDevWorkflow } from '../workflows/index.js';

const STEP_DEFINITIONS = [
  { step_id: 'requirement-design', name: '需求设计' },
  { step_id: 'code-development', name: '代码开发' },
  { step_id: 'testing', name: '测试' },
  { step_id: 'code-review', name: '代码审查' },
];

class WorkflowService {
  constructor() {
    this.workflowRunRepo = new WorkflowRunRepository();
    this.taskRepo = new TaskRepository();
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

    // Check no active workflow for this task
    const existing = await this.workflowRunRepo.findByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING')) {
      const error = new Error('Task already has an active workflow run');
      error.statusCode = 409;
      throw error;
    }

    // Create workflow run record
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
      worktree_path: task.worktree_path || '/tmp/mock-worktree',
      branch: task.worktree_branch || `task/${taskId}`,
      context: {},
    });

    // Update task with workflow_run_id
    await this.taskRepo.update(taskId, { workflow_run_id: run.id });

    // Start workflow execution asynchronously
    this._executeWorkflow(run.id, task).catch((err) => {
      console.error(`[Workflow] Fatal error in workflow run #${run.id}:`, err);
    });

    return run;
  }

  /**
   * Execute the workflow (called asynchronously)
   * @private
   */
  async _executeWorkflow(runId, task) {
    let cancelled = false;
    this._activeRuns.set(runId, {
      cancel: () => { cancelled = true; },
    });

    try {
      // Update run status to RUNNING
      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

      // Get the Mastra workflow (synchronous after init)
      const workflow = getDevWorkflow();

      // Build input data
      const inputData = {
        taskId: task.id,
        taskTitle: task.title || 'Untitled Task',
        taskDescription: task.description || '',
        requirementContent: task.requirement_content || task.description || 'No requirements provided.',
        worktreePath: task.worktree_path || '/tmp/mock-worktree',
      };

      console.log(`[Workflow] Starting workflow run #${runId} for task #${task.id}`);

      // Run the Mastra workflow with streaming to get step-level events
      const mastraRun = await workflow.createRun();
      const stream = mastraRun.stream({ inputData });

      // Process stream events to update step status in real-time
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
          await this.workflowRunRepo.updateStep(runId, stepId, {
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
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

      // Get the final result
      const result = await stream.result;

      console.log(`[Workflow] Mastra workflow finished, status: ${result.status}`);

      if (result.status === 'success') {
        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: result.result || {},
        });

        // Workflow succeeded → update task status to DONE
        await this.taskRepo.update(task.id, { status: 'DONE' });

        console.log(`[Workflow] Run #${runId} completed successfully, task #${task.id} marked DONE`);
        console.log(`[Workflow] Result:`, JSON.stringify(result.result));
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
      activeRun.cancel();
    }

    return await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
  }
}

export { WorkflowService };
