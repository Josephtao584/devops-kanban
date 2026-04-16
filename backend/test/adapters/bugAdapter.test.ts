import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { BugAdapter } from '../../src/sources/bugAdapter.js';

// Helper to create a BugAdapter with standard config
function createAdapter(configOverrides: Record<string, unknown> = {}) {
  return new BugAdapter({
    type: 'CLOUDDEVOPS_BUG',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer bug-token',
      userId: '20001',
      ...configOverrides,
    },
  });
}

// ── Static metadata ──

test.test('BugAdapter static metadata is correctly set', () => {
  assert.equal(BugAdapter.type, 'CLOUDDEVOPS_BUG');
  assert.deepEqual(BugAdapter.metadata, {
    type: 'CLOUDDEVOPS_BUG',
    name: 'CloudDevOps Bug',
    description: '从 CloudDevOps 同步 Bug 任务',
  });
});

// ── Default paths ──

test.test('BugAdapter uses default paths when not configured', () => {
  const adapter = createAdapter();
  assert.equal(adapter.listPath, '/vision-defect-management/api/query/issues');
  assert.equal(adapter.detailPath, '/vision-defect-management/api/bugs/bugDetail/{number}');
});

test.test('BugAdapter allows custom paths override', () => {
  const adapter = createAdapter({
    listPath: '/custom/bugs',
    detailPath: '/custom/bug/{number}',
  });
  assert.equal(adapter.listPath, '/custom/bugs');
  assert.equal(adapter.detailPath, '/custom/bug/{number}');
});

// ── Request body building ──

test.test('_buildBugListBody builds correct filter payload', () => {
  const adapter = createAdapter({ userId: '30001' });
  const body = adapter._buildBugListBody(1);

  assert.deepEqual(body.filters, [
    { key: 'user_status', operator: '!', value: ['ISSUE_STATUS_DONE'] },
    { key: 'current_owners', operator: '||', value: [30001] },
  ]);
  assert.deepEqual(body.sorts, [{ key: 'updated_time', value: 'desc' }]);
  assert.deepEqual(body.pagination, { current_page: 1, page_size: 10 });
});

test.test('_buildBugListBody handles non-numeric userId', () => {
  const adapter = createAdapter({ userId: 'user-abc' });
  const body = adapter._buildBugListBody(2);

  const ownerFilter = (body.filters as Array<Record<string, unknown>>)[1];
  assert.ok(ownerFilter);
  assert.deepEqual(ownerFilter.value, ['user-abc']);
  assert.deepEqual(body.pagination, { current_page: 2, page_size: 10 });
});

test.test('_buildBugListBody handles missing userId', () => {
  const adapter = new BugAdapter({
    type: 'CLOUDDEVOPS_BUG',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer bug-token',
      // userId not provided
    },
  });
  const body = adapter._buildBugListBody(1);
  const ownerFilter = (body.filters as Array<Record<string, unknown>>)[1];
  assert.ok(ownerFilter);
  assert.deepEqual(ownerFilter.value, ['']);
});

// ── Pagination detection (_isLastBugPage) ──

test.test('_isLastBugPage returns true when currentPage >= totalPages', () => {
  const adapter = createAdapter();
  const response = { data: { total_pages: 3, current_page: 3 } };
  assert.equal(adapter._isLastBugPage(response, 5), true);
});

test.test('_isLastBugPage returns false when more pages remain', () => {
  const adapter = createAdapter();
  const response = { data: { total_pages: 3, current_page: 1 } };
  assert.equal(adapter._isLastBugPage(response, 10), false);
});

test.test('_isLastBugPage falls back to itemCount < pageSize', () => {
  const adapter = createAdapter();
  const response = { data: { some_other: 'field' } };
  assert.equal(adapter._isLastBugPage(response, 5), true);  // 5 < 10 (default pageSize)
  assert.equal(adapter._isLastBugPage(response, 10), false); // 10 >= 10
});

test.test('_isLastBugPage returns true for invalid responses', () => {
  const adapter = createAdapter();
  assert.equal(adapter._isLastBugPage(null, 0), true);
  assert.equal(adapter._isLastBugPage(undefined, 0), true);
  assert.equal(adapter._isLastBugPage('string', 0), true);
  assert.equal(adapter._isLastBugPage([], 0), true);
});

// ── RTF description parsing (_parseBugDescription) ──

