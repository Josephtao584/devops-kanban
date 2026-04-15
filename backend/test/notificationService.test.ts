import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { NotificationService } from '../src/services/notificationService.js';

test.test('NotificationService loads config from JSON file', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/notification-config.json' });
  const config = await service.getConfig();
  assert.equal(config.url, 'https://example.com/api/send');
  assert.equal(config.receiver, 'user-123');
  assert.equal(config.auth, 'test-token');
});

test.test('NotificationService returns null config when file missing', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/nonexistent.json' });
  const config = await service.getConfig();
  assert.equal(config, null);
});

test.test('NotificationService saves config to JSON file', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/notification-config-test.json' });
  await service.saveConfig({
    url: 'https://new.example.com/api/send',
    receiver: 'new-user',
    auth: 'new-token',
  });
  const config = await service.getConfig();
  assert.equal(config!.url, 'https://new.example.com/api/send');
  assert.equal(config!.receiver, 'new-user');
  assert.equal(config!.auth, 'new-token');
});

test.test('NotificationService sends HTTP POST with correct payload', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/notification-config.json' });

  let postedUrl = '';
  let postedBody: Record<string, unknown> | null = null;
  service._httpPost = async (url: string, body: Record<string, unknown>) => {
    postedUrl = url;
    postedBody = body;
    return { ok: true, status: 200 };
  };

  const result = await service.sendNotification('任务暂停 - 工作流等待确认');

  assert.equal(result, true);
  assert.equal(postedUrl, 'https://example.com/api/send');
  assert.equal(postedBody!.content, '任务暂停 - 工作流等待确认');
  assert.equal(postedBody!.receiver, 'user-123');
  assert.equal(postedBody!.auth, 'test-token');
});

test.test('NotificationService returns false when config missing', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/nonexistent.json' });

  let posted = false;
  service._httpPost = async () => {
    posted = true;
    return { ok: true, status: 200 };
  };

  const result = await service.sendNotification('test');
  assert.equal(result, false);
  assert.equal(posted, false);
});

test.test('NotificationService returns false when HTTP POST fails', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/notification-config.json' });

  service._httpPost = async () => {
    throw new Error('network error');
  };

  const result = await service.sendNotification('test');
  assert.equal(result, false);
});

test.test('NotificationService returns false when HTTP response not ok', async () => {
  const service = new NotificationService({ filePath: 'test/fixtures/notification-config.json' });

  service._httpPost = async () => {
    return { ok: false, status: 500 };
  };

  const result = await service.sendNotification('test');
  assert.equal(result, false);
});
