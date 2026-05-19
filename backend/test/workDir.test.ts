import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { join, sep } from 'node:path';

import { sanitizeWorkDir, joinWorkDir } from '../src/utils/workDir.js';

test.test('sanitizeWorkDir returns null for empty / whitespace / nullish input', () => {
  assert.equal(sanitizeWorkDir(null), null);
  assert.equal(sanitizeWorkDir(undefined), null);
  assert.equal(sanitizeWorkDir(''), null);
  assert.equal(sanitizeWorkDir('   '), null);
});

test.test('sanitizeWorkDir keeps simple relative paths', () => {
  assert.equal(sanitizeWorkDir('frontend'), 'frontend');
  assert.equal(sanitizeWorkDir('a/b/c'), join('a', 'b', 'c'));
  assert.equal(sanitizeWorkDir('safe-path_1.2'), 'safe-path_1.2');
});

test.test('sanitizeWorkDir strips leading ./ and trailing slashes', () => {
  assert.equal(sanitizeWorkDir('./x'), 'x');
  assert.equal(sanitizeWorkDir('x/'), 'x');
});

test.test('sanitizeWorkDir rejects ".." segments', () => {
  for (const v of ['..', '../etc', 'a/../../b']) {
    assert.throws(
      () => sanitizeWorkDir(v),
      (err: any) => err?.code === 'VALIDATION_ERROR' && /\.\./.test(err.userMessage),
      `expected ${v} to be rejected as a traversal`,
    );
  }
});

test.test('sanitizeWorkDir rejects absolute paths and drive letters', () => {
  for (const v of ['/abs', '\\abs', 'C:foo', 'd:/x']) {
    assert.throws(
      () => sanitizeWorkDir(v),
      (err: any) => err?.code === 'VALIDATION_ERROR' && /绝对路径/.test(err.userMessage),
      `expected ${v} to be rejected as absolute`,
    );
  }
});

test.test('sanitizeWorkDir rejects control characters', () => {
  assert.throws(
    () => sanitizeWorkDir('bad\x00name'),
    (err: any) => err?.code === 'VALIDATION_ERROR' && /控制字符/.test(err.userMessage),
  );
});

test.test('sanitizeWorkDir non-string input throws', () => {
  // @ts-expect-error: deliberate bad type
  assert.throws(() => sanitizeWorkDir(123), (err: any) => err?.code === 'VALIDATION_ERROR');
});

test.test('joinWorkDir returns executionPath when work_dir is empty/null', () => {
  assert.equal(joinWorkDir('/work', null), '/work');
  assert.equal(joinWorkDir('/work', ''), '/work');
  assert.equal(joinWorkDir('/work', '   '), '/work');
});

test.test('joinWorkDir joins valid relative paths', () => {
  assert.equal(joinWorkDir('/work', 'svc'), join('/work', 'svc'));
  assert.equal(joinWorkDir('/work', 'a/b'), join('/work', 'a', 'b'));
});

test.test('joinWorkDir rejects values that escape the worktree', () => {
  assert.throws(
    () => joinWorkDir('/work', '../etc'),
    (err: any) => err?.code === 'VALIDATION_ERROR',
  );
});

test.test('joinWorkDir trailing-separator root is handled', () => {
  // executionPath that already ends with sep should still produce containment.
  const root = `/work${sep}`;
  assert.equal(joinWorkDir(root, 'svc'), join(root, 'svc'));
});
