import { AsyncLocalStorage } from 'async_hooks';

const workflowExecutionContext = new AsyncLocalStorage();

export function runWithWorkflowExecutionContext(context, fn) {
  return workflowExecutionContext.run(context, fn);
}

export function getWorkflowExecutionContext() {
  return workflowExecutionContext.getStore() || null;
}
