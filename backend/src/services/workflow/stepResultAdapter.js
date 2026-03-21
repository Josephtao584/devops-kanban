import { validateStepResult } from './executors/claudeStepResult.js';

export function adaptStepResult(executorType, executionResult) {
  return validateStepResult(executionResult?.rawResult);
}
