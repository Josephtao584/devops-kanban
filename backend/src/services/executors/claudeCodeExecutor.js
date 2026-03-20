import { ClaudeStepRunner } from '../claudeStepRunner.js';

class ClaudeCodeExecutor {
  constructor({ runner = new ClaudeStepRunner() } = {}) {
    this.runner = runner;
  }

  async execute({ stepId, worktreePath, taskTitle, taskDescription, previousSummary = '', executorConfig = {}, onSpawn }) {
    const result = await this.runner.runStep({
      stepId,
      worktreePath,
      taskTitle,
      taskDescription,
      previousSummary,
      executorConfig,
      onSpawn,
    });

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      proc: result.proc,
      resultFilePath: result.resultFilePath,
      rawResult: result.parsedResult,
    };
  }
}

export { ClaudeCodeExecutor };
