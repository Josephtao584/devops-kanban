import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAdapter,
  getAvailableTypes,
  loadAdapters,
  registerAdapter,
} from '../../src/adapters/index.js';
import { TaskSourceAdapter } from '../../src/adapters/base.js';

test('auto-discovery loads built-in adapters with metadata when present', async () => {
  await loadAdapters();

  const types = getAvailableTypes();

  assert.equal(types.GITHUB.name, 'GitHub Issues');
  assert.equal(types.GITLAB.name, 'GitLab Issues');
  assert.equal(types.GITHUB.type, 'GITHUB');
  assert.equal(types.GITLAB.type, 'GITLAB');
  assert.deepEqual(types.GITHUB.config.state, {
    type: 'string',
    required: false,
    description: 'Issue state filter: open, closed, or all',
  });
});

test('getAdapter returns discovered gitlab adapter instance', async () => {
  await loadAdapters();

  const adapter = getAdapter('GITLAB', {
    type: 'GITLAB',
    config: {
      repo: 'group/project',
    },
  });

  assert.equal(adapter.constructor.type, 'GITLAB');
  assert.ok(adapter instanceof TaskSourceAdapter);
});

test('registerAdapter rejects subclasses without static type', () => {
  class MissingTypeAdapter extends TaskSourceAdapter {
    static metadata = { name: 'Missing type', description: 'invalid' };
    async fetch() { return []; }
    async testConnection() { return true; }
    convertToTask(item) { return item; }
  }

  assert.throws(
    () => registerAdapter(MissingTypeAdapter),
    /static type/
  );
});

test('registerAdapter allows subclasses without static metadata', () => {
  class MinimalAdapter extends TaskSourceAdapter {
    static type = 'MINIMAL';
    async fetch() { return []; }
    async testConnection() { return true; }
    convertToTask(item) { return item; }
  }

  assert.doesNotThrow(() => registerAdapter(MinimalAdapter));
});
