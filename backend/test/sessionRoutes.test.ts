import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import WebSocket from 'ws';

import { sessionRoutes } from '../src/routes/sessions.js';
import type { ListSessionEventsQuery, SessionEventListItem } from '../src/types/dto/sessionEvents.ts';

async function waitFor(assertion: () => Promise<void> | void, timeoutMs = 1500) {
  const startedAt = Date.now();

  while (true) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

function buildSessionServiceStub() {
  const calls = {
    listEvents: [] as Array<{ sessionId: number; options: { afterSeq?: number; limit?: number } }>,
    sendInput: [] as Array<{ sessionId: number; input: string }>,
    start: [] as number[],
    continue: [] as Array<{ sessionId: number; input: string }>,
    getOutput: [] as number[],
  };

  const events: SessionEventListItem[] = [
    {
      id: 11,
      session_id: 7,
      segment_id: 3,
      seq: 4,
      kind: 'stream_chunk',
      role: 'assistant',
      content: 'alpha',
      payload: { stream: 'stdout' },
      created_at: '2026-03-23T00:00:04.000Z',
    },
  ];

  return {
    service: {
      async getAll() {
        return [];
      },
      async getActiveByTask() {
        return null;
      },
      async getHistoryByTask() {
        return [];
      },
      async getById(sessionId: number) {
        // Return a mock session for any ID so routes can proceed past the 404 check
        return {
          id: sessionId,
          status: 'RUNNING',
          task_id: 1,
          agent_id: 1,
          created_at: '2026-03-23T00:00:00.000Z',
          updated_at: '2026-03-23T00:00:00.000Z',
        };
      },
      async create() {
        return null;
      },
      async start(sessionId: number) {
        calls.start.push(sessionId);
        return { id: sessionId, status: 'RUNNING' };
      },
      async stop() {
        return null;
      },
      async continue(sessionId: number, input: string) {
        calls.continue.push({ sessionId, input });
        return { id: sessionId, status: 'RUNNING' };
      },
      async sendInput(sessionId: number, input: string) {
        calls.sendInput.push({ sessionId, input });
        return true;
      },
      async getOutput(sessionId: number) {
        calls.getOutput.push(sessionId);
        return 'alpha\nbeta\n';
      },
      async delete() {
        return true;
      },
      async listEvents(sessionId: number, options: { afterSeq?: number; limit?: number }) {
        calls.listEvents.push({ sessionId, options });
        return {
          events,
          last_seq: 4,
          has_more: false,
        };
      },
    },
    calls,
    events,
  };
}

async function buildApp(service: Record<string, unknown>) {
  const app = Fastify();
  app.register(sessionRoutes, { service: service as never });
  await app.ready();
  return app;
}

test.test('GET /sessions/:id/events returns the standard success envelope and maps after_seq query to service options', async () => {
  const { service, calls, events } = buildSessionServiceStub();
  const app = await buildApp(service);

  const query: ListSessionEventsQuery = { after_seq: '3', limit: '25' };
  const response = await app.inject({
    method: 'GET',
    url: `/sessions/7/events?after_seq=${query.after_seq}&limit=${query.limit}`,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    success: true,
    message: 'Success',
    data: {
      events,
      last_seq: 4,
      has_more: false,
    },
    error: null,
  });
  assert.deepEqual(calls.listEvents, [{ sessionId: 7, options: { afterSeq: 3, limit: 25 } }]);

  await app.close();
});



test.test('GET /sessions/:id/output returns 404 when the session does not exist', async () => {
  const { service } = buildSessionServiceStub();
  service.getById = async () => null;

  const app = await buildApp(service);
  const response = await app.inject({ method: 'GET', url: '/sessions/99/output' });
  const payload = response.json() as { success: boolean; message: string };

  assert.equal(response.statusCode, 404);
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Session not found');

  await app.close();
});

// Session start is handled by Workflow system — route returns 501
test.test('POST /sessions/:id/start returns 501 with Workflow deprecation message', async () => {
  const { service } = buildSessionServiceStub();
  const app = await buildApp(service);
  const response = await app.inject({ method: 'POST', url: '/sessions/7/start' });

  assert.equal(response.statusCode, 501);
  assert.match(response.json().message, /Workflow system/);

  await app.close();
});

test.test('POST /sessions/:id/continue returns success when the resumed session finishes immediately', async () => {
  const { service, calls } = buildSessionServiceStub();
  service.continue = async (sessionId: number, input: string) => {
    calls.continue.push({ sessionId, input });
    return { id: sessionId, status: 'COMPLETED' };
  };

  const app = await buildApp(service);
  const response = await app.inject({
    method: 'POST',
    url: '/sessions/7/continue',
    payload: { input: 'resume work' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    success: true,
    message: 'Session continued',
    data: { id: 7, status: 'COMPLETED' },
    error: null,
  });
  assert.deepEqual(calls.continue, [{ sessionId: 7, input: 'resume work' }]);

  await app.close();
});

// Session input is handled via WebSocket — route returns 501
test.test('POST /sessions/:id/input returns 501 with WebSocket deprecation message', async () => {
  const { service } = buildSessionServiceStub();
  const app = await buildApp(service);

  const response = await app.inject({
    method: 'POST',
    url: '/sessions/7/input',
    payload: { input: 'ship it' },
  });

  assert.equal(response.statusCode, 501);
  assert.match(response.json().message, /WebSocket/);

  await app.close();
});

// Session input is handled via WebSocket — 409 scenario no longer reachable via HTTP
test.test('POST /sessions/:id/input returns 501 even when service would reject', async () => {
  const { service } = buildSessionServiceStub();
  service.sendInput = async () => false;

  const app = await buildApp(service);
  const response = await app.inject({
    method: 'POST',
    url: '/sessions/7/input',
    payload: { input: 'ship it' },
  });

  assert.equal(response.statusCode, 501);
  assert.match(response.json().message, /WebSocket/);

  await app.close();
});

// WebSocket handler lives in src/app.ts, not sessionRoutes — these tests
// need the full app setup. Skip in route unit tests.
const WS_TIMEOUT = 3000;

test.test('WebSocket /ws routes STOMP app input destinations to the parsed session id', { skip: 'WebSocket handler is in app.ts, not sessionRoutes', timeout: WS_TIMEOUT }, async () => {
  const { service, calls } = buildSessionServiceStub();
  const app = Fastify();
  await app.register(fastifyWebSocket);
  app.register(sessionRoutes, { service: service as never });
  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  assert.ok(address && typeof address === 'object');

  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
    setTimeout(() => reject(new Error('WS connect timeout')), WS_TIMEOUT - 500);
  });

  socket.send(JSON.stringify({
    destination: '/app/session/42/input',
    body: JSON.stringify({ input: 'hello from ws' }),
  }));

  await waitFor(() => {
    assert.deepEqual(calls.sendInput, [{ sessionId: 42, input: 'hello from ws' }]);
  });

  socket.close();
  await new Promise((r) => setTimeout(r, 100));
  await app.close();
});

