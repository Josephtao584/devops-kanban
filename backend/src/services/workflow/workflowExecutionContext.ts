import { AsyncLocalStorage } from 'node:async_hooks';

type WorkflowExecutionContextStore = {
  cancelled?: boolean;
  proc?: unknown;
  worktreePath?: string;
};

const workflowExecutionContext = new AsyncLocalStorage<WorkflowExecutionContextStore>();

export function runWithWorkflowExecutionContext<T>(context: WorkflowExecutionContextStore, fn: () => Promise<T>): Promise<T> {
  return workflowExecutionContext.run(context, fn);
}

export function getWorkflowExecutionContext(): WorkflowExecutionContextStore | null {
  return workflowExecutionContext.getStore() || null;
}
