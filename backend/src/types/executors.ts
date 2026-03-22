export interface ExecutorConfig {
  type: string;
  commandOverride?: string | null;
  args?: string[];
  env?: Record<string, string>;
}

export interface ExecutorExecutionInput {
  prompt: string;
  worktreePath: string;
  executorConfig?: ExecutorConfig;
  onSpawn?: (proc: unknown) => void;
}

export interface ExecutorExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  proc: unknown;
  rawResult: {
    summary: string;
  };
}
