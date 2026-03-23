import type { ExecutorProviderState, WorkflowExecutionEvent, WorkflowExecutionEventKind, WorkflowExecutionEventRole } from '../../types/executors.js';

type ExecutionEventSinkCallbacks = {
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;
};

type ExecutionEventPayload = Record<string, unknown>;
type WorkflowStream = 'stdout' | 'stderr';

class ExecutionEventSink {
  onEvent: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;

  constructor({ onEvent, onProviderState }: ExecutionEventSinkCallbacks = {}) {
    this.onEvent = onEvent;
    this.onProviderState = onProviderState;
  }

  async append(event: WorkflowExecutionEvent) {
    await this.onEvent?.({
      ...event,
      payload: event.payload ?? {},
    });
  }

  async appendProviderState(providerState: ExecutorProviderState) {
    await this.onProviderState?.(providerState);
  }

  async appendMessage(content: string, role: WorkflowExecutionEventRole = 'assistant') {
    await this.appendCanonical('message', role, content, {});
  }

  async appendToolCall(toolName: string, argumentsValue: unknown) {
    await this.appendCanonical('tool_call', 'assistant', toolName, { tool_name: toolName, arguments: argumentsValue });
  }

  async appendToolResult(toolName: string, result: unknown) {
    await this.appendCanonical('tool_result', 'tool', toolName, { tool_name: toolName, result });
  }

  async appendStatus(from: string, to: string) {
    await this.appendCanonical('status', 'system', `${from} -> ${to}`, { from, to });
  }

  async appendError(content: string, payload: ExecutionEventPayload = {}) {
    await this.appendCanonical('error', 'system', content, payload);
  }

  async appendArtifact(content: string, payload: ExecutionEventPayload) {
    await this.appendCanonical('artifact', 'assistant', content, payload);
  }

  async appendStreamChunk(content: string, stream: WorkflowStream) {
    await this.appendCanonical('stream_chunk', stream === 'stderr' ? 'system' : 'assistant', content, { stream });
  }

  private async appendCanonical(kind: WorkflowExecutionEventKind, role: WorkflowExecutionEventRole, content: string, payload: ExecutionEventPayload) {
    await this.append({ kind, role, content, payload });
  }
}

export { ExecutionEventSink };
export type { ExecutionEventPayload, ExecutionEventSinkCallbacks, WorkflowStream };
