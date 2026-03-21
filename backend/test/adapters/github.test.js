import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import https from 'https';

import { GitHubAdapter } from '../../src/adapters/github.js';

test('github adapter metadata includes state field', () => {
  assert.deepEqual(GitHubAdapter.metadata.config.state, {
    type: 'string',
    required: false,
    description: 'Issue state filter: open, closed, or all',
  });
});

test('github adapter requests configured state and labels', async (t) => {
  const adapter = new GitHubAdapter({
    type: 'GITHUB',
    config: {
      repo: 'owner/repo',
      state: 'closed',
      labels: ['bug', 'backend'],
    },
  });

  const restore = t.mock.method(https, 'request', (options, callback) => {
    assert.match(options.path, /state=closed/);
    assert.match(options.path, /labels=bug%2Cbackend/);

    const response = new EventEmitter();
    response.statusCode = 200;

    process.nextTick(() => {
      callback(response);
      response.emit('data', '[]');
      response.emit('end');
    });

    return {
      on() {},
      end() {},
    };
  });

  await adapter.fetch();
  restore.mock.restore();
});

test('github adapter defaults issue state to open', async (t) => {
  const adapter = new GitHubAdapter({
    type: 'GITHUB',
    config: {
      repo: 'owner/repo',
    },
  });

  const restore = t.mock.method(https, 'request', (options, callback) => {
    assert.match(options.path, /state=open/);

    const response = new EventEmitter();
    response.statusCode = 200;

    process.nextTick(() => {
      callback(response);
      response.emit('data', '[]');
      response.emit('end');
    });

    return {
      on() {},
      end() {},
    };
  });

  await adapter.fetch();
  restore.mock.restore();
});
