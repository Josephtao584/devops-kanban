import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateTaskSourceInput,
  UpdateTaskSourceInput,
} from '../../src/types/dto/taskSources.ts';
import type { TaskSourceServiceContract } from '../../src/types/fastify.ts';
import type {
  ImportedTask,
  PreviewImportedTask,
  SourceRecord,
  SourceTypeDefinition,
  TaskSourceImportResult,
  TaskSourceSyncResultItem,
} from '../../src/types/sources.ts';

test.test('task source Fastify contract accepts explicit source-facing return types', async () => {
  const projectSource: SourceRecord = {
    id: 'requirement-orders',
    type: 'REQUIREMENT',
    name: 'Orders',
    project_id: 1,
    config: {},
  };

  const importedTask: ImportedTask = {
    external_id: 'ISSUE-1',
    title: 'Imported issue',
  };

  const previewTask: PreviewImportedTask = {
    ...importedTask,
    imported: false,
  };

  const importResult: TaskSourceImportResult = {
    created: 1,
    skipped: 0,
    total: 1,
  };

  const sourceTypes: Record<string, SourceTypeDefinition> = {
    REQUIREMENT: {
      key: 'REQUIREMENT',
      name: '需求池',
      description: 'Configured source',
    },
  };

  const contract: TaskSourceServiceContract = {
    async getByProject(projectId: number): Promise<SourceRecord[]> {
      return [{ ...projectSource, project_id: projectId }];
    },
    async getById(sourceId: string): Promise<SourceRecord | null> {
      return sourceId === String(projectSource.id) ? projectSource : null;
    },
    async getAvailableSourceTypes(): Promise<Record<string, SourceTypeDefinition>> {
      return sourceTypes;
    },
    async create(_source: CreateTaskSourceInput): Promise<SourceRecord> {
      return projectSource;
    },
    async update(sourceId: string, source: UpdateTaskSourceInput): Promise<SourceRecord | null> {
      return sourceId === String(projectSource.id) ? { ...projectSource, ...source } : null;
    },
    async delete(sourceId: string): Promise<SourceRecord | null> {
      return sourceId === String(projectSource.id) ? projectSource : null;
    },
    async sync(): Promise<TaskSourceSyncResultItem[]> {
      return [{ id: 1, project_id: 1, title: 'Synced task' }];
    },
    async previewSync(): Promise<PreviewImportedTask[]> {
      return [previewTask];
    },
    async importIssues(_sourceId: string, items: ImportedTask[], _projectId: number, _iterationId?: number | null): Promise<TaskSourceImportResult> {
      return { ...importResult, total: items.length };
    },
    async testConnection(): Promise<boolean> {
      return true;
    },
  };

  assert.deepEqual(await contract.create({
    name: 'Orders',
    type: 'REQUIREMENT',
    project_id: 1,
    config: {},
    enabled: true,
  }), projectSource);
  assert.deepEqual(await contract.update('requirement-orders', { last_sync_at: '2026-03-20T10:00:00.000Z' }), {
    ...projectSource,
    last_sync_at: '2026-03-20T10:00:00.000Z',
  });
  assert.deepEqual(await contract.previewSync('requirement-orders'), [previewTask]);
  assert.deepEqual(await contract.importIssues('requirement-orders', [importedTask], 1), importResult);
  assert.equal(await contract.testConnection('requirement-orders'), true);
});
