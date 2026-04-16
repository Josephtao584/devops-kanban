import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { LocalDirectoryAdapter } from '../../src/sources/localDirectoryAdapter.js';

async function createTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-dir-test-'));
  return dir;
}

async function createTestFiles(dir: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), content, 'utf-8');
  }
}

test.test('LocalDirectoryAdapter metadata has correct type and configFields', () => {
  assert.equal(LocalDirectoryAdapter.type, 'LOCAL_DIRECTORY');
  assert.equal(LocalDirectoryAdapter.metadata.name, '本地目录文件');
  assert.ok(LocalDirectoryAdapter.metadata.configFields);
  assert.ok(LocalDirectoryAdapter.metadata.configFields.directoryPath);
  assert.ok(LocalDirectoryAdapter.metadata.configFields.fileExtensions);
  assert.ok(LocalDirectoryAdapter.metadata.configFields.descriptionMode);
  assert.ok(LocalDirectoryAdapter.metadata.configFields.descriptionTemplate);
  assert.ok(LocalDirectoryAdapter.metadata.configFields.agentId);
});

test.test('LocalDirectoryAdapter scans files from directory (fixed mode)', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, {
      'task1.txt': 'content 1',
      'task2.md': 'content 2',
      'task3.json': '{"key": "value"}',
    });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const tasks = await adapter.fetch();
    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].title, 'task1.txt');
    assert.equal(tasks[0].external_id, 'task1.txt');
    assert.equal(tasks[1].title, 'task2.md');
    assert.equal(tasks[2].title, 'task3.json');
    assert.ok(tasks[0].description.includes('task1.txt'));
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter filters by file extensions', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, {
      'doc.txt': 'text file',
      'data.json': '{}',
      'image.png': 'binary',
    });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: {
        directoryPath: dir,
        fileExtensions: 'txt,json',
      },
    });

    const tasks = await adapter.fetch();
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].external_id, 'data.json');
    assert.equal(tasks[1].external_id, 'doc.txt');
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter skips hidden files', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, {
      'visible.txt': 'content',
      '.hidden': 'hidden content',
    });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const tasks = await adapter.fetch();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].external_id, 'visible.txt');
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter skips subdirectories', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, { 'file.txt': 'content' });
    await fs.mkdir(path.join(dir, 'subdir'));
    await createTestFiles(path.join(dir, 'subdir'), { 'nested.txt': 'nested' });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const tasks = await adapter.fetch();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].external_id, 'file.txt');
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter substitutes template variables', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, { 'report.txt': 'content' });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: {
        directoryPath: dir,
        descriptionTemplate: 'File: {filename}, Size: {size}, Path: {filepath}',
      },
    });

    const tasks = await adapter.fetch();
    assert.equal(tasks.length, 1);
    assert.ok(tasks[0].description.includes('report.txt'));
    assert.ok(tasks[0].description.includes('Size:'));
    assert.ok(tasks[0].description.includes('Path:'));
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter testConnection returns true for valid directory', async () => {
  const dir = await createTempDir();
  try {
    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const result = await adapter.testConnection();
    assert.equal(result, true);
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter testConnection returns false for invalid directory', async () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/nonexistent/path/xyz123' },
  });

  const result = await adapter.testConnection();
  assert.equal(result, false);
});

test.test('LocalDirectoryAdapter isTextFile identifies text extensions', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/tmp' },
  });

  assert.equal(adapter.isTextFile('readme.md'), true);
  assert.equal(adapter.isTextFile('data.json'), true);
  assert.equal(adapter.isTextFile('script.py'), true);
  assert.equal(adapter.isTextFile('image.png'), false);
  assert.equal(adapter.isTextFile('doc.pdf'), false);
  assert.equal(adapter.isTextFile('sheet.xlsx'), false);
});

