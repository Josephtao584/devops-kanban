import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { TaskSourceService } from '../../src/services/taskSourceService.js';
import type {
  CreateTaskSourceInput,
  UpdateTaskSourceInput,
} from '../../src/types/dto/taskSources.ts';

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

test.test('create now allows writes via repository', async () => {
  // The service now delegates to the repository which persists to disk
  // This test verifies the service doesn't throw 405 anymore
  const service = new TaskSourceService();

  const createInput: CreateTaskSourceInput = {
    name: 'Test Source',
    type: 'REQUIREMENT',
    project_id: 1,
    config: { token: 'test-token' },
    enabled: true,
  };

  // Should not throw - create now works
  const result = await service.create(createInput);
  assert.ok(result.id, 'Created source should have an id');
  assert.equal(result.name, 'Test Source');
  assert.equal(result.type, 'REQUIREMENT');
  assert.equal(result.project_id, 1);
});

test.test('update rejects edits when source not found', async () => {
  const service = new TaskSourceService();

  const result = await service.update('99999', { name: 'Updated' } as never);
  assert.equal(result, null);
});

test.test('update allows transient last_sync_at refresh without persisting', async () => {
  // First create a source
  const service = new TaskSourceService();
  const createInput: CreateTaskSourceInput = {
    name: 'Test Source for Update',
    type: 'REQUIREMENT',
    project_id: 1,
    config: {},
    enabled: true,
  };

  const created = await service.create(createInput);
  const createdId = String(created.id);

  const result = await service.update(createdId, { last_sync_at: '2026-03-20T10:00:00.000Z' });

  // last_sync_at only update should return existing without persisting
  assert.ok(result);
  assert.equal(result.id, createdId);
});

test.test('delete returns false when source not found', async () => {
  const service = new TaskSourceService();

  const result = await service.delete('99999');
  assert.equal(result, false);
});
