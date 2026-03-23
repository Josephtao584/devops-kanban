import { ClaudeStepRunner } from './claudeStepRunner.js';
import { ExecutionEventSink } from '../executionEventSink.js';
import type { Executor, ExecutorExecutionInput, ExecutorExecutionResult } from '../../../types/executors.js';

class ClaudeCodeExecutor implements Executor {
  runner: ClaudeStepRunner;

  constructor({ runner = new ClaudeStepRunner() }: { runner?: ClaudeStepRunner } = {}) {
    this.runner = runner;
  }

  async execute({
    prompt,
    worktreePath,
    executorConfig,
    onSpawn,
    onEvent,
    onProviderState,
  }: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    const sink = new ExecutionEventSink({ onEvent, onProviderState });
    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig,
      ...(onSpawn ? { onSpawn } : {}),
    });

    await sink.appendMessage(result.parsedResult.summary);

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
