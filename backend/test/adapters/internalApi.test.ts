import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

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
