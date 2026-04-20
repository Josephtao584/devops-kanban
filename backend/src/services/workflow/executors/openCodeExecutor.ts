import { OpenCodeStepRunner } from './openCodeStepRunner.js';
import type { Executor, ExecutorExecutionInput, ExecutorContinueInput, ExecutorExecutionResult } from '../../../types/executors.js';
import { buildEvent } from '../../../types/executors.js';

class OpenCodeExecutor implements Executor {
  runner: OpenCodeStepRunner;

  constructor({ runner = new OpenCodeStepRunner() }: { runner?: OpenCodeStepRunner } = {}) {
    this.runner = runner;
  }

  async execute({
    prompt,
    worktreePath,
    executorConfig,
    onEvent,
    onProviderState,
    abortSignal,
  }: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig: { env: executorConfig?.env },
      ...(abortSignal ? { abortSignal } : {}),
      ...(onEvent || onProviderState ? { onEvent: async (event) => {
        if (onProviderState && event.kind === 'status' && event.payload?.session_id) {
          await onProviderState({ providerSessionId: event.payload.session_id as string });
          if (event.payload?.step_type === 'step_start' || event.payload?.step_type === 'step_finish') {
            return;
          }
        }
        await onEvent?.(event);
      }} : {}),
    });

    if (result.stderr) {
      await onEvent?.(buildEvent('stream_chunk', 'system', result.stderr, { stream: 'stderr' }));
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      proc: result.proc,
      rawResult: result.parsedResult,
    };
  }

  async continue({
    prompt,
    worktreePath,
    providerSessionId,
    executorConfig,
    onEvent,
    onProviderState,
    abortSignal,
  }: ExecutorContinueInput): Promise<ExecutorExecutionResult> {
    const cliOptions: { session?: string } = {};
    if (providerSessionId) {
      cliOptions.session = providerSessionId;
    }

    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig: { env: executorConfig?.env },
      cliOptions,
      ...(abortSignal ? { abortSignal } : {}),
      ...(onEvent || onProviderState ? { onEvent: async (event) => {
        if (onProviderState && event.kind === 'status' && event.payload?.session_id) {
          await onProviderState({ providerSessionId: event.payload.session_id as string });
          if (event.payload?.step_type === 'step_start' || event.payload?.step_type === 'step_finish') {
            return;
          }
        }
        await onEvent?.(event);
      }} : {}),
    });

    if (result.stderr) {
      await onEvent?.(buildEvent('stream_chunk', 'system', result.stderr, { stream: 'stderr' }));
    }

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      proc: result.proc,
      rawResult: result.parsedResult,
    };
  }
}

export { OpenCodeExecutor };
