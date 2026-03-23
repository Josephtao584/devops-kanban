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
      async getById() {
        return null;
      },
      async create() {
        return null;
      },
      async start() {
        return null;
      },
      async stop() {
        return null;
      },
      async continue() {
        return null;
      },
      async sendInput(sessionId: number, input: string) {
        calls.sendInput.push({ sessionId, input });
        return true;
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

test.test('GET /sessions/:id/events returns 404 when the session does not exist', async () => {
  const { service } = buildSessionServiceStub();
  service.listEvents = async () => {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  };

  const app = await buildApp(service);
  const response = await app.inject({ method: 'GET', url: '/sessions/99/events' });
  const payload = response.json() as { success: boolean; message: string };

  assert.equal(response.statusCode, 404);
  assert.equal(payload.success, false);
  assert.equal(payload.message, 'Session not found');

  await app.close();
});

test.test('POST /sessions/:id/input returns success when the service accepts input', async () => {
  const { service, calls } = buildSessionServiceStub();
  const app = await buildApp(service);

  const response = await app.inject({
    method: 'POST',
    url: '/sessions/7/input',
    payload: { input: 'ship it' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    success: true,
    message: 'Input sent',
    data: null,
    error: null,
  });
  assert.deepEqual(calls.sendInput, [{ sessionId: 7, input: 'ship it' }]);

  await app.close();
});

test.test('POST /sessions/:id/input returns 409 when the service cannot write to stdin', async () => {
  const { service, calls } = buildSessionServiceStub();
  service.sendInput = async (sessionId: number, input: string) => {
    calls.sendInput.push({ sessionId, input });
    return false;
  };

  const app = await buildApp(service);
  const response = await app.inject({
    method: 'POST',
    url: '/sessions/7/input',
    payload: { input: 'ship it' },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    success: false,
    message: 'Session input stream is unavailable',
    data: null,
    error: null,
  });
  assert.deepEqual(calls.sendInput, [{ sessionId: 7, input: 'ship it' }]);

  await app.close();
});

test.test('WebSocket /ws routes STOMP app input destinations to the parsed session id', async () => {
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
  });

  socket.send(JSON.stringify({
    destination: '/app/session/42/input',
    body: JSON.stringify({ input: 'hello from ws' }),
  }));

  await waitFor(() => {
    assert.deepEqual(calls.sendInput, [{ sessionId: 42, input: 'hello from ws' }]);
  });

  socket.close();
  await app.close();
});
