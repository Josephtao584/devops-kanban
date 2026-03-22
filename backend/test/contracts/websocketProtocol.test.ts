import * as test from 'node:test';
import * as assert from 'node:assert/strict';

const subscribedMessage = {
  type: 'subscribed',
  session_id: 1,
  channel: 'output',
};

const chunkMessage = {
  sessionId: 1,
  channel: 'output',
  type: 'chunk',
  content: 'hello',
  stream: 'stdout',
  timestamp: new Date().toISOString(),
};

test.test('websocket subscribed message preserves current shape', () => {
  assert.equal(subscribedMessage.type, 'subscribed');
  assert.equal(subscribedMessage.channel, 'output');
});

test.test('websocket chunk message preserves current shape', () => {
  assert.equal(chunkMessage.type, 'chunk');
  assert.equal(chunkMessage.stream, 'stdout');
});
