import { ClaudeStepRunner } from './claudeStepRunner.js';

class ClaudeCodeExecutor {
  runner: ClaudeStepRunner;

  constructor({ runner = new ClaudeStepRunner() }: { runner?: ClaudeStepRunner } = {}) {
    this.runner = runner;
  }

  async execute({
    prompt,
    worktreePath,
    executorConfig = {},
    onSpawn,
  }: {
    prompt: string;
    worktreePath: string;
    executorConfig?: unknown;
    onSpawn?: ((proc: unknown) => void) | undefined;
  }) {
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
      proc: result.proc,
      rawResult: result.parsedResult,
    };
  }
}

export { ClaudeCodeExecutor };
