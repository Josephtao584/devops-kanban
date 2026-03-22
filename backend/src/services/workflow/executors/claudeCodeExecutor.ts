import { ClaudeStepRunner } from './claudeStepRunner.js';
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
  }: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig,
      ...(onSpawn ? { onSpawn } : {}),
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      proc: result.proc as ExecutorExecutionResult['proc'],
      rawResult: result.parsedResult,
    };
  }
}

export { ClaudeCodeExecutor };