test.test('LocalDirectoryAdapter readFileContent reads text files', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, { 'test.txt': 'hello world' });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const content = await adapter.readFileContent(path.join(dir, 'test.txt'));
    assert.equal(content, 'hello world');
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter readFileContent truncates at maxBytes', async () => {
  const dir = await createTempDir();
  try {
    const longContent = 'a'.repeat(20000);
    await createTestFiles(dir, { 'big.txt': longContent });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const content = await adapter.readFileContent(path.join(dir, 'big.txt'), 100);
    assert.equal(content.length, 100);
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter fetch throws if directoryPath not configured', async () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: {},
  });

  await assert.rejects(() => adapter.fetch(), { message: 'directoryPath is not configured' });
});

test.test('LocalDirectoryAdapter constructor parses config correctly', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: {
      directoryPath: '/data/files',
      fileExtensions: 'txt, md, pdf',
      descriptionMode: 'ai',
      descriptionTemplate: 'Custom: {filename}',
      agentId: 5,
    },
  });

  assert.equal(adapter.directoryPath, '/data/files');
  assert.deepEqual(adapter.fileExtensions, ['txt', 'md', 'pdf']);
  assert.equal(adapter.descriptionMode, 'ai');
  assert.equal(adapter.descriptionTemplate, 'Custom: {filename}');
  assert.equal(adapter.agentId, 5);
});

test.test('LocalDirectoryAdapter defaults descriptionMode to fixed', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/tmp' },
  });

  assert.equal(adapter.descriptionMode, 'fixed');
  assert.equal(adapter.agentId, undefined);
});

test.test('LocalDirectoryAdapter _parseAiOutput extracts title and description', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/tmp' },
  });

  const result = adapter._parseAiOutput('标题: 实现用户认证\n描述: 需要实现JWT认证模块，支持登录、登出和token刷新功能', {
    filename: 'auth.md',
    filepath: '/tmp/auth.md',
    size: 100,
    modified: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(result.title, '实现用户认证');
  assert.equal(result.description, '需要实现JWT认证模块，支持登录、登出和token刷新功能');
  assert.equal(result.external_id, 'auth.md');
});

test.test('LocalDirectoryAdapter _parseAiOutput falls back on parse failure', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/tmp' },
  });

  const result = adapter._parseAiOutput('some unstructured output', {
    filename: 'file.txt',
    filepath: '/tmp/file.txt',
    size: 50,
    modified: '2026-01-01T00:00:00.000Z',
  });

  assert.equal(result.title, 'file.txt');
  assert.ok(result.description.includes('file.txt'));
});

test.test('LocalDirectoryAdapter convertToTask handles unknown items', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/tmp' },
  });

  const result = adapter.convertToTask({ title: 'test', description: 'desc', external_id: 'id' });
  assert.equal(result.title, 'test');
  assert.equal(result.description, 'desc');
  assert.equal(result.external_id, 'id');
});

test.test('LocalDirectoryAdapter convertToTask handles missing fields', () => {
  const adapter = new LocalDirectoryAdapter({
    type: 'LOCAL_DIRECTORY',
    config: { directoryPath: '/tmp' },
  });

  const result = adapter.convertToTask({});
  assert.equal(result.title, 'Untitled');
  assert.equal(result.description, '');
  assert.equal(result.external_id, '');
});

test.test('LocalDirectoryAdapter generates file:// external_url', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, { 'file.txt': 'content' });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const tasks = await adapter.fetch();
    assert.ok(tasks[0].external_url.startsWith('file://'));
    assert.ok(tasks[0].external_url.includes('file.txt'));
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});

test.test('LocalDirectoryAdapter sorts files alphabetically', async () => {
  const dir = await createTempDir();
  try {
    await createTestFiles(dir, {
      'c-task.txt': 'c',
      'a-task.txt': 'a',
      'b-task.txt': 'b',
    });

    const adapter = new LocalDirectoryAdapter({
      type: 'LOCAL_DIRECTORY',
      config: { directoryPath: dir },
    });

    const tasks = await adapter.fetch();
    assert.equal(tasks[0].external_id, 'a-task.txt');
    assert.equal(tasks[1].external_id, 'b-task.txt');
    assert.equal(tasks[2].external_id, 'c-task.txt');
  } finally {
    await fs.rm(dir, { recursive: true });
  }
});
