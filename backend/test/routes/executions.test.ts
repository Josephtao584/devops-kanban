import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';

type Execution = { id: number; session_id: number; task_id: number; created_at: string; updated_at: string };
type Session = { id: number; task_id: number };

type ExecutionRepoStub = {
  findAll: () => Promise<Execution[]>;
  findById: (id: number) => Promise<Execution | null>;
  getBySession: (sessionId: number) => Promise<Execution[]>;
  getByTask: (taskId: number) => Promise<Execution[]>;
  create: (data: { session_id: number; task_id: number }) => Promise<Execution>;
  update: (id: number, data: Partial<Execution>) => Promise<Execution | null>;
  delete: (id: number) => Promise<boolean>;
};

type SessionRepoStub = {
  findById: (id: number) => Promise<Session | null>;
};

let nextId = 1;
const executions = new Map<number, Execution>();
const sessions = new Map<number, Session>();

function makeStubs() {
  nextId = 1;
  executions.clear();
  sessions.clear();

  const execRepo: ExecutionRepoStub = {
    findAll: async () => Array.from(executions.values()),
    findById: async (id) => executions.get(id) ?? null,
    getBySession: async (sessionId) => Array.from(executions.values()).filter((e) => e.session_id === sessionId),
    getByTask: async (taskId) => Array.from(executions.values()).filter((e) => e.task_id === taskId),
    create: async (data) => {
      const id = nextId++;
      const now = new Date().toISOString();
      const exec: Execution = { id, ...data, created_at: now, updated_at: now };
      executions.set(id, exec);
      return exec;
    },
    update: async (id, data) => {
      const existing = executions.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data };
      executions.set(id, updated);
      return updated;
    },
    delete: async (id) => executions.delete(id),
  };

  const sessionRepo: SessionRepoStub = {
    findById: async (id) => sessions.get(id) ?? null,
  };

  return { execRepo, sessionRepo };
}

function makeApp(stubs: ReturnType<typeof makeStubs>) {
  const app = Fastify();

  app.get('/api/executions/', async () => {
    return { success: true, data: await stubs.execRepo.findAll() };
  });

  app.get('/api/executions/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const exec = await stubs.execRepo.findById(id);
    if (!exec) {
      reply.code(404);
      return { success: false, error: 'Execution not found' };
    }
    return { success: true, data: exec };
  });

  app.get('/api/executions/session/:sessionId', async (request) => {
    const sessionId = Number((request.params as { sessionId: string }).sessionId);
    return { success: true, data: await stubs.execRepo.getBySession(sessionId) };
  });

  app.get('/api/executions/task/:taskId', async (request) => {
    const taskId = Number((request.params as { taskId: string }).taskId);
    return { success: true, data: await stubs.execRepo.getByTask(taskId) };
  });

  app.post('/api/executions/', async (request, reply) => {
    const body = request.body as { session_id: number };
    const session = await stubs.sessionRepo.findById(body.session_id);
    if (!session) {
      reply.code(404);
      return { success: false, error: 'Session not found' };
    }
    const exec = await stubs.execRepo.create({ session_id: session.id, task_id: session.task_id });
    return { success: true, data: exec, message: 'Execution created' };
  });

  app.put('/api/executions/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const updated = await stubs.execRepo.update(id, request.body as Partial<Execution>);
    if (!updated) {
      reply.code(404);
      return { success: false, error: 'Execution not found' };
    }
    return { success: true, data: updated, message: 'Execution updated' };
  });

  app.delete('/api/executions/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const deleted = await stubs.execRepo.delete(id);
    if (!deleted) {
      reply.code(404);
      return { success: false, error: 'Execution not found' };
    }
    return { success: true, data: null, message: 'Execution deleted' };
  });

  return app;
}

async function withStubs(run: (stubs: ReturnType<typeof makeStubs>, app: Fastify.FastifyInstance) => Promise<void>) {
  const stubs = makeStubs();
  const app = makeApp(stubs);
  await app.ready();
  try {
    await run(stubs, app);
  } finally {
    await app.close();
  }
}

