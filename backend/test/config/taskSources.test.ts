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

test.test('loadAdapterTypes includes metadata-only INTERNAL_API definitions without request or mapping', async () => {
  const result = await loadAdapterTypes();
  const internalApi = result.find((typeDefinition) => typeDefinition.key === 'INTERNAL_API');

  assert.deepEqual(internalApi, {
    key: 'INTERNAL_API',
    name: 'Internal API',
    description: '从内部 API 同步任务（列表 + 详情两段拉取模板）',
    configFields: {
      baseUrl: {
        type: 'string',
        required: true,
        description: '内部 API 基础地址，例如 https://internal.example.com',
      },
      token: {
        type: 'string',
        required: true,
        description: 'Authorization 请求头值',
      },
      userId: {
        type: 'string',
        required: true,
        description: '用于 mine_todo 过滤的用户标识',
      },
      category: {
        type: 'string',
        required: false,
        description: '工作项分类过滤值',
        default: '5',
        valueType: 'string',
        options: [
          { label: 'Story', value: '5' },
        ],
      },
      status: {
        type: 'string',
        required: false,
        description: '工作项状态过滤值',
        default: '131',
        valueType: 'number',
        options: [
          { label: '待处理', value: 131 },
        ],
      },
      pageSize: {
        type: 'string',
        required: false,
        description: '每页工作项数量',
        default: '10',
        hidden: true,
      },
      listPath: {
        type: 'string',
        required: true,
        description: '工作项列表 API 的相对路径',
        default: '/devops-workitem/api/v1/query/workitems',
        hidden: true,
      },
      detailPath: {
        type: 'string',
        required: true,
        description: '详情 API 的相对路径模板',
        default: '/devops-workitem/api/v1/query/{number}/document_detail',
        hidden: true,
      },
      detailIdField: {
        type: 'string',
        required: false,
        description: '列表项中用于填充详情路径占位符的字段，默认为 number',
        default: 'number',
        hidden: true,
      },
      rejectUnauthorized: {
        type: 'boolean',
        required: false,
        description: '是否拒绝自签名证书（默认 true，设为 false 以接受自签名证书）',
        default: true,
      },
    },
  });
  assert.equal('request' in (internalApi ?? {}), false);
  assert.equal('mapping' in (internalApi ?? {}), false);
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
