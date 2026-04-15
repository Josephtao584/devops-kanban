import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SchedulerService } from '../src/services/schedulerService.js';
import { TaskSourceRepository } from '../src/repositories/taskSourceRepository.js';
import { TaskRepository } from '../src/repositories/taskRepository.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'scheduler-test-'));
  const originalStoragePath = process.env.STORAGE_PATH;
  process.env.STORAGE_PATH = tempRoot;

  try {
    await run(tempRoot);
  } finally {
    if (originalStoragePath === undefined) {
      delete process.env.STORAGE_PATH;
    } else {
      process.env.STORAGE_PATH = originalStoragePath;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('registerJob and getStatus work correctly', async () => {
  await withIsolatedStorage(async () => {
    const scheduler = new SchedulerService();

    // Register a valid job
    const valid = scheduler.registerJob(1, '*/5 * * * *');
    assert.equal(valid, true);

    // Register another valid job
    scheduler.registerJob(2, '0 * * * *');

    const status = scheduler.getStatus();
    assert.equal(status.length, 2);
    assert.equal(status[0].sourceId, 1);
    assert.equal(status[0].running, true);
    assert.equal(status[1].sourceId, 2);

    // Invalid job should not be registered
    const invalid = scheduler.registerJob(3, 'invalid');
    assert.equal(invalid, false);
    assert.equal(scheduler.getStatus().length, 2);

    scheduler.shutdown();
  });
});

test.test('registerJob validates cron expression', async () => {
  await withIsolatedStorage(async () => {
    const scheduler = new SchedulerService();

    const valid = scheduler.registerJob(1, '*/5 * * * *');
    assert.equal(valid, true);

    const invalid = scheduler.registerJob(2, 'invalid-cron');
    assert.equal(invalid, false);

    scheduler.shutdown();
  });
});

test.test('unregisterJob removes a job', async () => {
  await withIsolatedStorage(async () => {
    const scheduler = new SchedulerService();
    scheduler.registerJob(1, '*/5 * * * *');

    assert.equal(scheduler.getStatus().length, 1);

    scheduler.unregisterJob(1);

    assert.equal(scheduler.getStatus().length, 0);

    scheduler.shutdown();
  });
});

test.test('shutdown stops all jobs', async () => {
  await withIsolatedStorage(async () => {
    const scheduler = new SchedulerService();
    scheduler.registerJob(1, '*/5 * * * *');
    scheduler.registerJob(2, '0 * * * *');

    assert.equal(scheduler.getStatus().length, 2);
    scheduler.shutdown();
    assert.equal(scheduler.getStatus().length, 0);
  });
});

test.test('matchRule finds matching label in rules', async () => {
  await withIsolatedStorage(async () => {
    const scheduler = new SchedulerService();
    const rules = [
      { label: 'bug', template_id: 'bug-fix-flow' },
      { label: 'feature', template_id: 'feature-dev-flow' },
    ];

    const matched = scheduler.matchRule(['bug', 'priority:high'], rules);
    assert.ok(matched);
    assert.equal(matched.template_id, 'bug-fix-flow');

    const unmatched = scheduler.matchRule(['docs'], rules);
    assert.equal(unmatched, null);

    scheduler.shutdown();
  });
});

test.test('reloadSource updates job configuration', async () => {
  await withIsolatedStorage(async () => {
    const scheduler = new SchedulerService();

    // Manually register a job
    scheduler.registerJob(1, '*/5 * * * *');
    assert.equal(scheduler.getStatus().length, 1);

    // Reload with no source in DB (unregistered)
    await scheduler.reloadSource(999);
    // Job for source 1 should still exist (reloadSource only touches source 999)
    assert.equal(scheduler.getStatus().length, 1);

    // Unregister manually
    scheduler.unregisterJob(1);
    assert.equal(scheduler.getStatus().length, 0);

    scheduler.shutdown();
  });
});
