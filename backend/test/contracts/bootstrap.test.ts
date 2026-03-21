import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { buildApp } from '../../src/app.js';

test.test('buildApp constructs a Fastify instance without listening', async () => {
  const app = await buildApp();
  assert.equal(typeof app.listen, 'function');
  await app.close();
});
