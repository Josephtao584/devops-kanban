import type { ExecutorProviderState, WorkflowExecutionEvent, WorkflowExecutionEventKind, WorkflowExecutionEventRole } from '../../types/executors.js';

type ExecutionEventSinkCallbacks = {
  onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState?: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;
};

type ExecutionEventPayload = Record<string, unknown>;
type WorkflowStream = 'stdout' | 'stderr';

function normalizeWorkflowExecutionEvent(event: WorkflowExecutionEvent): WorkflowExecutionEvent {
  const payload = event.payload ? { ...event.payload } : {};

  switch (event.kind) {
    case 'tool_call': {
      const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : event.content;
      return buildEvent('tool_call', 'assistant', toolName, { ...payload, tool_name: toolName });
    }
    case 'tool_result': {
      const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : event.content;
      return buildEvent('tool_result', 'tool', toolName, { ...payload, tool_name: toolName });
    }
    case 'status': {
      if (typeof payload.from === 'string' && typeof payload.to === 'string') {
        return buildEvent('status', 'system', `${payload.from} -> ${payload.to}`, { ...payload, from: payload.from, to: payload.to });
      }
      return buildEvent('status', 'system', event.content, payload);
    }
    case 'error':
      return buildEvent('error', 'system', event.content, payload);
    case 'artifact':
      return buildEvent('artifact', 'assistant', event.content, payload);
    case 'stream_chunk': {
      const stream = payload.stream === 'stderr' ? 'stderr' : 'stdout';
      return buildEvent('stream_chunk', stream === 'stderr' ? 'system' : 'assistant', event.content, { ...payload, stream });
    }
    case 'message':
    default:
      return buildEvent(event.kind, event.role, event.content, payload);
  }
}

function buildEvent(kind: WorkflowExecutionEventKind, role: WorkflowExecutionEventRole, content: string, payload: ExecutionEventPayload): WorkflowExecutionEvent {
  return { kind, role, content, payload };
}

class ExecutionEventSink {
  onEvent: ((event: WorkflowExecutionEvent) => void | Promise<void>) | undefined;
  onProviderState: ((providerState: ExecutorProviderState) => void | Promise<void>) | undefined;

  constructor({ onEvent, onProviderState }: ExecutionEventSinkCallbacks = {}) {
    this.onEvent = onEvent;
    this.onProviderState = onProviderState;
  }

  async append(event: WorkflowExecutionEvent) {
    await this.onEvent?.(normalizeWorkflowExecutionEvent(event));
  }

  async appendProviderState(providerState: ExecutorProviderState) {
    await this.onProviderState?.(providerState);
  }

  async appendMessage(content: string, role: WorkflowExecutionEventRole = 'assistant') {
    await this.append(buildEvent('message', role, content, {}));
  }

  async appendToolCall(toolName: string, argumentsValue: unknown) {
    await this.append(buildEvent('tool_call', 'assistant', toolName, { tool_name: toolName, arguments: argumentsValue }));
  }

  async appendToolResult(toolName: string, result: unknown) {
    await this.append(buildEvent('tool_result', 'tool', toolName, { tool_name: toolName, result }));
  }

  async appendStatus(from: string, to: string) {
    await this.append(buildEvent('status', 'system', `${from} -> ${to}`, { from, to }));
  }

  async appendError(content: string, payload: ExecutionEventPayload = {}) {
    await this.append(buildEvent('error', 'system', content, payload));
  }

  async appendArtifact(content: string, payload: ExecutionEventPayload) {
    await this.append(buildEvent('artifact', 'assistant', content, payload));
  }

  async appendStreamChunk(content: string, stream: WorkflowStream) {
    await this.append(buildEvent('stream_chunk', stream === 'stderr' ? 'system' : 'assistant', content, { stream }));
  }
}

export { ExecutionEventSink, normalizeWorkflowExecutionEvent };
export type { ExecutionEventPayload, ExecutionEventSinkCallbacks, WorkflowStream };