test.test('GET / returns all executions', async () => {
  await withStubs(async (_stubs, app) => {
    const response = await app.inject({ method: 'GET', url: '/api/executions/' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data, []);
  });
});

test.test('GET /:id returns execution by id', async () => {
  await withStubs(async (stubs, app) => {
    const session = { id: 1, task_id: 5 };
    sessions.set(1, session);
    await stubs.execRepo.create({ session_id: 1, task_id: 5 });

    const response = await app.inject({ method: 'GET', url: '/api/executions/1' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 1);
  });
});

test.test('GET /:id returns 404 for non-existent id', async () => {
  await withStubs(async (_stubs, app) => {
    const response = await app.inject({ method: 'GET', url: '/api/executions/99999' });
    assert.equal(response.statusCode, 404);
    const body = response.json();
    assert.equal(body.success, false);
  });
});

test.test('GET /session/:sessionId returns filtered executions', async () => {
  await withStubs(async (stubs, app) => {
    sessions.set(1, { id: 1, task_id: 1 });
    sessions.set(2, { id: 2, task_id: 2 });

    await stubs.execRepo.create({ session_id: 1, task_id: 1 });
    await stubs.execRepo.create({ session_id: 1, task_id: 1 });
    await stubs.execRepo.create({ session_id: 2, task_id: 2 });

    const response = await app.inject({ method: 'GET', url: '/api/executions/session/1' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 2);
    body.data.forEach((e: { session_id: number }) => assert.equal(e.session_id, 1));
  });
});

test.test('GET /task/:taskId returns filtered executions', async () => {
  await withStubs(async (stubs, app) => {
    sessions.set(1, { id: 1, task_id: 10 });
    sessions.set(2, { id: 2, task_id: 20 });

    await stubs.execRepo.create({ session_id: 1, task_id: 10 });
    await stubs.execRepo.create({ session_id: 2, task_id: 20 });

    const response = await app.inject({ method: 'GET', url: '/api/executions/task/10' });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].task_id, 10);
  });
});

test.test('POST / creates execution', async () => {
  await withStubs(async (_stubs, app) => {
    sessions.set(5, { id: 5, task_id: 42 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/executions/',
      payload: { session_id: 5 },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.task_id, 42);
    assert.equal(body.data.session_id, 5);
  });
});

test.test('POST / returns 404 when session not found', async () => {
  await withStubs(async (_stubs, app) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/executions/',
      payload: { session_id: 99999 },
    });
    assert.equal(response.statusCode, 404);
    const body = response.json();
    assert.equal(body.success, false);
  });
});

test.test('PUT /:id updates execution', async () => {
  await withStubs(async (stubs, app) => {
    const created = await stubs.execRepo.create({ session_id: 1, task_id: 1 });
    sessions.set(1, { id: 1, task_id: 1 });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/executions/${created.id}`,
      payload: { task_id: 99 },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.task_id, 99);
  });
});

test.test('PUT /:id returns 404 for non-existent id', async () => {
  await withStubs(async (_stubs, app) => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/executions/99999',
      payload: { task_id: 99 },
    });
    assert.equal(response.statusCode, 404);
  });
});

test.test('DELETE /:id deletes execution', async () => {
  await withStubs(async (stubs, app) => {
    sessions.set(1, { id: 1, task_id: 1 });
    const created = await stubs.execRepo.create({ session_id: 1, task_id: 1 });

    const response = await app.inject({ method: 'DELETE', url: `/api/executions/${created.id}` });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.success, true);

    const getResponse = await app.inject({ method: 'GET', url: `/api/executions/${created.id}` });
    assert.equal(getResponse.statusCode, 404);
  });
});

test.test('DELETE /:id returns 404 for non-existent id', async () => {
  await withStubs(async (_stubs, app) => {
    const response = await app.inject({ method: 'DELETE', url: '/api/executions/99999' });
    assert.equal(response.statusCode, 404);
  });
});
