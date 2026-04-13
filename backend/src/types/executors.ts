export enum ExecutorType {
    CLAUDE_CODE = 'CLAUDE_CODE',
    OPEN_CODE = 'OPEN_CODE',
}

export interface ExecutorConfig {
  type: ExecutorType;
  skills?: number[];
  mcpServers?: number[];
}

export interface ExecutorProcessHandle {
  pid?: number;
  kill?: (signal?: NodeJS.Signals | number) => boolean;
}

export interface ExecutorRawResult {
  summary: string;
}

export type WorkflowExecutionEventKind = 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk' | 'ask_user';

export interface AskUserQuestionItem {
  question: string;
  header?: string;
  options?: Array<{ label: string; value: string; description?: string }>;
  multiSelect?: boolean;
}

export interface AskUserQuestionData {
  tool_use_id: string;
  questions: AskUserQuestionItem[];
}

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
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;
  abortSignal?: AbortSignal | undefined;
  onAskUser?: ((data: AskUserQuestionData) => void | Promise<void>) | undefined;
}

export interface ExecutorContinueInput {
  prompt: string;
  worktreePath: string;
  providerSessionId?: string;
  executorConfig?: ExecutorConfig;
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>);
  onProviderState?: ((providerState: ExecutorProviderState) => void | Promise<void>);
  abortSignal?: AbortSignal;
  onAskUser?: ((data: AskUserQuestionData) => void | Promise<void>) | undefined;
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
  continue(input: ExecutorContinueInput): Promise<ExecutorExecutionResult>;
}

export type ExecutorMap = Record<ExecutorType, Executor>;

export function buildEvent(
  kind: WorkflowExecutionEventKind,
  role: WorkflowExecutionEventRole,
  content: string,
  payload: Record<string, unknown> = {}
): WorkflowExecutionEvent {
  return { kind, role, content, payload };
}
