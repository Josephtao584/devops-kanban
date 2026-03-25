import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as test from 'node:test';

const storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-iteration-service-'));
process.env.STORAGE_PATH = storagePath;

const { IterationService } = await import('../src/services/iterationService.js');

async function seedLinkedIterationFixtures() {
  await fs.writeFile(path.join(storagePath, 'projects.json'), JSON.stringify([
    {
      id: 1,
      name: 'Demo project',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z'
    }
  ], null, 2));

  await fs.writeFile(path.join(storagePath, 'iterations.json'), JSON.stringify([
    {
      id: 1,
      project_id: 1,
      name: 'Sprint 1',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z'
    },
    {
      id: 2,
      project_id: 1,
      name: 'Sprint 2',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z'
    }
  ], null, 2));

  await fs.writeFile(path.join(storagePath, 'tasks.json'), JSON.stringify([
    {
      id: 101,
      title: 'Linked task',
      project_id: 1,
      iteration_id: 1,
      status: 'TODO',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z'
    },
    {
      id: 102,
      title: 'Other iteration task',
      project_id: 1,
      iteration_id: 2,
      status: 'TODO',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z'
    }
  ], null, 2));
}

test.after(async () => {
  await fs.rm(storagePath, { recursive: true, force: true });
  delete process.env.STORAGE_PATH;
});

test.test('IterationService.delete removes the iteration and clears linked task iteration ids', async () => {
  await seedLinkedIterationFixtures();
  const service = new IterationService();

  const deleted = await service.delete(1);
  assert.equal(deleted, true);

  const iterations = JSON.parse(await fs.readFile(path.join(storagePath, 'iterations.json'), 'utf-8'));
  const tasks = JSON.parse(await fs.readFile(path.join(storagePath, 'tasks.json'), 'utf-8'));

  assert.equal(iterations.some((item: { id: number }) => item.id === 1), false);
  assert.equal(tasks.find((task: { id: number; iteration_id: number | null }) => task.id === 101)?.iteration_id, null);
  assert.equal(tasks.find((task: { id: number; iteration_id: number | null }) => task.id === 102)?.iteration_id, 2);
});

test.test('IterationService.delete removes tasks in the iteration when deleteTasks is true', async () => {
  await seedLinkedIterationFixtures();
  const service = new IterationService();

  const deleted = await service.delete(1, true);
  assert.equal(deleted, true);

  const iterations = JSON.parse(await fs.readFile(path.join(storagePath, 'iterations.json'), 'utf-8'));
  const tasks = JSON.parse(await fs.readFile(path.join(storagePath, 'tasks.json'), 'utf-8'));

  assert.equal(iterations.some((item: { id: number }) => item.id === 1), false);
  assert.equal(tasks.some((task: { id: number }) => task.id === 101), false);
  assert.equal(tasks.some((task: { id: number }) => task.id === 102), true);
});

test.test('IterationService.delete returns false when the iteration does not exist', async () => {
  await fs.writeFile(path.join(storagePath, 'projects.json'), JSON.stringify([
    {
      id: 1,
      name: 'Demo project',
      created_at: '2026-03-25T00:00:00.000Z',
      updated_at: '2026-03-25T00:00:00.000Z'
    }
  ], null, 2));

  await fs.writeFile(path.join(storagePath, 'iterations.json'), '[]');
  await fs.writeFile(path.join(storagePath, 'tasks.json'), '[]');

  const service = new IterationService();
  const deleted = await service.delete(999);
  assert.equal(deleted, false);
});
