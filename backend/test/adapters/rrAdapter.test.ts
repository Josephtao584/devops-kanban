import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { RRAdapter } from '../../src/sources/rrAdapter.js';

test.test('RRAdapter fetches paginated list and detail, maps all tasks to TODO', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
      userId: '20001',
      pageSize: 2,
    },
  });

  const requests: Array<{ pathValue: string; requestOptions: { method?: string; body?: unknown } | undefined }> = [];
  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requests.push({ pathValue, requestOptions });

    if (pathValue === '/vision-workitem/api/query/requirements/single_list') {
      const page = (requestOptions?.body as { pagination?: { current_page?: number } })?.pagination?.current_page;
      if (page === 1) {
        return {
          code: 200,
          data: {
            result: [
              {
                id: 1001,
                number: 'RR2022122300218',
                title: '需求分析报告',
                created_time: '2024-01-15T08:00:00Z',
                updated_time: '2024-01-16T10:30:00Z',
              },
            ],
            total_pages: 2,
            current_page: 1,
            total_records: 3,
            page_size: 2,
          },
        };
      }

      if (page === 2) {
        return {
          code: 200,
          data: {
            result: [
              {
                id: 1002,
                number: 'RR2022122300219',
                title: '系统设计方案',
                created_time: '2024-02-01T09:00:00Z',
                updated_time: '2024-02-02T14:20:00Z',
              },
            ],
            total_pages: 2,
            current_page: 2,
            total_records: 3,
            page_size: 2,
          },
        };
      }
    }

    if (pathValue === '/vision-workitem/api/raw_requirements/RR2022122300218/description') {
      return {
        code: 200,
        data: {
          descriptions: [
            {
              attr_name: '背景',
              value: '项目背景说明',
              children: [
                { attr_name: '子项', value: '详细背景' },
              ],
            },
            {
              attr_name: '目标',
              value: '<p>主要目标</p>',
            },
          ],
        },
      };
    }

    if (pathValue === '/vision-workitem/api/raw_requirements/RR2022122300219/description') {
      return {
        code: 200,
        data: {
          descriptions: [
            {
              attr_name: '范围',
              value: '<strong>设计范围</strong>',
            },
          ],
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.deepEqual(requests, [
    {
      pathValue: '/vision-workitem/api/query/requirements/single_list',
      requestOptions: {
        method: 'POST',
        body: {
          data_type: 'list',
          select_field: ['all'],
          first_filters: [
            { key: 'user_status', operator: '!', value: ['REQ_STATUS_DONE'] },
            { key: 'current_owners', operator: '||', value: [20001] },
          ],
          sort: { key: 'updated_time', value: 'desc' },
          pagination: { current_page: 1, page_size: 2 },
        },
      },
    },
    {
      pathValue: '/vision-workitem/api/query/requirements/single_list',
      requestOptions: {
        method: 'POST',
        body: {
          data_type: 'list',
          select_field: ['all'],
          first_filters: [
            { key: 'user_status', operator: '!', value: ['REQ_STATUS_DONE'] },
            { key: 'current_owners', operator: '||', value: [20001] },
          ],
          sort: { key: 'updated_time', value: 'desc' },
          pagination: { current_page: 2, page_size: 2 },
        },
      },
    },
    {
      pathValue: '/vision-workitem/api/raw_requirements/RR2022122300218/description',
      requestOptions: undefined,
    },
    {
      pathValue: '/vision-workitem/api/raw_requirements/RR2022122300219/description',
      requestOptions: undefined,
    },
  ]);

  assert.equal(tasks.length, 2);

  assert.equal(tasks[0].external_id, 'RR2022122300218');
  assert.equal(tasks[0].title, '需求分析报告');
  assert.ok(tasks[0].description.includes('背景'));
  assert.ok(tasks[0].description.includes('项目背景说明'));
  assert.ok(tasks[0].description.includes('子项'));
  assert.ok(tasks[0].description.includes('详细背景'));
  assert.ok(tasks[0].description.includes('目标'));
  assert.ok(tasks[0].description.includes('主要目标'));
  assert.equal(tasks[0].status, 'TODO');
  assert.equal(tasks[0].external_url, 'https://devops.example/vision-workitem/api/raw_requirements/RR2022122300218');
  assert.deepEqual(tasks[0].labels, []);
  assert.equal(tasks[0].created_at, '2024-01-15T08:00:00Z');
  assert.equal(tasks[0].updated_at, '2024-01-16T10:30:00Z');

  assert.equal(tasks[1].external_id, 'RR2022122300219');
  assert.equal(tasks[1].title, '系统设计方案');
  assert.ok(tasks[1].description.includes('范围'));
  assert.ok(tasks[1].description.includes('设计范围'));
  assert.equal(tasks[1].status, 'TODO');
  assert.equal(tasks[1].external_url, 'https://devops.example/vision-workitem/api/raw_requirements/RR2022122300219');
  assert.deepEqual(tasks[1].labels, []);
  assert.equal(tasks[1].created_at, '2024-02-01T09:00:00Z');
  assert.equal(tasks[1].updated_at, '2024-02-02T14:20:00Z');
});

test.test('RRAdapter testConnection returns true on successful POST', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
      userId: '20001',
    },
  });

  let requestPayload: { pathValue: string; requestOptions: { method?: string; body?: unknown } | undefined } | null = null;
  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requestPayload = { pathValue, requestOptions };
    return {
      code: 200,
      data: { result: [], total_pages: 1, current_page: 1 },
    };
  };

  const connected = await adapter.testConnection();

  assert.equal(connected, true);
  assert.deepEqual(requestPayload, {
    pathValue: '/vision-workitem/api/query/requirements/single_list',
    requestOptions: {
      method: 'POST',
      body: {
        data_type: 'list',
        select_field: ['all'],
        first_filters: [
          { key: 'user_status', operator: '!', value: ['REQ_STATUS_DONE'] },
          { key: 'current_owners', operator: '||', value: [20001] },
        ],
        sort: { key: 'updated_time', value: 'desc' },
        pagination: { current_page: 1, page_size: 10 },
      },
    },
  });
});

