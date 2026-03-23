import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

import { sessionRoutes } from '../src/routes/sessions.js';
import type { ListSessionEventsQuery, SessionEventListItem } from '../src/types/dto/sessionEvents.ts';

function buildSessionServiceStub() {
  const calls = {
    listEvents: [] as Array<{ sessionId: number; options: { afterSeq?: number; limit?: number } }>,
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
      async sendInput() {
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

test.test('GET /sessions/:id/events returns the planned event envelope and maps after_seq query to service options', async () => {
  const { service, calls, events } = buildSessionServiceStub();
  const app = await buildApp(service);

  const query: ListSessionEventsQuery = { after_seq: '3', limit: '25' };
  const response = await app.inject({
    method: 'GET',
    url: `/sessions/7/events?after_seq=${query.after_seq}&limit=${query.limit}`,
  });

  const payload = response.json() as {
    success: boolean;
    data: { events: SessionEventListItem[]; last_seq: number; has_more: boolean };
    error: null;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, {
    events,
    last_seq: 4,
    has_more: false,
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

test.test('GET /sessions/:id/output is not registered in the v1 routes', async () => {
  const { service } = buildSessionServiceStub();
  const app = await buildApp(service);

  const response = await app.inject({ method: 'GET', url: '/sessions/7/output' });

  assert.equal(response.statusCode, 404);

  await app.close();
});
