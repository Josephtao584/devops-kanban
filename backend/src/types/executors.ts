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

export type WorkflowExecutionEventKind = 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk';

export type WorkflowExecutionEventRole = 'assistant' | 'system' | 'tool' | 'user';

export interface WorkflowExecutionEvent {
  kind: WorkflowExecutionEventKind;
  role: WorkflowExecutionEventRole;
  content: string;
  payload?: Record<string, unknown>;
}

export interface ExecutorProviderState {
  providerSessionId?: string | null;
  resumeToken?: string | null;
  checkpointRef?: string | null;
}

export interface ExecutorExecutionInput {
  prompt: string;
  worktreePath: string;
  executorConfig?: ExecutorConfig | undefined;
  onSpawn?: ((proc: ExecutorProcessHandle) => void) | undefined;
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;
  abortSignal?: AbortSignal | undefined;
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
