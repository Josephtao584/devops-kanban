import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { successResponse, errorResponse } from '../../src/utils/response.js';

test.test('api helper success response includes error field', () => {
  const result = successResponse({ ok: true }, 'done');
  assert.deepEqual(result, {
    success: true,
    message: 'done',
    data: { ok: true },
    error: null,
  });
});

test.test('api helper error response includes null data', () => {
  const result = errorResponse('boom', 'detail');
  assert.deepEqual(result, {
    success: false,
    message: 'boom',
    data: null,
    error: 'detail',
  });
});
