import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import { sessionRoutes } from '../src/routes/sessions.js';
import type { ListSessionEventsQuery, SessionEventListItem } from '../src/types/dto/sessionEvents.ts';

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


