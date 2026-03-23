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
    await this.onEvent?.(this.normalizeEvent(event));
  }

  async appendProviderState(providerState: ExecutorProviderState) {
    await this.onProviderState?.(providerState);
  }

  async appendMessage(content: string, role: WorkflowExecutionEventRole = 'assistant') {
    await this.append(this.buildEvent('message', role, content, {}));
  }

  async appendToolCall(toolName: string, argumentsValue: unknown) {
    await this.append(this.buildEvent('tool_call', 'assistant', toolName, { tool_name: toolName, arguments: argumentsValue }));
  }

  async appendToolResult(toolName: string, result: unknown) {
    await this.append(this.buildEvent('tool_result', 'tool', toolName, { tool_name: toolName, result }));
  }

  async appendStatus(from: string, to: string) {
    await this.append(this.buildEvent('status', 'system', `${from} -> ${to}`, { from, to }));
  }

  async appendError(content: string, payload: ExecutionEventPayload = {}) {
    await this.append(this.buildEvent('error', 'system', content, payload));
  }

  async appendArtifact(content: string, payload: ExecutionEventPayload) {
    await this.append(this.buildEvent('artifact', 'assistant', content, payload));
  }

  async appendStreamChunk(content: string, stream: WorkflowStream) {
    await this.append(this.buildEvent('stream_chunk', stream === 'stderr' ? 'system' : 'assistant', content, { stream }));
  }

  private buildEvent(kind: WorkflowExecutionEventKind, role: WorkflowExecutionEventRole, content: string, payload: ExecutionEventPayload): WorkflowExecutionEvent {
    return { kind, role, content, payload };
  }

  private normalizeEvent(event: WorkflowExecutionEvent): WorkflowExecutionEvent {
    const payload = event.payload ?? {};

    switch (event.kind) {
      case 'tool_call': {
        const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : event.content;
        return this.buildEvent('tool_call', 'assistant', toolName, { tool_name: toolName, arguments: payload.arguments });
      }
      case 'tool_result': {
        const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : event.content;
        return this.buildEvent('tool_result', 'tool', toolName, { tool_name: toolName, result: payload.result });
      }
      case 'status': {
        if (typeof payload.from === 'string' && typeof payload.to === 'string') {
          return this.buildEvent('status', 'system', `${payload.from} -> ${payload.to}`, { from: payload.from, to: payload.to });
        }
        return this.buildEvent('status', 'system', event.content, payload);
      }
      case 'error':
        return this.buildEvent('error', 'system', event.content, payload);
      case 'artifact':
        return this.buildEvent('artifact', 'assistant', event.content, payload);
      case 'stream_chunk': {
        const stream = payload.stream === 'stderr' ? 'stderr' : 'stdout';
        return this.buildEvent('stream_chunk', stream === 'stderr' ? 'system' : 'assistant', event.content, { stream });
      }
      case 'message':
      default:
        return this.buildEvent(event.kind, event.role, event.content, payload);
    }
  }
}

export { ExecutionEventSink };
export type { ExecutionEventPayload, ExecutionEventSinkCallbacks, WorkflowStream };
