export type ExecutorType = 'CLAUDE_CODE' | 'CODEX' | 'OPENCODE';

export interface ExecutorConfig {
  type: ExecutorType;
  commandOverride?: string | null;
  args?: string[];
  env?: Record<string, string>;
  skills?: string[];
}

export interface ExecutorProcessHandle {
  pid?: number;
  kill?: (signal?: NodeJS.Signals | number) => boolean;
}

export interface ExecutorRawResult {
  summary: string;
}

export interface ExecutorExecutionInput {
  prompt: string;
  worktreePath: string;
  executorConfig?: ExecutorConfig | undefined;
  onSpawn?: ((proc: ExecutorProcessHandle) => void) | undefined;
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
