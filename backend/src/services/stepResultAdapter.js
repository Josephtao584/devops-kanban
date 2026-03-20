import { validateStepResult } from './claudeStepResult.js';

export function adaptStepResult(executorType, executionResult) {
  return validateStepResult(executionResult?.rawResult);
}