test.test('_parseBugDescription parses JSON node tree into text', () => {
  const adapter = createAdapter();
  const response = {
    code: 200,
    data: {
      description: JSON.stringify([
        { value: '背景说明', children: [{ value: '子项详情' }] },
        { value: '复现步骤' },
      ]),
    },
  };

  const result = adapter._parseBugDescription(response);
  assert.ok(result.includes('背景说明'));
  assert.ok(result.includes('子项详情'));
  assert.ok(result.includes('复现步骤'));
});

test.test('_parseBugDescription falls back to plain text when description is not JSON', () => {
  const adapter = createAdapter();
  const response = {
    code: 200,
    data: {
      description: 'Plain text description <p>with html</p>',
    },
  };

  const result = adapter._parseBugDescription(response);
  assert.ok(result.includes('Plain text description'));
  assert.ok(result.includes('with html'));
});

test.test('_parseBugDescription returns empty string for non-200 code', () => {
  const adapter = createAdapter();
  const response = { code: 500, message: 'Server Error' };
  assert.equal(adapter._parseBugDescription(response), '');
});

test.test('_parseBugDescription returns empty string for missing description', () => {
  const adapter = createAdapter();
  assert.equal(adapter._parseBugDescription({ code: 200, data: {} }), '');
  assert.equal(adapter._parseBugDescription(null), '');
});

test.test('_parseBugDescription handles nested children recursively', () => {
  const adapter = createAdapter();
  const response = {
    code: 200,
    data: {
      description: JSON.stringify([
        { value: 'Level 1', children: [
          { value: 'Level 2', children: [
            { value: 'Level 3' },
          ] },
        ] },
      ]),
    },
  };

  const result = adapter._parseBugDescription(response);
  assert.ok(result.includes('Level 1'));
  assert.ok(result.includes('Level 2'));
  assert.ok(result.includes('Level 3'));
});

// ── Full fetch flow ──

