import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import Fastify from 'fastify';
import { ValidationError, NotFoundError, ConflictError, BusinessError, InternalError } from '../src/utils/errors.js';

async function buildApp() {
  const app = Fastify({ logger: false });

  // Set error handler directly (same behavior as production - errorHandler.ts content)
  const { default: setupErrorHandler } = await import('../src/middleware/errorHandler.js');
  // The plugin uses setErrorHandler inside register(), which scopes it.
  // We need to apply it directly for testing.
  await setupErrorHandler(app);

  app.get('/app-error', async () => {
    throw new NotFoundError('项目未找到', 'Project not found', { projectId: 42 });
  });

  app.get('/validation-error', async () => {
    throw new ValidationError('标题不能为空', 'Title is required');
  });

  app.get('/conflict-error', async () => {
    throw new ConflictError('资源已存在', 'Resource already exists', { name: 'test' });
  });

  app.get('/business-error', async () => {
    throw new BusinessError('任务状态不允许此操作', 'Task status invalid', { status: 'DONE' });
  });

  app.get('/internal-error', async () => {
    throw new InternalError('服务内部错误', 'Unexpected null from database');
  });

  app.get('/legacy-error', async () => {
    const error: any = new Error('Legacy error message');
    error.statusCode = 400;
    throw error;
  });

  app.get('/legacy-404', async () => {
    const error: any = new Error('Something not found');
    error.statusCode = 404;
    throw error;
  });

  app.get('/legacy-500', async () => {
    const error: any = new Error('Database connection failed');
    error.statusCode = 500;
    throw error;
  });

  app.get('/plain-error', async () => {
    throw new Error('Something went wrong');
  });

  await app.ready();
  return app;
}

// --- AppError subclasses ---

test.test('NotFoundError returns Chinese userMessage and error code', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/app-error' });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.success, false);
  assert.equal(body.message, '项目未找到');
  assert.equal(body.code, 'NOT_FOUND');
  assert.equal(body.data, null);
});

test.test('ValidationError returns 400 with Chinese message', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/validation-error' });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.message, '标题不能为空');
  assert.equal(body.code, 'VALIDATION_ERROR');
});

test.test('ConflictError returns 409', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/conflict-error' });

  assert.equal(response.statusCode, 409);
  const body = response.json();
  assert.equal(body.message, '资源已存在');
  assert.equal(body.code, 'CONFLICT');
});

test.test('BusinessError returns 400', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/business-error' });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.message, '任务状态不允许此操作');
  assert.equal(body.code, 'BUSINESS_RULE');
});

test.test('InternalError returns 500 with generic message', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/internal-error' });

  assert.equal(response.statusCode, 500);
  const body = response.json();
  assert.equal(body.message, '服务内部错误');
  assert.equal(body.code, 'INTERNAL_ERROR');
  assert.equal(body.error, '服务内部错误');
});

// --- Legacy errors (plain Error with statusCode) ---

test.test('Legacy 400 error returns Chinese fallback message', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/legacy-error' });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.success, false);
  assert.equal(body.code, 'HTTP_400');
  assert.equal(body.message, '请求参数错误');
});

test.test('Legacy 404 error returns Chinese fallback message', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/legacy-404' });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.code, 'HTTP_404');
  assert.equal(body.message, '资源未找到');
});

test.test('Legacy 500 error returns generic Chinese message', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/legacy-500' });

  assert.equal(response.statusCode, 500);
  const body = response.json();
  assert.equal(body.message, '服务内部错误');
  assert.equal(body.code, 'HTTP_500');
});

// --- Error field security ---

test.test('4xx AppError does not leak internalMessage in error field', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/validation-error' });

  const body = response.json();
  assert.equal(body.message, '标题不能为空');
  // error field should be userMessage, NOT internalMessage (English)
  assert.equal(body.error, '标题不能为空');
  assert.ok(!body.error.includes('Title'), 'error field should not contain English internalMessage');
});

test.test('5xx AppError does not leak internalMessage in error field', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/internal-error' });

  const body = response.json();
  assert.equal(body.message, '服务内部错误');
  assert.equal(body.error, '服务内部错误');
  assert.ok(!body.error.includes('database'), 'error field should not expose internal details');
});

test.test('Legacy 5xx error hides original error message', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/legacy-500' });

  const body = response.json();
  assert.equal(body.message, '服务内部错误');
  assert.equal(body.error, '服务内部错误');
  assert.ok(!body.error.includes('Database'), 'error field should not expose raw error message');
});

test.test('Legacy 4xx error preserves message in error field', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/legacy-error' });

  const body = response.json();
  assert.equal(body.message, '请求参数错误');
  // Non-500 legacy errors keep original message in error field for backward compat
  assert.equal(body.error, 'Legacy error message');
});

// --- Unknown errors ---

test.test('Plain Error without statusCode returns 500', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/plain-error' });

  assert.equal(response.statusCode, 500);
  const body = response.json();
  assert.equal(body.message, '服务内部错误');
});

test.test('Non-existent route returns 404', async () => {
  const app = await buildApp();
  const response = await app.inject({ method: 'GET', url: '/nonexistent' });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.success, false);
});

// --- Response shape consistency ---

test.test('All error responses have consistent shape', async () => {
  const app = await buildApp();

  const urls = ['/app-error', '/validation-error', '/legacy-error', '/plain-error'];
  for (const url of urls) {
    const response = await app.inject({ method: 'GET', url });
    const body = response.json();
    assert.ok('success' in body, `${url}: missing success`);
    assert.ok('message' in body, `${url}: missing message`);
    assert.ok('code' in body, `${url}: missing code`);
    assert.ok('data' in body, `${url}: missing data`);
    assert.equal(body.success, false, `${url}: success should be false`);
    assert.equal(body.data, null, `${url}: data should be null`);
  }
});