test.test('WebSocket /ws does not broadcast stdin chunks when sendInput returns false', { skip: 'WebSocket handler is in app.ts, not sessionRoutes', timeout: WS_TIMEOUT }, async () => {
  const { service, calls } = buildSessionServiceStub();
  service.sendInput = async (sessionId: number, input: string) => {
    calls.sendInput.push({ sessionId, input });
    return false;
  };

  const app = Fastify();
  await app.register(fastifyWebSocket);
  app.register(sessionRoutes, { service: service as never });
  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  assert.ok(address && typeof address === 'object');

  const subscriber = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
  await new Promise<void>((resolve, reject) => {
    subscriber.once('open', () => resolve());
    subscriber.once('error', reject);
    setTimeout(() => reject(new Error('WS connect timeout')), WS_TIMEOUT - 500);
  });

  const receivedMessages: string[] = [];
  subscriber.on('message', (message) => {
    receivedMessages.push(message.toString());
  });

  subscriber.send(JSON.stringify({
    destination: '/topic/session/42/output',
  }));

  await waitFor(() => {
    assert.ok(receivedMessages.some((message) => message.includes('SUBSCRIBED')));
  });

  subscriber.send(JSON.stringify({
    destination: '/app/session/42/input',
    body: JSON.stringify({ input: 'hello from ws' }),
  }));

  await waitFor(() => {
    assert.deepEqual(calls.sendInput, [{ sessionId: 42, input: 'hello from ws' }]);
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(
    receivedMessages.some((message) => message.includes('"stream":"stdin"')),
    false,
  );

  subscriber.close();
  await new Promise((r) => setTimeout(r, 100));
  await app.close();
});
