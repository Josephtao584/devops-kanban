import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import {
  getAdapter,
  getAdapterMetadata,
  getAvailableTypes,
  registerAdapter,
} from '../../src/sources/index.js';
import { TaskSourceAdapter, UniversalAdapter } from '../../src/sources/base.js';
import type { ImportedTask } from '../../src/types/sources.ts';
import { loadAdapterTypes } from '../../src/config/taskSources.js';

test.test('source registry exposes built-in adapters with metadata', () => {
  const types = getAvailableTypes();

  assert.equal(typeof types.GITHUB, 'object');
  assert.equal(types.GITHUB?.name, 'GitHub Issues');
  assert.equal(typeof types.CODEHUB, 'object');
  assert.equal(types.CODEHUB?.name, 'CodeHub Issues');
  assert.deepEqual(types.GITHUB?.configFields && (types.GITHUB.configFields as Record<string, unknown>).state, {
    type: 'string',
    required: false,
    description: 'Issue 状态筛选：open、closed 或 all',
    default: 'open',
  });
});

test.test('INTERNAL_API appears in available types and metadata-only config does not force UniversalAdapter', () => {
  class InternalApiAdapter extends TaskSourceAdapter {
    static override type = 'INTERNAL_API';

    override async fetch(): Promise<ImportedTask[]> { return []; }
    override async testConnection(): Promise<boolean> { return true; }
    override convertToTask(item: unknown): ImportedTask { return item as ImportedTask; }
  }

  registerAdapter(InternalApiAdapter);

  const types = getAvailableTypes();
  assert.equal(types.INTERNAL_API?.name, 'CloudDevOps Story');
  assert.equal((types.INTERNAL_API?.configFields as Record<string, { default?: string }>).detailIdField?.default, 'number');
  assert.equal((types.INTERNAL_API?.configFields as Record<string, { default?: string }>).listPath?.default, '/devops-workitem/api/v1/query/workitems');
  assert.equal((types.INTERNAL_API?.configFields as Record<string, { default?: string | boolean }>).rejectUnauthorized?.default, false);
  assert.equal('request' in (types.INTERNAL_API ?? {}), false);
  assert.equal('mapping' in (types.INTERNAL_API ?? {}), false);

  const adapter = getAdapter('INTERNAL_API', {
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
    },
  });

  assert.ok(adapter instanceof InternalApiAdapter);
  assert.equal(adapter instanceof UniversalAdapter, false);
});

test.test('getAdapter returns configured codehub adapter instance', () => {
  const adapter = getAdapter('CODEHUB', {
    type: 'CODEHUB',
    config: {
      project_id: '123',
      baseUrl: 'https://codehub.huawei.com/api/v4',
    },
  });

  assert.ok(adapter instanceof UniversalAdapter);
  assert.equal(adapter.source.type, 'CODEHUB');
  assert.equal(adapter.source.config.project_id, '123');
  assert.equal(getAdapterMetadata('CODEHUB')?.name, 'CodeHub Issues');
});

test.test('CODEHUB request path keeps api version prefix in baseUrl', async () => {
  const adapterTypes = await loadAdapterTypes();
  const codehub = adapterTypes.find((typeDefinition) => typeDefinition.key === 'CODEHUB');

  assert.ok(codehub);
  assert.ok(codehub.request);

  const adapter = new UniversalAdapter({
    type: 'CODEHUB',
    config: {
      project_id: '123',
      baseUrl: 'https://codehub.huawei.com/api/v4',
    },
  }, codehub);

  const url = adapter._buildUrl(codehub.request.path, codehub.request.params);

  assert.equal(url.toString(), 'https://codehub.huawei.com/api/v4/projects/123/issues');
});

test.test('legacy GITLAB adapter is no longer exposed after CodeHub rename', () => {
  const types = getAvailableTypes();

  assert.equal(types.GITLAB, undefined);
  assert.equal(getAdapterMetadata('GITLAB'), null);
  assert.throws(() => getAdapter('GITLAB', { type: 'GITLAB', config: {} }), /Unsupported source type: GITLAB/);
});

test.test('registerAdapter rejects subclasses without static type', () => {
  class MissingTypeAdapter extends TaskSourceAdapter {
    static override metadata = { name: 'Missing type', description: 'invalid' };

    override async fetch(): Promise<ImportedTask[]> { return []; }
    override async testConnection(): Promise<boolean> { return true; }
    override convertToTask(item: unknown): ImportedTask { return item as ImportedTask; }
  }

  assert.throws(() => registerAdapter(MissingTypeAdapter), /static type/);
});

test.test('registerAdapter allows subclasses without static metadata', () => {
  class MinimalAdapter extends TaskSourceAdapter {
    static override type = 'MINIMAL';

    override async fetch(): Promise<ImportedTask[]> { return []; }
    override async testConnection(): Promise<boolean> { return true; }
    override convertToTask(item: unknown): ImportedTask { return item as ImportedTask; }
  }

  assert.doesNotThrow(() => registerAdapter(MinimalAdapter));
});
