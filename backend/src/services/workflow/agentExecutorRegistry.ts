import { ClaudeCodeExecutor } from './executors/claudeCodeExecutor.js';
import { Executor, ExecutorMap, ExecutorType } from '../../types/executors.js';

class AgentExecutorRegistry {
  executors: ExecutorMap;

  constructor({ executors }: { executors?: ExecutorMap } = {}) {
      this.executors = executors ?? {
          [ExecutorType.CLAUDE_CODE]: new ClaudeCodeExecutor(),
      };
  }

  getExecutor(type: ExecutorType): Executor {
    const executor = this.executors[type];
    if (!executor) {
      throw new Error(`Unsupported executor type: ${type}`);
    }
    return executor;
  }
}

export { AgentExecutorRegistry };