test.test('BugAdapter fetches paginated list and detail, maps to tasks', async () => {
  const adapter = createAdapter({ pageSize: 2 });
  const requests: Array<{ pathValue: string; requestOptions: { method?: string; body?: unknown } | undefined }> = [];

  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requests.push({ pathValue, requestOptions });

    if (pathValue === '/vision-defect-management/api/query/issues') {
      const page = (requestOptions?.body as { pagination?: { current_page?: number } })?.pagination?.current_page;
      if (page === 1) {
        return {
          code: 200,
          data: {
            result: [
              { id: 2001, number: 'BUG-001', title: '登录页面崩溃', created_time: '2024-03-01T08:00:00Z', updated_time: '2024-03-02T10:00:00Z' },
              { id: 2002, number: 'BUG-002', title: '导出功能异常', created_time: '2024-03-03T09:00:00Z', updated_time: '2024-03-04T11:00:00Z' },
            ],
            total_pages: 2,
            current_page: 1,
          },
        };
      }
      if (page === 2) {
        return {
          code: 200,
          data: {
            result: [
              { id: 2003, number: 'BUG-003', title: '权限校验失败', created_time: '2024-03-05T07:00:00Z', updated_time: '2024-03-06T12:00:00Z' },
            ],
            total_pages: 2,
            current_page: 2,
          },
        };
      }
    }

    if (pathValue.includes('/bugDetail/')) {
      const bugNumber = pathValue.split('/bugDetail/')[1];
      return {
        code: 200,
        data: {
          description: JSON.stringify([{ value: `Bug ${bugNumber} 描述` }]),
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.equal(tasks.length, 3);

  assert.equal(tasks[0]!.external_id, 'BUG-001');
  assert.equal(tasks[0]!.title, '登录页面崩溃');
  assert.ok(tasks[0]!.description!.includes('Bug BUG-001 描述'));
  assert.equal(tasks[0]!.status, 'TODO');
  assert.equal(tasks[0]!.external_url, 'https://devops.example/#/bug/BUG-001');
  assert.equal(tasks[0]!.created_at, '2024-03-01T08:00:00Z');

  assert.equal(tasks[1]!.external_id, 'BUG-002');
  assert.equal(tasks[1]!.title, '导出功能异常');

  assert.equal(tasks[2]!.external_id, 'BUG-003');
  assert.equal(tasks[2]!.title, '权限校验失败');
});

// ── Validation ──

test.test('BugAdapter fetch throws when baseUrl is missing', async () => {
  const adapter = createAdapter({});
  delete (adapter as unknown as Record<string, unknown>).baseUrl;
  (adapter as unknown as Record<string, unknown>).baseUrl = '';

  await assert.rejects(() => adapter.fetch(), /baseUrl is required/);
});

test.test('BugAdapter fetch throws when userId is missing', async () => {
  const adapter = new BugAdapter({
    type: 'CLOUDDEVOPS_BUG',
    config: {
      baseUrl: 'https://devops.example',
      token: 'Bearer bug-token',
    },
  });

  await assert.rejects(() => adapter.fetch(), /userId is required/);
});

// ── testConnection ──

test.test('BugAdapter testConnection returns true on successful POST', async () => {
  const adapter = createAdapter();

  adapter._request = async () => ({
    code: 200,
    data: [],
  });

  assert.equal(await adapter.testConnection(), true);
});

test.test('BugAdapter testConnection returns false when request fails', async () => {
  const adapter = createAdapter();

  adapter._request = async () => { throw new Error('network error'); };

  assert.equal(await adapter.testConnection(), false);
});

test.test('BugAdapter testConnection returns false when API returns non-200', async () => {
  const adapter = createAdapter();

  adapter._request = async () => ({ code: 401, message: 'Unauthorized' });

  assert.equal(await adapter.testConnection(), false);
});

test.test('BugAdapter testConnection returns false when baseUrl missing', async () => {
  const adapter = createAdapter({});
  delete (adapter as unknown as Record<string, unknown>).baseUrl;
  (adapter as unknown as Record<string, unknown>).baseUrl = '';

  assert.equal(await adapter.testConnection(), false);
});

// ── convertToTask ──

test.test('convertToTask handles missing fields gracefully', () => {
  const adapter = createAdapter();

  const task = adapter.convertToTask({});

  assert.equal(task.external_id, '');
  assert.equal(task.title, 'Untitled');
  assert.equal(task.description, '');
  assert.equal(task.external_url, '');
  assert.equal(task.status, 'TODO');
  assert.deepEqual(task.labels, []);
});

test.test('convertToTask builds external_url from baseUrl and number', () => {
  const adapter = createAdapter();

  const task = adapter.convertToTask({
    number: 'BUG-123',
    title: 'Test Bug',
    description: 'Some desc',
  });

  assert.equal(task.external_url, 'https://devops.example/#/bug/BUG-123');
});

test.test('convertToTask falls back to external_id or id when number is missing', () => {
  const adapter = createAdapter();

  const task = adapter.convertToTask({
    external_id: 'EXT-456',
    title: 'No number',
  });

  assert.equal(task.external_id, 'EXT-456');
  assert.equal(task.external_url, 'https://devops.example/#/bug/EXT-456');
});

// ── Error handling in fetch ──

test.test('BugAdapter fetch stops pagination on list request failure', async () => {
  const adapter = createAdapter({ pageSize: 2 });
  let listCallCount = 0;

  adapter._request = async (pathValue: string) => {
    if (pathValue === '/vision-defect-management/api/query/issues') {
      listCallCount++;
      if (listCallCount === 1) {
        return {
          code: 200,
          data: {
            result: [
              { id: 1, number: 'BUG-A', title: 'First Bug' },
            ],
            total_pages: 5,
            current_page: 1,
          },
        };
      }
      throw new Error('Network error on page 2');
    }
    return { code: 200, data: { description: JSON.stringify([{ value: 'desc' }]) } };
  };

  const tasks = await adapter.fetch();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.external_id, 'BUG-A');
  assert.equal(listCallCount, 2); // success + failure
});

test.test('BugAdapter _assertBugSuccessResponse throws on non-200 code', () => {
  const adapter = createAdapter();

  assert.throws(
    () => adapter._assertBugSuccessResponse({ code: 500, message: 'Internal Error' }),
    /Bug API error: 500/,
  );
});

test.test('BugAdapter _assertBugSuccessResponse does not throw on 200', () => {
  const adapter = createAdapter();
  // Should not throw
  adapter._assertBugSuccessResponse({ code: 200, data: {} });
  adapter._assertBugSuccessResponse(null);
  adapter._assertBugSuccessResponse({ unknown: 'shape' });
});

// ── Fetch with limit ──

test.test('BugAdapter fetch respects limit option and stops early', async () => {
  const adapter = createAdapter({ pageSize: 2 });

  adapter._request = async (pathValue: string) => {
    if (pathValue === '/vision-defect-management/api/query/issues') {
      return {
        code: 200,
        data: [
          { id: 1, number: 'BUG-1', title: 'Bug 1' },
          { id: 2, number: 'BUG-2', title: 'Bug 2' },
        ],
        total_pages: 10,
        current_page: 1,
      };
    }
    return { code: 200, data: { description: JSON.stringify([{ value: 'desc' }]) } };
  };

  const tasks = await adapter.fetch({ limit: 1 });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.external_id, 'BUG-1');
});