test.test('RRAdapter testConnection returns false when request fails', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
      userId: '20001',
    },
  });

  adapter._request = async () => {
    throw new Error('network error');
  };

  const connected = await adapter.testConnection();

  assert.equal(connected, false);
});

test.test('RRAdapter testConnection returns false when API returns non-200 code', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
      userId: '20001',
    },
  });

  adapter._request = async () => {
    return {
      code: 401,
      message: 'Unauthorized',
    };
  };

  const connected = await adapter.testConnection();

  assert.equal(connected, false);
});

test.test('RRAdapter fetch throws when userId is missing', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
    },
  });

  await assert.rejects(() => adapter.fetch(), /userId is required/);
});

test.test('RRAdapter fetch throws when baseUrl is missing', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      token: 'Bearer rr-token',
      userId: '20001',
    },
  });

  await assert.rejects(() => adapter.fetch(), /baseUrl is required/);
});

test.test('RRAdapter converts HTML in description to Markdown', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
      userId: '20001',
    },
  });

  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    if (pathValue === '/vision-workitem/api/query/requirements/single_list') {
      const page = (requestOptions?.body as { pagination?: { current_page?: number } })?.pagination?.current_page;
      if (page === 1) {
        return {
          code: 200,
          data: {
            result: [
              {
                id: 1003,
                number: 'RR-HTML-001',
                title: 'HTML需求',
              },
            ],
            total_pages: 1,
            current_page: 1,
          },
        };
      }
    }

    if (pathValue === '/vision-workitem/api/raw_requirements/RR-HTML-001/description') {
      return {
        code: 200,
        data: {
          descriptions: [
            {
              attr_name: '说明',
              value: '<h2>标题</h2><p><strong>重点：</strong> 内容<br>换行</p><ul><li>项目A</li><li>项目B</li></ul><a href="https://example.com">链接</a>',
            },
          ],
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].external_id, 'RR-HTML-001');
  assert.ok(tasks[0].description.includes('## 标题'));
  assert.ok(tasks[0].description.includes('**重点：**'));
  assert.ok(tasks[0].description.includes('项目A'));
  assert.ok(tasks[0].description.includes('链接 (https://example.com)'));
  assert.equal(tasks[0].status, 'TODO');
});

test.test('RRAdapter handles empty descriptions gracefully', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer rr-token',
      userId: '20001',
    },
  });

  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    if (pathValue === '/vision-workitem/api/query/requirements/single_list') {
      const page = (requestOptions?.body as { pagination?: { current_page?: number } })?.pagination?.current_page;
      if (page === 1) {
        return {
          code: 200,
          data: {
            result: [
              {
                id: 1004,
                number: 'RR-EMPTY',
                title: '空描述需求',
              },
            ],
            total_pages: 1,
            current_page: 1,
          },
        };
      }
    }

    if (pathValue === '/vision-workitem/api/raw_requirements/RR-EMPTY/description') {
      return {
        code: 200,
        data: {
          descriptions: [],
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].external_id, 'RR-EMPTY');
  assert.equal(tasks[0].description, '');
  assert.equal(tasks[0].status, 'TODO');
});

