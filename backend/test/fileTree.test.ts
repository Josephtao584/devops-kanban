import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
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

    const tree = await getFileTree(dir, dir);

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

    const tree = await getFileTree(dir, dir);
    const gitNode = tree.children!.find((c) => c.name === '.git');
    const nodeModulesNode = tree.children!.find((c) => c.name === 'node_modules');

    // These should not exist in the returned tree
    assert.equal(gitNode, undefined);
    assert.equal(nodeModulesNode, undefined);
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

    const tree = await getFileTree(dir, dir);
    const dsNode = tree.children!.find((c) => c.name === '.DS_Store');
    const distNode = tree.children!.find((c) => c.name === 'dist');

    assert.equal(dsNode, undefined);
    assert.equal(distNode, undefined);
  });
});

test.test('getFileTree handles empty directories', async () => {
  await withTempDir(async (dir) => {
    fs.mkdirSync(path.join(dir, 'empty'));

    const tree = await getFileTree(dir, dir);
    const emptyNode = tree.children!.find((c) => c.name === 'empty');

    assert.ok(emptyNode);
    assert.deepEqual(emptyNode.children, []);
  });
});

test.test('getFileTree handles deeply nested paths', async () => {
  await withTempDir(async (dir) => {
    const deepPath = path.join(dir, 'a', 'b', 'c', 'd', 'e', 'deep.ts');
    fs.mkdirSync(path.dirname(deepPath), { recursive: true });
    fs.writeFileSync(deepPath, '');

    const tree = await getFileTree(dir, dir);
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

test.test('getFileTree excludes dot-directories via git ls-tree path', async () => {
  await withTempDir(async (dir) => {
    // Initialize a git repo so the git ls-tree path is used
    execFileSync('git', ['init'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });

    fs.mkdirSync(path.join(dir, '.claude'));
    fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{}');
    fs.mkdirSync(path.join(dir, '.vscode'));
    fs.writeFileSync(path.join(dir, '.vscode', 'launch.json'), '{}');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src', 'app.ts'), '');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Hello');

    // Stage and commit all non-ignored files
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });

    const tree = await getFileTree(dir, dir);

    // Dot-directories should not appear in the tree
    const hasDotDir = tree.children!.some((c) => c.name.startsWith('.'));
    assert.equal(hasDotDir, false, 'No dot-directories should be in the tree');

    // But regular files should be there
    const srcNode = tree.children!.find((c) => c.name === 'src');
    const readmeNode = tree.children!.find((c) => c.name === 'README.md');
    assert.ok(srcNode, 'src directory should exist');
    assert.ok(readmeNode, 'README.md should exist');
  });
});
