import * as test from 'node:test';
import * as assert from 'node:assert/strict';

test.test('ProjectRepository parseRow parses env JSON field', async () => {
  const { ProjectRepository } = await import('../src/repositories/projectRepository.js');
  const repo = new ProjectRepository();
  const parsed = (repo as any).parseRow({
    id: 1,
    name: 'Test',
    description: null,
    git_url: null,
    local_path: null,
    env: '{"PIPELINE_ID":"123"}',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  });
  assert.deepEqual(parsed.env, { PIPELINE_ID: '123' });
});

test.test('ProjectRepository parseRow returns empty object when env is null', async () => {
  const { ProjectRepository } = await import('../src/repositories/projectRepository.js');
  const repo = new ProjectRepository();
  const parsed = (repo as any).parseRow({
    id: 1,
    name: 'Test',
    description: null,
    git_url: null,
    local_path: null,
    env: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  });
  assert.deepEqual(parsed.env, {});
});

test.test('ProjectRepository serializeRow serializes env to JSON string', async () => {
  const { ProjectRepository } = await import('../src/repositories/projectRepository.js');
  const repo = new ProjectRepository();
  const serialized = (repo as any).serializeRow({
    env: { PIPELINE_ID: '456' },
  });
  assert.equal(serialized.env, '{"PIPELINE_ID":"456"}');
});
