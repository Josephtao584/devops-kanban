import { ensureMcpJsonInWorktree, cleanupMcpJson } from '../../utils/mcpSync.js';
import type { McpServerConfig } from '../../utils/mcpSync.js';
import {ExecutorType} from "../../types/executors.js";

type PrepareExecutionMcpInput = {
  executorType: ExecutorType;
  mcpServerConfigs: McpServerConfig[];
  executionPath: string;
};

async function prepareExecutionMcp({ executorType, mcpServerConfigs, executionPath }: PrepareExecutionMcpInput): Promise<void> {
  if (!mcpServerConfigs || mcpServerConfigs.length === 0) {
    await cleanupMcpJson(executionPath);
    return;
  }

  if (executorType === ExecutorType.CLAUDE_CODE || executorType === ExecutorType.OPEN_CODE) {
    await ensureMcpJsonInWorktree(mcpServerConfigs, executionPath);
  }
}

export { prepareExecutionMcp };
export type { PrepareExecutionMcpInput };
