import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { GitHubAdapter } from '../../src/sources/github.js';

test.test('GitHubAdapter metadata includes state field', () => {
  assert.deepEqual(GitHubAdapter.metadata.configFields?.state, {
    type: 'string',
    required: false,
    description: 'Issue state filter: open, closed, or all',
  });
});

test.test('GitHubAdapter builds request with configured state and labels', async () => {
  const adapter = new GitHubAdapter({
    type: 'GITHUB',
    config: {
      repo: 'owner/repo',
      state: 'closed',
      labels: ['bug', 'backend'],
    },
  });

  let requestedPath = '';
  adapter._request = async (pathValue: string) => {
    requestedPath = pathValue;
    return [];
  };

  await adapter.fetch();

  assert.equal(requestedPath, '/repos/owner/repo/issues');

  const url = new URL(requestedPath, adapter.baseUrl);
  url.searchParams.set('state', adapter.state);
  url.searchParams.set('labels', adapter.labels?.join(',') || '');

  assert.match(url.pathname + url.search, /state=closed/);
  assert.match(url.pathname + url.search, /labels=bug%2Cbackend/);
});

test.test('GitHubAdapter defaults issue state to open', () => {
  const adapter = new GitHubAdapter({
    type: 'GITHUB',
    config: {
      repo: 'owner/repo',
    },
  });

  const url = new URL('/repos/owner/repo/issues', adapter.baseUrl);
  url.searchParams.set('state', adapter.state);
  assert.match(url.pathname + url.search, /state=open/);
});
