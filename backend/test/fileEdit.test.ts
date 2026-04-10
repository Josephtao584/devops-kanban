import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { readFileContent, writeFileContent } from '../src/utils/fileEdit.js';

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileedit-test-'));
  try {
    await run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.test('readFileContent reads text file', async () => {
  await withTempDir(async (dir) => {
    fs.writeFileSync(path.join(dir, 'test.ts'), 'const x = 1;');

    const result = readFileContent(dir, 'test.ts');
    assert.equal(result.content, 'const x = 1;');
    assert.equal(result.isBinary, false);
  });
});

test.test('readFileContent returns isBinary for binary files', async () => {
  await withTempDir(async (dir) => {
    fs.writeFileSync(path.join(dir, 'image.png'), Buffer.from([0x89, 0x50, 0x00, 0x0d]));

    const result = readFileContent(dir, 'image.png');
    assert.equal(result.isBinary, true);
  });
});

test.test('readFileContent throws for non-existent file', async () => {
  await withTempDir(async (dir) => {
    assert.throws(
      () => readFileContent(dir, 'nonexistent.ts'),
      /File not found/
    );
  });
});

test.test('readFileContent throws for path traversal', async () => {
  await withTempDir(async (dir) => {
    assert.throws(
      () => readFileContent(dir, '../../../etc/passwd'),
      /Invalid file path/
    );
  });
});

test.test('readFileContent throws for absolute path', async () => {
  await withTempDir(async (dir) => {
    assert.throws(
      () => readFileContent(dir, '/etc/passwd'),
      /Invalid file path/
    );
  });
});

test.test('readFileContent throws for files exceeding 1MB limit', async () => {
  await withTempDir(async (dir) => {
    const largePath = path.join(dir, 'large.txt');
    const fd = fs.openSync(largePath, 'w');
    fs.writeSync(fd, Buffer.alloc(1_000_001, 'x'));
    fs.closeSync(fd);

    assert.throws(
      () => readFileContent(dir, 'large.txt'),
      /File too large/
    );
  });
});

test.test('readFileContent handles zero-byte files as text', async () => {
  await withTempDir(async (dir) => {
    fs.writeFileSync(path.join(dir, 'empty.txt'), '');

    const result = readFileContent(dir, 'empty.txt');
    assert.equal(result.isBinary, false);
    assert.equal(result.content, '');
    assert.equal(result.size, 0);
  });
});

test.test('writeFileContent rejects path traversal', async () => {
  await withTempDir(async (dir) => {
    assert.throws(
      () => writeFileContent(dir, '../../../etc/passwd', 'hacked'),
      /Invalid file path/
    );
  });
});

test.test('writeFileContent writes to file and returns diff', async () => {
  await withTempDir(async (dir) => {
    // Initialize git repo
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
    fs.writeFileSync(path.join(dir, 'test.ts'), 'const x = 1;\n');
    execSync('git add .', { cwd: dir });
    execSync('git commit -m "initial"', { cwd: dir });

    const diff = writeFileContent(dir, 'test.ts', 'const x = 2;\n');
    assert.ok(diff.includes('-const x = 1'));
    assert.ok(diff.includes('+const x = 2'));

    const content = fs.readFileSync(path.join(dir, 'test.ts'), 'utf-8');
    assert.equal(content, 'const x = 2;\n');
  });
});

test.test('writeFileContent creates parent directories', async () => {
  await withTempDir(async (dir) => {
    execSync('git init', { cwd: dir });
    execSync('git config user.email "test@test.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
    fs.writeFileSync(path.join(dir, 'README.md'), '# Test\n');
    execSync('git add .', { cwd: dir });
    execSync('git commit -m "initial"', { cwd: dir });

    writeFileContent(dir, 'src/new/file.ts', 'export const y = 1;\n');

    assert.ok(fs.existsSync(path.join(dir, 'src', 'new', 'file.ts')));
    const content = fs.readFileSync(path.join(dir, 'src', 'new', 'file.ts'), 'utf-8');
    assert.equal(content, 'export const y = 1;\n');
  });
});
