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
] as const;

interface ActiveRunContext {
  cancel?: () => void;
  proc?: { kill?: (signal: string) => void } | null;
  context?: {
    cancelled?: boolean;
    proc?: { kill?: (signal: string) => void } | null;
    worktreePath?: string;
  };
}

type WorkflowStreamEvent = {
  type: string;
  payload?: {
    stepName?: string;
    result?: unknown;
    error?: string;
  };
};

type WorkflowRunResult = {
  status: string;
  result?: Record<string, unknown>;
  error?: string;
};

class WorkflowService {
  workflowRunRepo: WorkflowRunRepository;
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  _activeRuns: Map<number, ActiveRunContext>;

  constructor({ workflowRunRepo, taskRepo, projectRepo }: { workflowRunRepo?: WorkflowRunRepository; taskRepo?: TaskRepository; projectRepo?: ProjectRepository } = {}) {
    this.workflowRunRepo = workflowRunRepo || new WorkflowRunRepository();
    this.taskRepo = taskRepo || new TaskRepository();
    this.projectRepo = projectRepo || new ProjectRepository();
    this._activeRuns = new Map();
  }

  async startWorkflow(taskId: number) {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const executionPath = await this._resolveExecutionPath(task as { worktree_path?: string | null; project_id: number });
    const existing = await this.workflowRunRepo.findByTaskId(taskId);
    if (existing && (existing.status === 'RUNNING' || existing.status === 'PENDING')) {
      const error = new Error('Task already has an active workflow run') as Error & { statusCode?: number };
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
      branch: (task as { worktree_branch?: string | null }).worktree_branch || `task/${taskId}`,
      context: {},
    });

    await this.taskRepo.update(taskId, { workflow_run_id: run.id });
    this._executeWorkflow(run.id, { ...(task as Record<string, unknown>), execution_path: executionPath }).catch((err) => {
      console.error(`[Workflow] Fatal error in workflow run #${run.id}:`, err);
    });

    return run;
  }

  async _resolveExecutionPath(task: { worktree_path?: string | null; project_id: number }) {
    if (task.worktree_path) {
      return task.worktree_path;
    }

    const project = await this.projectRepo.findById(task.project_id);
    if (project?.local_path) {
      return project.local_path as string;
    }

    const error = new Error('No workspace path configured for workflow execution') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  _buildInitialWorkflowState(task: { title?: string; description?: string; execution_path: string }) {
    return buildWorkflowSharedState({
      taskTitle: task.title || 'Untitled Task',
      taskDescription: task.description || '',
      worktreePath: task.execution_path,
    });
  }

  async _executeWorkflow(runId: number, task: Record<string, unknown>) {
    let cancelled = false;
    this._activeRuns.set(runId, {
      cancel: () => {
        cancelled = true;
      },
    });

    try {
      await this.workflowRunRepo.update(runId, { status: 'RUNNING' });
      const workflow = getDevWorkflow();
      const inputData = {
        taskId: task.id as number,
        taskTitle: (task.title as string | undefined) || 'Untitled Task',
        taskDescription: (task.description as string | undefined) || '',
        worktreePath: task.execution_path as string,
      };
      const initialState = this._buildInitialWorkflowState(task as { title?: string; description?: string; execution_path: string });

      const context = {
        cancelled: false,
        proc: null as { kill?: (signal: string) => void } | null,
        worktreePath: inputData.worktreePath,
      };

      this._activeRuns.set(runId, {
        cancel: () => {
          context.cancelled = true;
        },
        proc: null,
        context,
      });

      const mastraRun = await workflow.createRun();
      const stream = await runWithWorkflowExecutionContext(context, async () => mastraRun.stream({ inputData, initialState })) as {
        fullStream: AsyncIterable<WorkflowStreamEvent>;
        result: Promise<WorkflowRunResult>;
      };

      for await (const event of stream.fullStream) {
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
      if (result.status === 'success') {
        await this.workflowRunRepo.update(runId, {
          status: 'COMPLETED',
          context: (result.result || {}) as Record<string, unknown>,
        });
        await this.taskRepo.update(task.id as number, { status: 'DONE' });
      } else {
        await this.workflowRunRepo.update(runId, {
          status: 'FAILED',
          context: { error: result.error || 'Workflow failed' },
        });
      }
    } catch (err) {
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: { error: (err as Error).message },
      }).catch(() => {});
    } finally {
      this._activeRuns.delete(runId);
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
      const error = new Error('Workflow run not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      const error = new Error(`Cannot cancel workflow in status: ${run.status}`) as Error & { statusCode?: number };
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
