import { validateStepResult } from './executors/claudeStepResult.js';

export function adaptStepResult(executorType: string, executionResult: { rawResult?: { summary: string } }) {
  return validateStepResult(executionResult?.rawResult);
}
