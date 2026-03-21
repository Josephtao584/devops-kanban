import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  loadAdapterTypeConfig,
  loadAdapterTypes,
  substituteConfigPlaceholders,
} from '../../src/config/taskSources.js';

async function withTempConfig<T>(content: string, callback: (filePath: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-source-config-'));
  const filePath = path.join(dir, 'config.yaml');
  await fs.writeFile(filePath, content, 'utf-8');

  try {
    return await callback(filePath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test.test('loadAdapterTypeConfig returns configured adapter types with env substitution', async () => {
  await withTempConfig(`adapterTypes:
  - key: GITHUB
    name: GitHub Issues
    description: 从 GitHub 同步任务
    configFields:
      token: \${ACCESS_TOKEN}
    request:
      baseUrl: https://api.github.com
      path: /repos/{repo}/issues
      params:
        state: open
    response:
      type: array
    mapping:
      title: $.title
      external_id: $.id
  - key: JIRA
    name: Jira Issues
    description: 从 Jira 同步任务
`, async (filePath) => {
    const originalAccessToken = process.env.ACCESS_TOKEN;
    process.env.ACCESS_TOKEN = 'secret-token';

    try {
      const result = await loadAdapterTypeConfig(filePath);

      assert.deepEqual(result, [
        {
          key: 'GITHUB',
          name: 'GitHub Issues',
          description: '从 GitHub 同步任务',
          configFields: { token: 'secret-token' },
          request: {
            baseUrl: 'https://api.github.com',
            path: '/repos/{repo}/issues',
            params: { state: 'open' },
          },
          response: { type: 'array' },
          mapping: {
            title: '$.title',
            external_id: '$.id',
          },
        },
        {
          key: 'JIRA',
          name: 'Jira Issues',
          description: '从 Jira 同步任务',
          configFields: {},
        },
      ]);
    } finally {
      if (originalAccessToken === undefined) {
        delete process.env.ACCESS_TOKEN;
      } else {
        process.env.ACCESS_TOKEN = originalAccessToken;
      }
    }
  });
});

test.test('loadAdapterTypeConfig rejects duplicate adapter type keys', async () => {
  await withTempConfig(`adapterTypes:
  - key: GITHUB
    name: GitHub Issues
    description: first
  - key: GITHUB
    name: GitHub Issues Duplicate
    description: second
`, async (filePath) => {
    await assert.rejects(() => loadAdapterTypeConfig(filePath), /Duplicate adapter type key: GITHUB/);
  });
});

test.test('loadAdapterTypeConfig rejects invalid request methods', async () => {
  await withTempConfig(`adapterTypes:
  - key: GITHUB
    name: GitHub Issues
    description: desc
    request:
      baseUrl: https://api.github.com
      path: /repos/{repo}/issues
      method: TRACE
    response:
      type: array
    mapping:
      title: $.title
      external_id: $.id
`, async (filePath) => {
    await assert.rejects(() => loadAdapterTypeConfig(filePath), /request\.method must be a valid HTTP method/);
  });
});

test.test('loadAdapterTypes reads default config file', async () => {
  const result = await loadAdapterTypes();
  assert.equal(Array.isArray(result), true);
  assert.equal(result.every((typeDefinition) => typeof typeDefinition.key === 'string'), true);
});

test.test('substituteConfigPlaceholders resolves nested placeholders and preserves missing values', () => {
  assert.equal(
    substituteConfigPlaceholders('/repos/{repo}/issues/{filters.state}', {
      repo: 'owner/repo',
      filters: { state: 'open' },
    }),
    '/repos/owner/repo/issues/open'
  );

  assert.equal(
    substituteConfigPlaceholders('/repos/{repo}/issues/{missing.value}', {
      repo: 'owner/repo',
    }),
    '/repos/owner/repo/issues/{missing.value}'
  );
});
