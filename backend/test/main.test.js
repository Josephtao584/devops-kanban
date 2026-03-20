import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const serverPath = 'D:/workspace/devops-kanban/backend/src/main.js';

test('backend 默认日志级别不输出请求日志', async () => {
  const child = spawn('node', [serverPath], {
    env: {
      ...process.env,
      SERVER_PORT: '8013',
      SERVER_HOST: '127.0.0.1',
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server start timeout')), 15000);

    const onData = (chunk) => {
      const text = chunk.toString();
      if (text.includes('Server: http://127.0.0.1:8013')) {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        resolve();
      }
    };

    child.stdout.on('data', onData);
    child.on('error', reject);
    child.on('exit', (code) => reject(new Error(`server exited early: ${code}`)));
  });

  const response = await fetch('http://127.0.0.1:8013/health');
  assert.equal(response.status, 200);

  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
  });

  assert.doesNotMatch(stdout, /incoming request/i);
  assert.doesNotMatch(stdout, /request completed/i);
  assert.equal(stderr.trim(), '');
});
