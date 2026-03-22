import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { TaskSourceServiceContract } from '../../src/types/fastify.ts';
import type {
  ImportedTask,
  PreviewImportedTask,
  SourceRecord,
  SourceTypeDefinition,
  TaskSourceImportResult,
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
    async create(source: Record<string, unknown>): Promise<SourceRecord> {
      return { ...projectSource, ...source } as SourceRecord;
    },
    async update(sourceId: string, source: Record<string, unknown>): Promise<SourceRecord | null> {
      return sourceId === String(projectSource.id) ? ({ ...projectSource, ...source } as SourceRecord) : null;
    },
    async delete(sourceId: string): Promise<SourceRecord | null> {
      return sourceId === String(projectSource.id) ? projectSource : null;
    },
    async sync(): Promise<Record<string, unknown>[]> {
      return [{ id: 1, title: 'Synced task' }];
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

  assert.deepEqual(await contract.getByProject(7), [{ ...projectSource, project_id: 7 }]);
  assert.equal(await contract.getById('missing'), null);
  assert.deepEqual(await contract.getAvailableSourceTypes(), sourceTypes);
  assert.deepEqual(await contract.previewSync('requirement-orders'), [previewTask]);
  assert.deepEqual(await contract.importIssues('requirement-orders', [importedTask], 1), importResult);
  assert.equal(await contract.testConnection('requirement-orders'), true);
});
