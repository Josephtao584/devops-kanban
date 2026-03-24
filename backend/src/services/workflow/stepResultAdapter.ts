import { validateStepResult } from './executors/claudeStepResult.js';
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
      return {
        kind: 'stream_chunk',
        role: 'assistant',
        content: event.content,
        payload: {
          ...payload,
          stream: 'stdout',
        },
      };
    case 'stderr':
      return {
        kind: 'stream_chunk',
        role: 'system',
        content: event.content,
        payload: {
          ...payload,
          stream: 'stderr',
        },
      };
    case 'message':
      return {
        kind: 'message',
        role: event.role ?? 'assistant',
        content: event.content,
        payload,
      };
    case 'tool_call': {
      const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : event.content;
      return {
        kind: 'tool_call',
        role: 'assistant',
        content: toolName,
        payload: {
          tool_name: toolName,
          arguments: payload.arguments,
        },
      };
    }
    case 'tool_result': {
      const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : event.content;
      return {
        kind: 'tool_result',
        role: 'tool',
        content: toolName,
        payload: {
          tool_name: toolName,
          result: payload.result,
        },
      };
    }
    case 'status':
      if (typeof payload.from === 'string' && typeof payload.to === 'string') {
        return {
          kind: 'status',
          role: 'system',
          content: `${payload.from} -> ${payload.to}`,
          payload: {
            from: payload.from,
            to: payload.to,
          },
        };
      }
      return {
        kind: 'status',
        role: 'system',
        content: event.content,
        payload,
      };
    case 'error':
      return {
        kind: 'error',
        role: 'system',
        content: event.content,
        payload,
      };
    case 'artifact':
      return {
        kind: 'artifact',
        role: 'assistant',
        content: event.content,
        payload,
      };
    case 'stream_chunk': {
      const stream = payload.stream === 'stderr' ? 'stderr' : 'stdout';
      return {
        kind: 'stream_chunk',
        role: stream === 'stderr' ? 'system' : 'assistant',
        content: event.content,
        payload: {
          ...payload,
          stream,
        },
      };
    }
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
  if (events.length === 0) {
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
