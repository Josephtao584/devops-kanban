import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { AppError, ValidationError, NotFoundError, ConflictError, BusinessError, InternalError } from '../src/utils/errors.js';

test.test('AppError has all required properties', () => {
  const err = new AppError({
    statusCode: 418,
    code: 'TEAPOT',
    userMessage: '我是一个茶壶',
    internalMessage: 'I am a teapot',
    context: { requestId: 'abc' },
  });

  assert.ok(err instanceof Error);
  assert.ok(err instanceof AppError);
  assert.equal(err.statusCode, 418);
  assert.equal(err.code, 'TEAPOT');
  assert.equal(err.userMessage, '我是一个茶壶');
  assert.equal(err.internalMessage, 'I am a teapot');
  assert.deepEqual(err.context, { requestId: 'abc' });
  assert.equal(err.message, 'I am a teapot');
  assert.equal(err.name, 'AppError');
});

test.test('AppError defaults context to empty object', () => {
  const err = new AppError({
    statusCode: 500,
    code: 'TEST',
    userMessage: 'test',
    internalMessage: 'test',
  });
  assert.deepEqual(err.context, {});
});

test.test('ValidationError sets correct defaults', () => {
  const err = new ValidationError('标题不能为空', 'Title is required');
  assert.ok(err instanceof AppError);
  assert.ok(err instanceof Error);
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.equal(err.userMessage, '标题不能为空');
  assert.equal(err.internalMessage, 'Title is required');
  assert.equal(err.name, 'ValidationError');
});

test.test('ValidationError with context', () => {
  const err = new ValidationError('标题不能为空', 'Title is required', { field: 'title' });
  assert.deepEqual(err.context, { field: 'title' });
});

test.test('NotFoundError sets correct defaults', () => {
  const err = new NotFoundError('项目未找到', 'Project not found');
  assert.equal(err.statusCode, 404);
  assert.equal(err.code, 'NOT_FOUND');
  assert.equal(err.name, 'NotFoundError');
});

test.test('NotFoundError with context', () => {
  const err = new NotFoundError('任务未找到', 'Task not found', { taskId: 42 });
  assert.deepEqual(err.context, { taskId: 42 });
});

test.test('ConflictError sets correct defaults', () => {
  const err = new ConflictError('资源已存在', 'Resource already exists');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'CONFLICT');
  assert.equal(err.name, 'ConflictError');
});

test.test('BusinessError sets correct defaults', () => {
  const err = new BusinessError('任务状态不允许此操作', 'Task status does not allow this operation');
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, 'BUSINESS_RULE');
  assert.equal(err.name, 'BusinessError');
});

test.test('InternalError sets correct defaults', () => {
  const err = new InternalError('服务内部错误', 'Unexpected null from database');
  assert.equal(err.statusCode, 500);
  assert.equal(err.code, 'INTERNAL_ERROR');
  assert.equal(err.name, 'InternalError');
});

test.test('AppError can be caught as normal Error', () => {
  try {
    throw new NotFoundError('未找到', 'Not found');
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.ok('statusCode' in error);
    if ('statusCode' in error) {
      assert.equal((error as { statusCode: number }).statusCode, 404);
    }
  }
});

test.test('getStatusCode utility works with AppError', async () => {
  const { getStatusCode } = await import('../src/utils/http.js');
  const err = new NotFoundError('未找到', 'Not found');
  assert.equal(getStatusCode(err), 404);
});

test.test('getErrorMessage returns userMessage for AppError', async () => {
  const { getErrorMessage } = await import('../src/utils/http.js');
  const err = new ValidationError('标题不能为空', 'Title is required');
  assert.equal(getErrorMessage(err, 'fallback'), '标题不能为空');
});

test.test('getErrorMessage falls back for plain Error', async () => {
  const { getErrorMessage } = await import('../src/utils/http.js');
  const err = new Error('plain error');
  assert.equal(getErrorMessage(err, 'fallback'), 'plain error');
});

test.test('getErrorMessage returns fallback for non-Error', async () => {
  const { getErrorMessage } = await import('../src/utils/http.js');
  assert.equal(getErrorMessage('string error', 'fallback'), 'fallback');
});
