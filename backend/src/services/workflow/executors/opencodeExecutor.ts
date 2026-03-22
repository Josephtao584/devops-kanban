import type { Executor, ExecutorExecutionInput, ExecutorExecutionResult, ExecutorRawResult } from '../../../types/executors.js';

type ExecutorRunImpl = (input: ExecutorExecutionInput) => Promise<ExecutorRawResult> | ExecutorRawResult;

class OpenCodeExecutor implements Executor {
  runImpl: ExecutorRunImpl | undefined;

  constructor({ runImpl }: { runImpl?: ExecutorRunImpl } = {}) {
    this.runImpl = runImpl;
  }

  async execute(input: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    if (!this.runImpl) {
      throw new Error('OpenCode executor is not implemented');
    }

    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
      proc: null,
      rawResult: await this.runImpl(input),
    };
  }
}

export { OpenCodeExecutor };