test.test('RRAdapter uses default paths when not configured', () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      userId: '20001',
    },
  });

  assert.equal(adapter.listPath, '/vision-workitem/api/query/requirements/single_list');
  assert.equal(adapter.detailPath, '/vision-workitem/api/raw_requirements/{number}/description');
});

test.test('RRAdapter allows custom paths override', () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      userId: '20001',
      listPath: '/custom/list',
      detailPath: '/custom/detail/{id}',
    },
  });

  assert.equal(adapter.listPath, '/custom/list');
  assert.equal(adapter.detailPath, '/custom/detail/{id}');
});

test.test('RRAdapter convertToTask handles missing fields gracefully', () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      userId: '20001',
    },
  });

  const task = adapter.convertToTask({});

  assert.equal(task.external_id, '');
  assert.equal(task.title, 'Untitled');
  assert.equal(task.description, '');
  assert.equal(task.external_url, '');
  assert.equal(task.status, 'TODO');
  assert.deepEqual(task.labels, []);
  assert.equal(task.created_at, null);
  assert.equal(task.updated_at, null);
});

test.test('RRAdapter static metadata is correctly set', () => {
  assert.equal(RRAdapter.type, 'CLOUDDEVOPS_RR');
  assert.deepEqual(RRAdapter.metadata, {
    type: 'CLOUDDEVOPS_RR',
    name: 'CloudDevOps RR',
    description: '从 CloudDevOps 同步需求（RR）任务',
  });
});

test.test('RRAdapter handles non-numeric userId', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      userId: 'user-abc-123',
    },
  });

  let requestBody: Record<string, unknown> | undefined;
  adapter._request = async (_pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requestBody = requestOptions?.body as Record<string, unknown> | undefined;
    return {
      code: 200,
      data: { result: [], total_pages: 1, current_page: 1 },
    };
  };

  await adapter.testConnection();

  assert.ok(requestBody);
  const filters = (requestBody as { first_filters: Array<{ key: string; value: unknown[] }> }).first_filters;
  const ownerFilter = filters.find((f) => f.key === 'current_owners');
  assert.ok(ownerFilter);
  assert.deepEqual(ownerFilter.value, ['user-abc-123']);
});

test.test('RRAdapter handles single page response', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      userId: '20001',
    },
  });

  const requests: string[] = [];
  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requests.push(pathValue);
    if (pathValue === '/vision-workitem/api/query/requirements/single_list') {
      return {
        code: 200,
        data: {
          result: [
            {
              id: 1005,
              number: 'RR-SINGLE',
              title: '单页需求',
            },
          ],
          total_pages: 1,
          current_page: 1,
        },
      };
    }

    if (pathValue === '/vision-workitem/api/raw_requirements/RR-SINGLE/description') {
      return {
        code: 200,
        data: {
          descriptions: [{ attr_name: '内容', value: '简单描述' }],
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].external_id, 'RR-SINGLE');
  assert.equal(tasks[0].title, '单页需求');
  assert.equal(tasks[0].status, 'TODO');
  assert.equal(requests.length, 2);
});

test.test('RRAdapter handles error response from detail API gracefully', async () => {
  const adapter = new RRAdapter({
    type: 'CLOUDDEVOPS_RR',
    config: {
      baseUrl: 'https://devops.example',
      userId: '20001',
    },
  });

  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    if (pathValue === '/vision-workitem/api/query/requirements/single_list') {
      const page = (requestOptions?.body as { pagination?: { current_page?: number } })?.pagination?.current_page;
      if (page === 1) {
        return {
          code: 200,
          data: {
            result: [
              {
                id: 1006,
                number: 'RR-ERROR',
                title: '错误详情需求',
              },
            ],
            total_pages: 1,
            current_page: 1,
          },
        };
      }
    }

    if (pathValue === '/vision-workitem/api/raw_requirements/RR-ERROR/description') {
      return {
        code: 500,
        message: 'Internal Server Error',
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].external_id, 'RR-ERROR');
  assert.equal(tasks[0].description, '');
  assert.equal(tasks[0].status, 'TODO');
});
