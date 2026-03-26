import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { gzipSync } from 'node:zlib';

import { InternalApiAdapter } from '../../src/sources/internalApi.js';

test.test('InternalApiAdapter fetches list then detail and normalizes tasks', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
      detailIdField: 'id',
    },
  });

  const requestedPaths: string[] = [];
  adapter._request = async (pathValue: string) => {
    requestedPaths.push(pathValue);
    if (pathValue === '/tasks') {
      return {
        data: [
          { id: 'A-1', name: 'List title', state: 'open' },
          { id: 'A-2', name: 'Second task', state: 'doing' },
        ],
      };
    }

    if (pathValue === '/tasks/A-1') {
      return {
        data: {
          id: 'A-1',
          title: 'Detail title',
          description: 'Detail body',
          status: 'resolved',
          labels: [{ name: 'backend' }],
          url: 'https://internal.example/tasks/A-1',
          created_at: '2026-03-24T10:00:00.000Z',
          updated_at: '2026-03-24T11:00:00.000Z',
        },
      };
    }

    if (pathValue === '/tasks/A-2') {
      return {
        data: {
          id: 'A-2',
          subject: 'Detail subject',
          content: 'Second detail',
          status: 'blocked',
          labels: ['ops'],
          external_url: 'https://internal.example/tasks/A-2',
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.deepEqual(requestedPaths, ['/tasks', '/tasks/A-1', '/tasks/A-2']);
  assert.deepEqual(tasks, [
    {
      external_id: 'A-1',
      title: 'Detail title',
      description: 'Detail body',
      external_url: 'https://internal.example/tasks/A-1',
      status: 'DONE',
      labels: ['backend'],
      created_at: '2026-03-24T10:00:00.000Z',
      updated_at: '2026-03-24T11:00:00.000Z',
    },
    {
      external_id: 'A-2',
      title: 'Detail subject',
      description: 'Second detail',
      external_url: 'https://internal.example/tasks/A-2',
      status: 'BLOCKED',
      labels: ['ops'],
      created_at: null,
      updated_at: null,
    },
  ]);
});

test.test('InternalApiAdapter supports raw array list responses and raw object detail responses', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/items',
      detailPath: '/items/{ticketNo}',
      detailIdField: 'ticketNo',
    },
  });

  adapter._request = async (pathValue: string) => {
    if (pathValue === '/items') {
      return [{ ticketNo: 'T-100', title: 'List item', status: 'opened' }];
    }

    if (pathValue === '/items/T-100') {
      return {
        ticketNo: 'T-100',
        body: 'Raw detail body',
        html_url: 'https://internal.example/items/T-100',
        labels: [{ name: 'urgent' }],
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.deepEqual(tasks, [
    {
      external_id: 'T-100',
      title: 'List item',
      description: 'Raw detail body',
      external_url: 'https://internal.example/items/T-100',
      status: 'TODO',
      labels: ['urgent'],
      created_at: null,
      updated_at: null,
    },
  ]);
});

test.test('InternalApiAdapter supports nested detailIdField paths from list items', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/nested-items',
      detailPath: '/nested-items/{meta.ticketId}',
      detailIdField: 'meta.ticketId',
    },
  });

  const requestedPaths: string[] = [];
  adapter._request = async (pathValue: string) => {
    requestedPaths.push(pathValue);
    if (pathValue === '/nested-items') {
      return {
        data: [{ meta: { ticketId: 'N-1' }, title: 'Nested item' }],
      };
    }

    if (pathValue === '/nested-items/N-1') {
      return {
        data: {
          external_id: 'N-1',
          description: 'Nested detail body',
          status: 'in_progress',
        },
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.deepEqual(requestedPaths, ['/nested-items', '/nested-items/N-1']);
  assert.deepEqual(tasks, [
    {
      external_id: 'N-1',
      title: 'Nested item',
      description: 'Nested detail body',
      external_url: '',
      status: 'IN_PROGRESS',
      labels: [],
      created_at: null,
      updated_at: null,
    },
  ]);
});

test.test('InternalApiAdapter testConnection returns true on successful list request', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  let requestedPath = '';
  adapter._request = async (pathValue: string) => {
    requestedPath = pathValue;
    return { data: [] };
  };

  const connected = await adapter.testConnection();

  assert.equal(connected, true);
  assert.equal(requestedPath, '/tasks');
});

