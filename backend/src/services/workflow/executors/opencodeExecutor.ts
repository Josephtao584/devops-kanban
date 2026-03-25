import { normalizeExecutorRawResult, normalizeExecutorEvents } from '../stepResultAdapter.js';
import type { Executor, ExecutorContinueInput,
    ExecutorExecutionInput,
    ExecutorExecutionResult,
    ExecutorRawResult
} from '../../../types/executors.js';

type ExecutorRunImpl = (input: ExecutorExecutionInput) => Promise<ExecutorRawResult> | ExecutorRawResult;

class OpenCodeExecutor implements Executor {
    runImpl: ExecutorRunImpl | undefined;

    constructor({runImpl}: { runImpl?: ExecutorRunImpl } = {}) {
        this.runImpl = runImpl;
    }

    continue(input: ExecutorContinueInput): Promise<ExecutorExecutionResult> {
        console.log(input)
        throw new Error("Method not implemented.");
    }

  async execute(input: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
    if (!this.runImpl) {
      throw new Error('OpenCode executor is not implemented');
    }

    const rawResult = normalizeExecutorRawResult(await this.runImpl(input));

    if (!rawResult) {
      throw new Error('OpenCode executor did not return a result');
    }

    for (const event of normalizeExecutorEvents(rawResult)) {
      await input.onEvent?.(event);
    }

    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
      proc: null,
      rawResult,
    };
  }
}

export { OpenCodeExecutor };
