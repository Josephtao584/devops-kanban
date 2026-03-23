import type { ExecutorProviderState, WorkflowExecutionEvent, WorkflowExecutionEventKind, WorkflowExecutionEventRole } from '../../types/executors.js';

type ExecutionEventSinkCallbacks = {
  onEvent?: ((event: WorkflowExecutionEvent) => void) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void) | undefined;
};

type ExecutionEventPayload = Record<string, unknown>;

class ExecutionEventSink {
  onEvent: ((event: WorkflowExecutionEvent) => void) | undefined;
  onProviderState: ((providerState: ExecutorProviderState) => void) | undefined;

  constructor({ onEvent, onProviderState }: ExecutionEventSinkCallbacks = {}) {
    this.onEvent = onEvent;
    this.onProviderState = onProviderState;
  }

  emit(event: WorkflowExecutionEvent) {
    this.onEvent?.({
      ...event,
      payload: event.payload ?? {},
    });
  }

  providerState(providerState: ExecutorProviderState) {
    this.onProviderState?.(providerState);
  }

  status(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('status', 'system', content, payload);
  }

  message(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('message', 'assistant', content, payload);
  }

  toolCall(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('tool_call', 'assistant', content, payload);
  }

  toolResult(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('tool_result', 'tool', content, payload);
  }

  streamChunk(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('stream_chunk', 'assistant', content, payload);
  }

  artifact(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('artifact', 'assistant', content, payload);
  }

  error(content: string, payload: ExecutionEventPayload = {}) {
    this.emitCanonical('error', 'system', content, payload);
  }

  private emitCanonical(kind: WorkflowExecutionEventKind, role: WorkflowExecutionEventRole, content: string, payload: ExecutionEventPayload) {
    this.emit({ kind, role, content, payload });
  }
}

export { ExecutionEventSink };
export type { ExecutionEventPayload, ExecutionEventSinkCallbacks };