test.test('InternalApiAdapter testConnection returns false when request fails', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  adapter._request = async () => {
    throw new Error('network down');
  };

  const connected = await adapter.testConnection();

  assert.equal(connected, false);
});

test.test('InternalApiAdapter fetches paginated workitems and uses latest detail content', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      token: 'Bearer demo-token',
      userId: '10001',
      category: '5',
      pageSize: '2',
      listPath: '/devops-workitem/api/v1/query/workitems',
      detailPath: '/devops-workitem/api/v1/query/{number}/document_detail',
      detailIdField: 'number',
    },
  });

  const requests: Array<{ pathValue: string; requestOptions: { method?: string; body?: unknown } | undefined }> = [];
  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requests.push({ pathValue, requestOptions });

    if (pathValue === '/devops-workitem/api/v1/query/workitems') {
      const page = (requestOptions?.body as { pagination?: { current_page?: number } })?.pagination?.current_page;
      if (page === 1) {
        return {
          code: 200,
          message: 'SUCCESS',
          data: {
            result: [
              {
                id: 123,
                number: 'EP2025062300005',
                url: 'https://devops.com/workitem/EP2025062300005',
                title: '流水线能力提升专项',
                status: '待处理',
              },
            ],
            current_page: 1,
            total_pages: 2,
            last_page: false,
          },
        };
      }

      if (page === 2) {
        return {
          code: 200,
          message: 'SUCCESS',
          data: {
            result: [
              {
                id: 124,
                number: 'EP2025062300006',
                url: 'https://devops.com/workitem/EP2025062300006',
                title: '平台稳定性治理',
                status: '已完成',
              },
            ],
            current_page: 2,
            total_pages: 2,
            last_page: true,
          },
        };
      }
    }

    if (pathValue === '/devops-workitem/api/v1/query/EP2025062300005/document_detail') {
      return {
        code: 200,
        message: 'SUCCESS',
        data: [
          {
            id: 1,
            entity_number: 'EP2025062300005',
            content: '<p>旧内容</p>',
            created_time: '2024-03-08T09:25:03Z',
          },
          {
            id: 2,
            entity_number: 'EP2025062300005',
            content: '<p>最新内容</p>',
            created_time: '2024-03-09T09:25:03Z',
          },
        ],
      };
    }

    if (pathValue === '/devops-workitem/api/v1/query/EP2025062300006/document_detail') {
      return {
        code: 200,
        message: 'SUCCESS',
        data: [
          {
            id: 3,
            entity_number: 'EP2025062300006',
            content: '<p>已完成需求</p>',
            created_time: '2024-03-10T09:25:03Z',
          },
        ],
      };
    }

    throw new Error(`Unexpected path: ${pathValue}`);
  };

  const tasks = await adapter.fetch();

  assert.deepEqual(requests, [
    {
      pathValue: '/devops-workitem/api/v1/query/workitems',
      requestOptions: {
        method: 'POST',
        body: {
          first_filters: [
            { key: 'category', operator: '||', value: ['5'] },
            { key: 'mine_todo', operator: '||', value: ['10001'] },
          ],
          sort: { key: 'updated_time', value: 'desc' },
          select_field: ['simple_domain'],
          pagination: { current_page: 1, page_size: 2 },
        },
      },
    },
    {
      pathValue: '/devops-workitem/api/v1/query/workitems',
      requestOptions: {
        method: 'POST',
        body: {
          first_filters: [
            { key: 'category', operator: '||', value: ['5'] },
            { key: 'mine_todo', operator: '||', value: ['10001'] },
          ],
          sort: { key: 'updated_time', value: 'desc' },
          select_field: ['simple_domain'],
          pagination: { current_page: 2, page_size: 2 },
        },
      },
    },
    {
      pathValue: '/devops-workitem/api/v1/query/EP2025062300005/document_detail',
      requestOptions: undefined,
    },
    {
      pathValue: '/devops-workitem/api/v1/query/EP2025062300006/document_detail',
      requestOptions: undefined,
    },
  ]);
  assert.deepEqual(tasks, [
    {
      external_id: 'EP2025062300005',
      title: '流水线能力提升专项',
      description: '<p>最新内容</p>',
      external_url: 'https://devops.com/workitem/EP2025062300005',
      status: 'TODO',
      labels: [],
      created_at: null,
      updated_at: null,
    },
    {
      external_id: 'EP2025062300006',
      title: '平台稳定性治理',
      description: '<p>已完成需求</p>',
      external_url: 'https://devops.com/workitem/EP2025062300006',
      status: 'DONE',
      labels: [],
      created_at: null,
      updated_at: null,
    },
  ]);
});

