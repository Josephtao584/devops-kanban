import { ensureMcpJsonInWorktree, ensureOpenCodeMcpJson, cleanupMcpJson, cleanupOpenCodeMcpJson } from '../../utils/mcpSync.js';
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
    await cleanupOpenCodeMcpJson(executionPath);
    return;
  }

  if (executorType === ExecutorType.OPEN_CODE) {
    await ensureOpenCodeMcpJson(mcpServerConfigs, executionPath);
    await cleanupMcpJson(executionPath);
  } else if (executorType === ExecutorType.CLAUDE_CODE) {
    await ensureMcpJsonInWorktree(mcpServerConfigs, executionPath);
  }
}

export { prepareExecutionMcp };
export type { PrepareExecutionMcpInput };
