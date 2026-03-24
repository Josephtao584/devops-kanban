import { validateStepResult } from './executors/claudeStepResult.js';
import { normalizeWorkflowExecutionEvent } from './executionEventSink.js';
import type { ExecutorRawResult, WorkflowExecutionEvent } from '../../types/executors.js';

type ExecutorRawEvent = {
  kind: string;
  role?: 'assistant' | 'system' | 'tool' | 'user';
  content: string;
  payload?: Record<string, unknown>;
};

type ExecutorRawResultWithEvents = ExecutorRawResult & {
  events?: ExecutorRawEvent[];
};

type NormalizedExecutorRawResult = ExecutorRawResult & {
  events?: WorkflowExecutionEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeEvent(event: ExecutorRawEvent): WorkflowExecutionEvent | null {
  const payload = isRecord(event.payload) ? { ...event.payload } : {};

  switch (event.kind) {
    case 'stdout':
      return normalizeWorkflowExecutionEvent({
        kind: 'stream_chunk',
        role: 'assistant',
        content: event.content,
        payload: {
          ...payload,
          stream: 'stdout',
        },
      });
    case 'stderr':
      return normalizeWorkflowExecutionEvent({
        kind: 'stream_chunk',
        role: 'system',
        content: event.content,
        payload: {
          ...payload,
          stream: 'stderr',
        },
      });
    case 'message':
      return normalizeWorkflowExecutionEvent({
        kind: 'message',
        role: event.role ?? 'assistant',
        content: event.content,
        payload,
      });
    case 'tool_call':
      return normalizeWorkflowExecutionEvent({
        kind: 'tool_call',
        role: event.role ?? 'assistant',
        content: event.content,
        payload,
      });
    case 'tool_result':
      return normalizeWorkflowExecutionEvent({
        kind: 'tool_result',
        role: event.role ?? 'tool',
        content: event.content,
        payload,
      });
    case 'status':
      return normalizeWorkflowExecutionEvent({
        kind: 'status',
        role: event.role ?? 'system',
        content: event.content,
        payload,
      });
    case 'error':
      return normalizeWorkflowExecutionEvent({
        kind: 'error',
        role: event.role ?? 'system',
        content: event.content,
        payload,
      });
    case 'artifact':
      return normalizeWorkflowExecutionEvent({
        kind: 'artifact',
        role: event.role ?? 'assistant',
        content: event.content,
        payload,
      });
    case 'stream_chunk':
      return normalizeWorkflowExecutionEvent({
        kind: 'stream_chunk',
        role: event.role ?? (payload.stream === 'stderr' ? 'system' : 'assistant'),
        content: event.content,
        payload,
      });
    default:
      return null;
  }
}

export function normalizeExecutorEvents(rawResult: ExecutorRawResult | undefined): WorkflowExecutionEvent[] {
  const events = (rawResult as ExecutorRawResultWithEvents | undefined)?.events;
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter((event): event is ExecutorRawEvent => isRecord(event) && typeof event.kind === 'string' && typeof event.content === 'string')
    .map((event) => normalizeEvent(event))
    .filter((event): event is WorkflowExecutionEvent => event !== null);
}

export function normalizeExecutorRawResult(rawResult: ExecutorRawResult | undefined): NormalizedExecutorRawResult | undefined {
  if (!rawResult) {
    return rawResult;
  }

  const events = normalizeExecutorEvents(rawResult);
  const hasRawEvents = Array.isArray((rawResult as ExecutorRawResultWithEvents).events);
  if (!hasRawEvents) {
    return rawResult;
  }

  return {
    ...rawResult,
    events,
  };
}

export function adaptStepResult(executorType: string, executionResult: { rawResult?: ExecutorRawResult }) {
  const normalizedRawResult = normalizeExecutorRawResult(executionResult?.rawResult);
  return validateStepResult(normalizedRawResult);
}
