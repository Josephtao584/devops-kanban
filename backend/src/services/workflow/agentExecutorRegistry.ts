import { ClaudeCodeExecutor } from './executors/claudeCodeExecutor.js';
import { CodexExecutor } from './executors/codexExecutor.js';
import { OpenCodeExecutor } from './executors/opencodeExecutor.js';

class AgentExecutorRegistry {
  executors: Record<string, unknown>;

  constructor({ executors }: { executors?: Record<string, unknown> } = {}) {
    this.executors = executors || {
      CLAUDE_CODE: new ClaudeCodeExecutor(),
      CODEX: new CodexExecutor(),
      OPENCODE: new OpenCodeExecutor(),
    };
  }

  getExecutor(type: string) {
    const executor = this.executors[type];
    if (!executor) {
      throw new Error(`Unsupported executor type: ${type}`);
    }
    return executor as {
      execute: (input: unknown) => Promise<unknown>;
    };
  }
}

export { AgentExecutorRegistry };
