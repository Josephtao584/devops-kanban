import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { skillRoutes } from '../src/routes/skills.js';
import { SkillService } from '../src/services/skillService.js';

function buildSkillService() {
  const skills: Map<number, { id: number; name: string; description?: string | undefined }> = new Map();
  let nextId = 1;

  return new SkillService({
    storagePath: process.cwd(),
    skillRepo: {
      async findAll() { return [...skills.values()]; },
      async findById(id: number) { return skills.get(id) || null; },
      async create(data: { name: string; description?: string; identifier: string }) {
        const skill = { id: nextId++, name: data.name, description: data.description };
        skills.set(skill.id, skill);
        return skill;
      },
      async update(id: number, data: Record<string, unknown>) {
        const existing = skills.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...data };
        skills.set(id, updated);
        return updated;
      },
      async delete(id: number) { return skills.delete(id); },
    } as never,
  });
}

async function buildApp() {
  const app = Fastify();
  app.register(skillRoutes, { skillService: buildSkillService() as never });
  await app.ready();
  return app;
}

const longName = 'a'.repeat(201);
const exactName = 'a'.repeat(200);
const longDesc = 'b'.repeat(5001);
const exactDesc = 'b'.repeat(5000);

// ─── POST / validation ───────────────────────────────────

test.test('POST / rejects name exceeding 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: longName },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'name exceeds maximum length of 200 characters');
  await app.close();
});

test.test('POST / accepts name at exactly 200 characters', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: exactName },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, exactName);
  await app.close();
});

// ─── PUT /:id validation ─────────────────────────────────

test.test('PUT /:id rejects name exceeding 200 characters', async () => {
  const app = await buildApp();
  // First create a skill
  await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'valid-skill' },
  });

  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { name: longName },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'name exceeds maximum length of 200 characters');
  await app.close();
});

test.test('PUT /:id accepts name at exactly 200 characters', async () => {
  const app = await buildApp();
  await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'valid-skill' },
  });

  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { name: exactName },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.name, exactName);
  await app.close();
});

test.test('PUT /:id rejects description exceeding 5000 characters', async () => {
  const app = await buildApp();
  await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'valid-skill' },
  });

  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { name: 'updated', description: longDesc },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'description exceeds maximum length of 5000 characters');
  await app.close();
});

test.test('PUT /:id accepts description at exactly 5000 characters', async () => {
  const app = await buildApp();
  await app.inject({
    method: 'POST',
    url: '/',
    payload: { name: 'valid-skill' },
  });

  const response = await app.inject({
    method: 'PUT',
    url: '/1',
    payload: { name: 'updated', description: exactDesc },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.description, exactDesc);
  await app.close();
});
