import { ClaudeStepRunner } from './claudeStepRunner.js';
import type { Executor, ExecutorExecutionInput, ExecutorContinueInput, ExecutorExecutionResult } from '../../../types/executors.js';
import { buildEvent } from '../../../types/executors.js';

class ClaudeCodeExecutor implements Executor {
  runner: ClaudeStepRunner;

  constructor({ runner = new ClaudeStepRunner() }: { runner?: ClaudeStepRunner } = {}) {
    this.runner = runner;
  }

  async execute({
    prompt,
    worktreePath,
    onEvent,
    onProviderState,
    abortSignal,
    onAskUser,
  }: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      ...(abortSignal ? { abortSignal } : {}),
      ...(onEvent || onProviderState ? { onEvent: async (event) => {
        if (onProviderState && event.kind === 'status' && event.payload?.session_id) {
          await onProviderState({ providerSessionId: event.payload.session_id as string });
        }
        await onEvent?.(event);
      }} : {}),
      ...(onAskUser ? { onAskUser } : {}),
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
    onEvent,
    onProviderState,
    abortSignal,
    onAskUser,
  }: ExecutorContinueInput): Promise<ExecutorExecutionResult> {
    const args = [];
    if (providerSessionId) {
      args.push('--resume', providerSessionId);
    }

    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig: { args },
      ...(abortSignal ? { abortSignal } : {}),
      ...(onEvent || onProviderState ? { onEvent: async (event) => {
        if (onProviderState && event.kind === 'status' && event.payload?.session_id) {
          await onProviderState({ providerSessionId: event.payload.session_id as string });
        }
        await onEvent?.(event);
      }} : {}),
      ...(onAskUser ? { onAskUser } : {}),
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

export { ClaudeCodeExecutor };
