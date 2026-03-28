import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { skillRoutes } from '../src/routes/skills.js';

type SkillServiceStub = {
  listSkills: () => Promise<unknown[]>;
  getSkill: (id: number) => Promise<unknown>;
  createSkill: (name: string, description?: string) => Promise<unknown>;
  updateSkill: (id: number, description?: string) => Promise<unknown>;
  deleteSkill: (id: number) => Promise<boolean>;
  listSkillFiles: (skillName: string) => Promise<string[]>;
  readSkillFile: (skillName: string, filePath: string) => Promise<string>;
  writeSkillFile: (skillName: string, filePath: string, content: string) => Promise<void>;
  uploadSkillZip: (skillName: string, zipBuffer: Buffer) => Promise<void>;
};

function buildSkillService(): SkillServiceStub {
  return {
    async listSkills() {
      return [{ id: 1, name: 'brainstorming', description: 'desc' }];
    },
    async getSkill(id: number) {
      if (id === 1) {
        return { id: 1, name: 'brainstorming', description: 'desc' };
      }
      return null;
    },
    async createSkill(name: string, description?: string) {
      return { id: 2, name, description };
    },
    async updateSkill(id: number, description?: string) {
      if (id !== 1) {
        return null;
      }
      return { id, name: 'brainstorming', description };
    },
    async deleteSkill(id: number) {
      return id === 1;
    },
    async listSkillFiles(skillName: string) {
      if (skillName !== 'brainstorming') {
        return [];
      }
      return ['SKILL.md', 'scripts/helper.js'];
    },
    async readSkillFile(skillName: string, filePath: string) {
      return `content:${skillName}:${filePath}`;
    },
    async writeSkillFile() {
      return;
    },
    async uploadSkillZip() {
      return;
    },
  };
}

async function buildApp() {
  const app = Fastify();
  app.register(skillRoutes, { skillService: buildSkillService() as never });
  await app.ready();
  return app;
}

test.test('GET / returns skill list', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data[0].name, 'brainstorming');
  await app.close();
});

test.test('GET /:id/files returns file list', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/1/files' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, ['SKILL.md', 'scripts/helper.js']);
  await app.close();
});

test.test('GET /:id/files returns 404 for missing skill', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/99/files' });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, 'Skill not found');
  await app.close();
});

test.test('GET /:id/files/* returns file content', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/1/files/SKILL.md' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().data, { path: 'SKILL.md', content: 'content:brainstorming:SKILL.md' });
  await app.close();
});

test.test('PUT /:id/files/* rejects non-string content', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1/files/SKILL.md',
    payload: { content: 123 }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'content is required');
  await app.close();
});

test.test('PUT /:id/files/* updates file', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'PUT',
    url: '/1/files/SKILL.md',
    payload: { content: '# Updated' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().message, 'File updated');
  await app.close();
});

test.test('POST /:id/upload-zip rejects missing zip', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/1/upload-zip',
    payload: {}
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, 'zip base64 data is required');
  await app.close();
});

test.test('POST /:id/upload-zip accepts base64 zip payload', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/1/upload-zip',
    payload: { zip: Buffer.from('zip-content').toString('base64') }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().message, 'Zip uploaded and extracted');
  await app.close();
});
