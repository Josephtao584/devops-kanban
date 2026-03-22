import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { ContinueSessionBody, CreateSessionInput } from '../../src/types/dto/sessions.ts';
import type { BroadcastPayload, SessionChannel, WebSocketPayload } from '../../src/types/ws/sessions.ts';

test.test('session shared boundary types accept expected assignments', () => {
  const createInput: CreateSessionInput = { task_id: 1, initial_prompt: 'continue' };
  const continueBody: ContinueSessionBody = { input: 'fix tests' };
  const payload: WebSocketPayload = { type: 'subscribe', session_id: 1, channel: 'output' };
  const event: BroadcastPayload = { type: 'chunk', content: 'hello', stream: 'stdout' };
  const channel: SessionChannel = 'status';

  assert.equal(createInput.task_id, 1);
  assert.equal(continueBody.input, 'fix tests');
  assert.equal(payload.channel, 'output');
  assert.equal(event.stream, 'stdout');
  assert.equal(channel, 'status');
});
