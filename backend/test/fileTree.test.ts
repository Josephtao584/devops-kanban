import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getFileTree } from '../src/utils/fileTree.js';
import type { FileTreeNode } from '../src/utils/fileTree.js';

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filetree-test-'));
  try {
    await run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.test('getFileTree returns file tree for a directory', async () => {
  await withTempDir(async (dir) => {
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'console.log(1);');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Hello');

    const tree = getFileTree(dir, dir);

    assert.equal(tree.name, path.basename(dir));
    assert.equal(tree.type, 'directory');
    assert.ok(Array.isArray(tree.children));
    assert.ok(tree.children!.length > 0);
  });
});

test.test('getFileTree excludes .git and node_modules directories', async () => {
  await withTempDir(async (dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.git', 'config'), '');
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'pkg.js'), '');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'app.ts'), '');

    const tree = getFileTree(dir, dir);
    const gitNode = tree.children!.find((c) => c.name === '.git');
    const nodeModulesNode = tree.children!.find((c) => c.name === 'node_modules');

    assert.ok(gitNode);
    assert.deepEqual(gitNode.children, []);
    assert.ok(nodeModulesNode);
    assert.deepEqual(nodeModulesNode.children, []);
  });
});

test.test('getFileTree marks binary files as binary', async () => {
  await withTempDir(async (dir) => {
    const binaryPath = path.join(dir, 'image.png');
    fs.writeFileSync(binaryPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d]));
    fs.writeFileSync(path.join(dir, 'text.txt'), 'hello');

    const tree = getFileTree(dir, dir);
    const binaryFile = tree.children!.find((c) => c.name === 'image.png');
    const textFile = tree.children!.find((c) => c.name === 'text.txt');

    assert.equal(binaryFile?.isBinary, true);
    assert.equal(textFile?.isBinary, false);
  });
});

test.test('getFileTree excludes .DS_Store and dist directories', async () => {
  await withTempDir(async (dir) => {
    fs.mkdirSync(path.join(dir, '.DS_Store'));
    fs.writeFileSync(path.join(dir, '.DS_Store', 'file'), '');
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'dist', 'bundle.js'), '');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'app.ts'), '');

    const tree = getFileTree(dir, dir);
    const dsNode = tree.children!.find((c) => c.name === '.DS_Store');
    const distNode = tree.children!.find((c) => c.name === 'dist');

    assert.ok(dsNode);
    assert.deepEqual(dsNode.children, []);
    assert.ok(distNode);
    assert.deepEqual(distNode.children, []);
  });
});

test.test('getFileTree handles empty directories', async () => {
  await withTempDir(async (dir) => {
    fs.mkdirSync(path.join(dir, 'empty'));

    const tree = getFileTree(dir, dir);
    const emptyNode = tree.children!.find((c) => c.name === 'empty');

    assert.ok(emptyNode);
    assert.deepEqual(emptyNode.children, []);
  });
});

test.test('getFileTree handles zero-byte files as text', async () => {
  await withTempDir(async (dir) => {
    fs.writeFileSync(path.join(dir, 'empty.txt'), '');

    const tree = getFileTree(dir, dir);
    const emptyFile = tree.children!.find((c) => c.name === 'empty.txt');

    assert.equal(emptyFile?.isBinary, false);
  });
});

test.test('getFileTree handles deeply nested paths', async () => {
  await withTempDir(async (dir) => {
    const deepPath = path.join(dir, 'a', 'b', 'c', 'd', 'e', 'deep.ts');
    fs.mkdirSync(path.dirname(deepPath), { recursive: true });
    fs.writeFileSync(deepPath, '');

    const tree = getFileTree(dir, dir);
    const aNode = tree.children!.find((c) => c.name === 'a');
    assert.ok(aNode);

    // Navigate down the tree
    let current: FileTreeNode | undefined = aNode;
    for (const name of ['b', 'c', 'd', 'e']) {
      current = current.children!.find((c) => c.name === name);
      assert.ok(current);
    }
    const deepFile = current!.children!.find((c) => c.name === 'deep.ts');
    assert.ok(deepFile);
  });
});
