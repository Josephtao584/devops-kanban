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

test.test('source registry exposes built-in adapters with metadata', () => {
  const types = getAvailableTypes();

  assert.equal(typeof types.GITHUB, 'object');
  assert.equal(types.GITHUB?.name, 'GitHub Issues');
  assert.equal(typeof types.GITLAB, 'object');
  assert.equal(types.GITLAB?.name, 'GitLab Issues');
  assert.deepEqual(types.GITHUB?.configFields && (types.GITHUB.configFields as Record<string, unknown>).state, {
    type: 'string',
    required: false,
    description: 'Issue state filter: open, closed, or all',
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
  assert.equal(types.INTERNAL_API?.name, 'Internal API');
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

test.test('getAdapter returns discovered gitlab adapter instance', () => {
  const adapter = getAdapter('GITLAB', {
    type: 'GITLAB',
    config: {
      repo: 'group/project',
    },
  });

  assert.ok(adapter instanceof TaskSourceAdapter);
  assert.equal(adapter.source.type, 'GITLAB');
  assert.equal(adapter.source.config.repo, 'group/project');
  assert.equal(getAdapterMetadata('GITLAB')?.name, 'GitLab Issues');
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
