import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { READ_ONLY_ERROR_MESSAGE, TaskSourceService } from '../../src/services/taskSourceService.js';

type SourceItem = {
  id: string;
  type: string;
  name: string;
  project_id: number;
  config: Record<string, unknown>;
  last_sync_at?: string;
};

type SourceTypeDefinition = {
  key: string;
  name: string;
  description: string;
  config?: Record<string, unknown>;
};

class TestTaskSourceService extends TaskSourceService {
  sources: SourceItem[];
  types: SourceTypeDefinition[];

  constructor({ sources = [], types = [] }: { sources?: SourceItem[]; types?: SourceTypeDefinition[] } = {}) {
    super();
    this.sources = sources;
    this.types = types;
  }

  override async loadSources() {
    return this.sources;
  }

  override async getAvailableSourceTypes() {
    return Object.fromEntries(this.types.map((typeDefinition) => [typeDefinition.key, typeDefinition]));
  }
}

test.test('getAll returns YAML-backed task sources', async () => {
  const sources = [
    { id: 'requirement-orders', type: 'REQUIREMENT', name: 'Orders 需求池', project_id: 1, config: {} },
    { id: 'ticket-platform', type: 'TICKET', name: 'Platform 工单', project_id: 2, config: {} },
  ];
  const service = new TestTaskSourceService({ sources });

  assert.deepEqual(await service.getAll(), sources);
});

test.test('getById returns task source by string id', async () => {
  const expectedSource = {
    id: 'requirement-orders',
    type: 'REQUIREMENT',
    name: 'Orders 需求池',
    project_id: 1,
    config: {},
  };
  const service = new TestTaskSourceService({ sources: [expectedSource] });

  assert.deepEqual(await service.getById('requirement-orders'), expectedSource);
  assert.equal(await service.getById('missing-source'), null);
});

test.test('getByProject filters task sources by project id', async () => {
  const service = new TestTaskSourceService({
    sources: [
      { id: 'requirement-orders', type: 'REQUIREMENT', name: 'Orders 需求池', project_id: 1, config: {} },
      { id: 'ticket-platform', type: 'TICKET', name: 'Platform 工单', project_id: 2, config: {} },
      { id: 'requirement-billing', type: 'REQUIREMENT', name: 'Billing 需求池', project_id: 1, config: {} },
    ],
  });

  assert.deepEqual(await service.getByProject(1), [
    { id: 'requirement-orders', type: 'REQUIREMENT', name: 'Orders 需求池', project_id: 1, config: {} },
    { id: 'requirement-billing', type: 'REQUIREMENT', name: 'Billing 需求池', project_id: 1, config: {} },
  ]);
});

test.test('getAvailableSourceTypes returns config-backed task source types', async () => {
  const types = [
    { key: 'REQUIREMENT', name: '需求池', description: 'From config', config: { token: { type: 'string' } } },
    { key: 'TICKET', name: '工单系统', description: 'From config', config: { token: { type: 'string' } } },
  ];
  const service = new TestTaskSourceService({ types });

  assert.deepEqual(await service.getAvailableSourceTypes(), {
    REQUIREMENT: types[0],
    TICKET: types[1],
  });
});

test.test('create rejects writes in read-only mode', async () => {
  const service = new TestTaskSourceService();

  await assert.rejects(() => service.create({ id: 'new-source' } as never), (error: unknown) => {
    const typedError = error as Error & { statusCode?: number };
    assert.equal(typedError.statusCode, 405);
    assert.equal(typedError.message, READ_ONLY_ERROR_MESSAGE);
    return true;
  });
});

test.test('update rejects normal edits in read-only mode', async () => {
  const service = new TestTaskSourceService({
    sources: [
      { id: 'requirement-orders', type: 'REQUIREMENT', name: 'Orders 需求池', project_id: 1, config: {} },
    ],
  });

  await assert.rejects(() => service.update('requirement-orders', { name: 'Updated' }), (error: unknown) => {
    const typedError = error as Error & { statusCode?: number };
    assert.equal(typedError.statusCode, 405);
    assert.equal(typedError.message, READ_ONLY_ERROR_MESSAGE);
    return true;
  });
});

test.test('update allows transient last_sync_at refresh without persisting', async () => {
  const source = { id: 'requirement-orders', type: 'REQUIREMENT', name: 'Orders 需求池', project_id: 1, config: {} };
  const service = new TestTaskSourceService({ sources: [source] });

  const result = await service.update('requirement-orders', { last_sync_at: '2026-03-20T10:00:00.000Z' });

  assert.deepEqual(result, source);
});

test.test('delete rejects writes in read-only mode', async () => {
  const service = new TestTaskSourceService();

  await assert.rejects(() => service.delete('requirement-orders'), (error: unknown) => {
    const typedError = error as Error & { statusCode?: number };
    assert.equal(typedError.statusCode, 405);
    assert.equal(typedError.message, READ_ONLY_ERROR_MESSAGE);
    return true;
  });
});
