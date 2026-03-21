import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { getAdapterMetadata, hasAdapter } from '../../src/sources/index.js';

test.test('source registry exposes configured source types', () => {
  assert.equal(typeof hasAdapter('github'), 'boolean');
});

test.test('source registry returns metadata or null for a source type', () => {
  const metadata = getAdapterMetadata('github');
  assert.equal(metadata === null || typeof metadata === 'object', true);
});
