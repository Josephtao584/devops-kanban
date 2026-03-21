import { ClaudeStepRunner } from './claudeStepRunner.js';

class ClaudeCodeExecutor {
  constructor({ runner = new ClaudeStepRunner() } = {}) {
    this.runner = runner;
  }

  async execute({ prompt, worktreePath, executorConfig = {}, onSpawn }) {
    const result = await this.runner.runStep({
      prompt,
      worktreePath,
      executorConfig,
      onSpawn,
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
