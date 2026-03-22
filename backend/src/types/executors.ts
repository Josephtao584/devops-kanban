export type ExecutorType = 'CLAUDE_CODE' | 'CODEX' | 'OPENCODE';

export interface ExecutorConfig {
  type: string;
  commandOverride?: string | null;
  args?: string[];
  env?: Record<string, string>;
}

export interface ExecutorProcessHandle {
  kill?: (signal: string) => void;
}

export interface ExecutorRawResult {
  summary: string;
}

export interface ExecutorExecutionInput {
  prompt: string;
  worktreePath: string;
  executorConfig?: ExecutorConfig;
  onSpawn?: (proc: ExecutorProcessHandle | unknown) => void;
}

export interface ExecutorExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  proc: ExecutorProcessHandle | null;
  rawResult: ExecutorRawResult;
}

export interface Executor {
  execute(input: ExecutorExecutionInput): Promise<ExecutorExecutionResult>;
}

export type ExecutorMap = Record<ExecutorType, Executor>;