test.test('InternalApiAdapter testConnection uses workitem POST payload when userId is configured', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      token: 'Bearer demo-token',
      userId: '10001',
      listPath: '/devops-workitem/api/v1/query/workitems',
      detailPath: '/devops-workitem/api/v1/query/{number}/document_detail',
      detailIdField: 'number',
    },
  });

  let requestPayload: { pathValue: string; requestOptions: { method?: string; body?: unknown } | undefined } | null = null;
  adapter._request = async (pathValue: string, requestOptions?: { method?: string; body?: unknown }) => {
    requestPayload = { pathValue, requestOptions };
    return { code: 200, message: 'SUCCESS', data: { result: [], current_page: 1, total_pages: 1, last_page: true } };
  };

  const connected = await adapter.testConnection();

  assert.equal(connected, true);
  assert.deepEqual(requestPayload, {
    pathValue: '/devops-workitem/api/v1/query/workitems',
    requestOptions: {
      method: 'POST',
      body: {
        first_filters: [
          { key: 'category', operator: '||', value: ['5'] },
          { key: 'mine_todo', operator: '||', value: ['10001'] },
        ],
        sort: { key: 'updated_time', value: 'desc' },
        select_field: ['simple_domain'],
        pagination: { current_page: 1, page_size: 10 },
      },
    },
  });
});

test.test('InternalApiAdapter uses configured authorization header value as-is', () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      token: 'ApiKey demo-key',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  assert.deepEqual(adapter._getHeaders(), {
    Accept: 'application/json',
    'User-Agent': 'DevOps-Kanban-App',
    Authorization: 'ApiKey demo-key',
  });
});

test.test('InternalApiAdapter preserves explicit port and supports http transport selection', () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'http://internal.example:8080',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  const url = new URL('/tasks', `${adapter.baseUrl}/`);
  assert.equal(adapter._getRequestFactory(url), httpRequest);
  assert.deepEqual(adapter._buildRequestOptions(url), {
    hostname: 'internal.example',
    port: '8080',
    path: '/tasks',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DevOps-Kanban-App',
    },
    method: 'GET',
  });

  const httpsUrl = new URL('/tasks', 'https://internal.example/');
  assert.equal(adapter._getRequestFactory(httpsUrl), httpsRequest);
});

test.test('InternalApiAdapter adds JSON headers when request body is present', () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      token: 'Bearer demo-token',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  const url = new URL('/tasks', `${adapter.baseUrl}/`);
  const body = JSON.stringify({ current_page: 1 });
  assert.deepEqual(adapter._buildRequestOptions(url, { method: 'POST', body: { current_page: 1 } }, body), {
    hostname: 'internal.example',
    port: undefined,
    path: '/tasks',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DevOps-Kanban-App',
      Authorization: 'Bearer demo-token',
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body)),
    },
    method: 'POST',
  });
});

test.test('InternalApiAdapter parses gzip-compressed JSON responses', () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  const payload = {
    code: 200,
    message: 'SUCCESS',
    data: {
      result: [{ id: 1, number: 'US-1', title: 'Compressed item' }],
    },
  };
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));

  assert.deepEqual(adapter._parseResponseBody(compressed, 'gzip'), payload);
});

test.test('InternalApiAdapter extracts list items when JSON text is nested in data', () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  const response = {
    data: JSON.stringify({
      result: [
        { id: 1, number: 'US-1', title: 'Nested json text item' },
      ],
    }),
  };

  assert.deepEqual(adapter._extractListItems(response), [
    { id: 1, number: 'US-1', title: 'Nested json text item' },
  ]);
});

test.test('InternalApiAdapter extracts list items from nested data.data.result', () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
      detailPath: '/tasks/{id}',
    },
  });

  const response = {
    data: {
      data: {
        result: [
          { id: 2, number: 'US-2', title: 'Deep nested item' },
        ],
      },
    },
  };

  assert.deepEqual(adapter._extractListItems(response), [
    { id: 2, number: 'US-2', title: 'Deep nested item' },
  ]);
});

test.test('InternalApiAdapter fetch throws when required config is missing', async () => {
  const adapter = new InternalApiAdapter({
    type: 'INTERNAL_API',
    config: {
      baseUrl: 'https://internal.example',
      listPath: '/tasks',
    },
  });

  await assert.rejects(() => adapter.fetch(), /detailPath/);
});
