import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { OpenCodeExecutor } from '../src/services/workflow/executors/openCodeExecutor.js';
import type { WorkflowExecutionEvent } from '../src/types/executors.js';
import type { OpenCodeStepRunner } from '../src/services/workflow/executors/openCodeStepRunner.js';

function createMockRunner(overrides: Partial<OpenCodeStepRunner> = {}): OpenCodeStepRunner {
  return overrides as unknown as OpenCodeStepRunner;
}

test.test('OpenCodeExecutor execute calls runner with prompt and worktreePath', async () => {
  let receivedPrompt: string | undefined;
  let receivedWorktreePath: string | undefined;

  const executor = new OpenCodeExecutor({
    runner: createMockRunner({
      runStep: async ({ prompt, worktreePath }: { prompt: string; worktreePath: string }) => {
        receivedPrompt = prompt;
        receivedWorktreePath = worktreePath;
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          parsedResult: { summary: 'Done' },
          proc: null,
        };
      },
    }),
  });

  const result = await executor.execute({
    prompt: 'Implement the feature',
    worktreePath: '/tmp/worktree',
  });

  assert.equal(receivedPrompt, 'Implement the feature');
  assert.equal(receivedWorktreePath, '/tmp/worktree');
  assert.equal(result.exitCode, 0);
  assert.equal(result.rawResult.summary, 'Done');
});

test.test('OpenCodeExecutor execute forwards events', async () => {
  const events: WorkflowExecutionEvent[] = [];

  const executor = new OpenCodeExecutor({
    runner: createMockRunner({
      runStep: async ({ onEvent }: { onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) }) => {
        if (onEvent) {
          await onEvent({ kind: 'message', role: 'assistant', content: 'hello' });
        }
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          parsedResult: { summary: 'Done' },
          proc: null,
        };
      },
    }),
  });

  await executor.execute({
    prompt: 'test',
    worktreePath: '/tmp/worktree',
    onEvent: async (event) => { events.push(event); },
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.kind, 'message');
  assert.equal(events[0]!.content, 'hello');
});

test.test('OpenCodeExecutor execute emits stderr as stream_chunk event', async () => {
  const events: WorkflowExecutionEvent[] = [];

  const executor = new OpenCodeExecutor({
    runner: createMockRunner({
      runStep: async () => ({
        exitCode: 0,
        stdout: '',
        stderr: 'some warning',
        parsedResult: { summary: 'Done' },
        proc: null,
      }),
    }),
  });

  await executor.execute({
    prompt: 'test',
    worktreePath: '/tmp/worktree',
    onEvent: async (event) => { events.push(event); },
  });

  const stderrEvent = events.find((e) => e.kind === 'stream_chunk' && e.payload?.stream === 'stderr');
  assert.ok(stderrEvent);
  assert.equal(stderrEvent!.content, 'some warning');
});

test.test('OpenCodeExecutor continue passes session id via cliOptions', async () => {
  let receivedCliOptions: { session?: string } | undefined;

  const executor = new OpenCodeExecutor({
    runner: createMockRunner({
      runStep: async ({ cliOptions }: { cliOptions?: { session?: string } }) => {
        receivedCliOptions = cliOptions;
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          parsedResult: { summary: 'Continued' },
          proc: null,
        };
      },
    }),
  });

  await executor.continue({
    prompt: 'continue work',
    worktreePath: '/tmp/worktree',
    providerSessionId: 'sess-abc-123',
  });

  assert.equal(receivedCliOptions?.session, 'sess-abc-123');
});

test.test('OpenCodeExecutor execute captures provider session id from status event', async () => {
  let capturedProviderState: { providerSessionId?: string | undefined } | undefined;

  const executor = new OpenCodeExecutor({
    runner: createMockRunner({
      runStep: async ({ onEvent }: { onEvent?: ((event: WorkflowExecutionEvent) => void | Promise<void>) }) => {
        if (onEvent) {
          await onEvent({ kind: 'status', role: 'system', content: 'session started', payload: { session_id: 'opencode-sess-1' } });
        }
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          parsedResult: { summary: 'Done' },
          proc: null,
        };
      },
    }),
  });

  await executor.execute({
    prompt: 'test',
    worktreePath: '/tmp/worktree',
    onProviderState: async (state) => { capturedProviderState = state as { providerSessionId?: string }; },
  });

  assert.equal(capturedProviderState?.providerSessionId, 'opencode-sess-1');
});
