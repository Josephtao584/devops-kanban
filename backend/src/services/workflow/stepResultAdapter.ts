import { validateStepResult } from './executors/claudeStepResult.js';
import type { ExecutorRawResult, WorkflowExecutionEvent, WorkflowExecutionEventRole } from '../../types/executors.js';
import { buildEvent } from '../../types/executors.js';

type ExecutorRawEvent = {
  kind: string;
  role?: WorkflowExecutionEventRole;
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
      return buildEvent('stream_chunk', 'assistant', event.content, { ...payload, stream: 'stdout' });
    case 'stderr':
      return buildEvent('stream_chunk', 'system', event.content, { ...payload, stream: 'stderr' });
    case 'message':
      return buildEvent('message', event.role ?? 'assistant', event.content, payload);
    case 'tool_call':
      return buildEvent('tool_call', event.role ?? 'assistant', event.content, payload);
    case 'tool_result':
      return buildEvent('tool_result', event.role ?? 'tool', event.content, payload);
    case 'status':
      return buildEvent('status', event.role ?? 'system', event.content, payload);
    case 'error':
      return buildEvent('error', event.role ?? 'system', event.content, payload);
    case 'artifact':
      return buildEvent('artifact', event.role ?? 'assistant', event.content, payload);
    case 'stream_chunk':
      return buildEvent('stream_chunk', event.role ?? (payload.stream === 'stderr' ? 'system' : 'assistant'), event.content, payload);
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

export function adaptStepResult(_executorType: string, executionResult: { rawResult?: ExecutorRawResult }) {
  const normalizedRawResult = normalizeExecutorRawResult(executionResult?.rawResult);
  return validateStepResult(normalizedRawResult);
}
