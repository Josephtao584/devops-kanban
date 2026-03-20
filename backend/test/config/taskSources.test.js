import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  loadTaskSourceConfiguration,
  loadTaskSourceConfig,
  loadTaskSourceTypeConfig,
} from '../../src/config/taskSources.js';

async function withTempConfig(content, callback) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-source-config-'));
  const filePath = path.join(dir, 'config.yaml');
  await fs.writeFile(filePath, content, 'utf-8');

  try {
    return await callback(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('loadTaskSourceConfiguration returns configured types and enabled sources', async () => {
  await withTempConfig(`taskSourceTypes:
  - key: REQUIREMENT
    name: 需求池
    description: 从外部需求系统同步任务
    config:
      token: \${ACCESS_TOKEN}
  - key: TICKET
    name: 工单系统
    description: 从外部工单系统同步任务

taskSources:
  - id: requirement-orders
    name: Orders 需求池
    type: REQUIREMENT
    project_id: "1"
    config:
      token: \${ACCESS_TOKEN}
  - id: disabled-source
    name: Disabled Source
    type: REQUIREMENT
    project_id: 2
    enabled: false
    config: {}
`, async (filePath) => {
    const originalAccessToken = process.env.ACCESS_TOKEN;
    process.env.ACCESS_TOKEN = 'secret-token';

    try {
      const result = await loadTaskSourceConfiguration(filePath);

      assert.deepEqual(result.taskSourceTypes, [
        {
          key: 'REQUIREMENT',
          name: '需求池',
          description: '从外部需求系统同步任务',
          config: { token: 'secret-token' },
        },
        {
          key: 'TICKET',
          name: '工单系统',
          description: '从外部工单系统同步任务',
          config: {},
        },
      ]);
      assert.deepEqual(result.taskSources, [
        {
          id: 'requirement-orders',
          name: 'Orders 需求池',
          type: 'REQUIREMENT',
          project_id: 1,
          enabled: true,
          config: { token: 'secret-token' },
        },
      ]);

      assert.deepEqual(await loadTaskSourceConfig(filePath), result.taskSources);
      assert.deepEqual(await loadTaskSourceTypeConfig(filePath), result.taskSourceTypes);
    } finally {
      if (originalAccessToken === undefined) {
        delete process.env.ACCESS_TOKEN;
      } else {
        process.env.ACCESS_TOKEN = originalAccessToken;
      }
    }
  });
});

test('loadTaskSourceConfiguration rejects duplicate task source type keys', async () => {
  await withTempConfig(`taskSourceTypes:
  - key: REQUIREMENT
    name: 需求池
    description: first
  - key: REQUIREMENT
    name: 需求池重复
    description: second

taskSources: []
`, async (filePath) => {
    await assert.rejects(() => loadTaskSourceConfiguration(filePath), /Duplicate task source type key: REQUIREMENT/);
  });
});

test('loadTaskSourceConfiguration rejects source types missing from config', async () => {
  await withTempConfig(`taskSourceTypes:
  - key: REQUIREMENT
    name: 需求池
    description: desc

taskSources:
  - id: ticket-platform
    name: Platform 工单
    type: TICKET
    project_id: 1
    config: {}
`, async (filePath) => {
    await assert.rejects(
      () => loadTaskSourceConfiguration(filePath),
      /taskSources\[0\]\.type must reference a configured taskSourceTypes key/
    );
  });
});

test('loadTaskSourceConfiguration allows configured types without adapter implementation', async () => {
  await withTempConfig(`taskSourceTypes:
  - key: JIRA
    name: Jira Issues
    description: desc

taskSources: []
`, async (filePath) => {
    await assert.doesNotReject(() => loadTaskSourceConfiguration(filePath));
  });
});
