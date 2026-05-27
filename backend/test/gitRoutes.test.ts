import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as test from 'node:test';
import Fastify from 'fastify';

import { closeDbClient } from '../src/db/client.js';
import { initDatabase } from '../src/db/schema.js';
import { ProjectRepository } from '../src/repositories/projectRepository.js';
import { TaskRepository } from '../src/repositories/taskRepository.js';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'git-routes-test-'));
const storagePath = path.join(testRoot, 'data');
const fixtureRoots: string[] = [];

fs.mkdirSync(storagePath, { recursive: true });
process.env.STORAGE_PATH = storagePath;

// Initialize SQLite DB so routes can query it
await closeDbClient();
await initDatabase();

const projectRepo = new ProjectRepository();
const taskRepo = new TaskRepository();

const { gitRoutes, parsePorcelainStatus } = await import('../src/routes/git.js');

const app = Fastify();
app.register(gitRoutes, { prefix: '/api/git' });
await app.ready();

test.after(async () => {
  await app.close();

  for (const fixtureRoot of fixtureRoots) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  fs.rmSync(testRoot, { recursive: true, force: true });
  await closeDbClient();
});

type RouteFile = {
  path: string;
  additions: number;
  deletions: number;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
};

type RoutePayload = {
  success: boolean;
  message: string;
  data: {
    files: RouteFile[];
    diffs: Record<string, string>;
  } | null;
  error: unknown;
};

type ChangesRoutePayload = {
  success: boolean;
  message: string;
  data: Array<{
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'untracked';
  }> | null;
  error: unknown;
};

type GitFixture = {
  rootPath: string;
  repoPath: string;
  worktreePath: string;
  branchName: string;
};

let serialTestQueue = Promise.resolve();

async function runSerial<T>(callback: () => Promise<T> | T): Promise<T> {
  const previous = serialTestQueue;
  let release!: () => void;
  serialTestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await callback();
  } finally {
    release();
  }
}

function serialTest(name: string, callback: () => Promise<void> | void) {
  test.test(name, async () => {
    await runSerial(callback);
  });
}

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
  });
}

function writeFile(rootPath: string, relativePath: string, content: string | Buffer) {
  const fullPath = path.join(rootPath, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function createGitFixture(initialFiles: Record<string, string | Buffer> = { 'tracked.txt': 'base\n' }): GitFixture {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-routes-fixture-'));
  const repoPath = path.join(rootPath, 'repo');
  const worktreePath = path.join(rootPath, 'worktree');
  const branchName = `task/test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  fixtureRoots.push(rootPath);
  fs.mkdirSync(repoPath, { recursive: true });

  git(repoPath, ['init']);
  git(repoPath, ['checkout', '-b', 'master']);
  git(repoPath, ['config', 'user.name', 'Test User']);
  git(repoPath, ['config', 'user.email', 'test@example.com']);

  for (const [relativePath, content] of Object.entries(initialFiles)) {
    writeFile(repoPath, relativePath, content);
  }

  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'initial']);
  git(repoPath, ['worktree', 'add', '-b', branchName, worktreePath]);

  return { rootPath, repoPath, worktreePath, branchName };
}

async function seedRepositories(taskData: { worktreePath: string | null; worktreeBranch?: string | null; projectPath?: string | null }) {
  const project = await projectRepo.create({
    name: 'Test Project',
    local_path: taskData.projectPath ?? null,
    git_url: null,
  } as never);

  const createdTask = await taskRepo.create({
    title: 'Test Task',
    description: 'Task for git diff route tests',
    project_id: project.id,
    status: 'TODO',
    priority: 'MEDIUM',
    source: 'manual',
    worktree_path: taskData.worktreePath,
    worktree_branch: taskData.worktreeBranch ?? null,
    depends_on: [],
  } as never);

  return { projectId: project.id, taskId: createdTask.id };
}

async function getBranches(projectId: number) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/git/branches?projectId=${projectId}`,
  });

  return {
    response,
    payload: response.json() as {
      success: boolean;
      message: string;
      data: Array<{
        fullName: string;
        name: string;
        isRemote: boolean;
        isCurrent: boolean;
        aheadCount: number;
        behindCount: number;
      }> | null;
      error: unknown;
    },
  };
}

async function getDiff(taskId: number, projectId: number, query = '') {
  const qs = query || `projectId=${projectId}`;
  const response = await app.inject({
    method: 'GET',
    url: `/api/git/worktrees/${taskId}/diff?${qs}`,
  });

  return {
    response,
    payload: response.json() as RoutePayload,
  };
}

async function getChanges(taskId: number, projectId: number, query = '') {
  const qs = query || `projectId=${projectId}`;
  const response = await app.inject({
    method: 'GET',
    url: `/api/git/worktrees/${taskId}/changes?${qs}`,
  });

  return {
    response,
    payload: response.json() as ChangesRoutePayload,
  };
}

async function postMerge(projectId: number, source: string, target: string) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/git/branches/${encodeURIComponent(source)}/merge/${encodeURIComponent(target)}?projectId=${projectId}`,
  });

  return {
    response,
    payload: response.json() as { success: boolean; message: string; data: unknown; error: unknown },
  };
}

function getOnlyFile(payload: RoutePayload): RouteFile {
  assert.ok(payload.data);
  assert.equal(payload.data.files.length, 1);
  const [file] = payload.data.files;
  assert.ok(file);
  return file;
}

function getFile(payload: RoutePayload, filePath: string): RouteFile {
  assert.ok(payload.data);
  const file = payload.data.files.find((entry) => entry.path === filePath);
  assert.ok(file, `Expected ${filePath} to be present in diff payload`);
  return file;
}

function getDiffText(payload: RoutePayload, filePath: string): string {
  assert.ok(payload.data);
  const diff = payload.data.diffs[filePath];
  if (typeof diff !== 'string') {
    throw new Error(`Expected diff text for ${filePath}`);
  }
  return diff;
}

serialTest('POST /api/git/branches/:source/merge/:target remains available for explicit branch merges', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  const { projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await postMerge(projectId, fixture.branchName, 'master');

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.ok(payload.data);
});

serialTest('GET /api/git/worktrees/:taskId/diff returns tracked uncommitted diff against HEAD', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(file.path, 'tracked.txt');
  assert.equal(file.status, 'modified');
  assert.match(getDiffText(payload, 'tracked.txt'), /^diff --git /m);
  assert.match(getDiffText(payload, 'tracked.txt'), /^\+updated$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff returns staged added files as added', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'added.txt', 'new file\n');
  git(fixture.worktreePath, ['add', 'added.txt']);
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'added.txt');
  assert.equal(file.status, 'added');
  assert.match(getDiffText(payload, 'added.txt'), /^new file mode /m);
  assert.match(getDiffText(payload, 'added.txt'), /^\+new file$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff keeps mixed AM files mapped as added', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'added.txt', 'line 1\n');
  git(fixture.worktreePath, ['add', 'added.txt']);
  writeFile(fixture.worktreePath, 'added.txt', 'line 1\nline 2\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);
  const diff = getDiffText(payload, 'added.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'added.txt');
  assert.equal(file.status, 'added');
  assert.equal(file.additions, 2);
  assert.equal(file.deletions, 0);
  assert.match(diff, /^new file mode /m);
  assert.match(diff, /^\+line 1$/m);
  assert.match(diff, /^\+line 2$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff keeps renamed tracked files in the diff payload', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  git(fixture.worktreePath, ['mv', 'tracked.txt', 'renamed.txt']);
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);
  const diff = getDiffText(payload, 'renamed.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'renamed.txt');
  assert.equal(file.status, 'modified');
  assert.equal(file.additions, 0);
  assert.equal(file.deletions, 0);
  assert.match(diff, /^diff --git a\/tracked.txt b\/renamed.txt$/m);
  assert.match(diff, /^rename from tracked.txt$/m);
  assert.match(diff, /^rename to renamed.txt$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff keeps later entries after rename porcelain records', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  git(fixture.worktreePath, ['mv', 'tracked.txt', 'renamed.txt']);
  writeFile(fixture.worktreePath, 'notes.txt', 'hello\nworld\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const renamedFile = getFile(payload, 'renamed.txt');
  const untrackedFile = getFile(payload, 'notes.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(renamedFile.status, 'modified');
  assert.equal(untrackedFile.status, 'untracked');
  assert.match(getDiffText(payload, 'renamed.txt'), /^rename to renamed.txt$/m);
  assert.match(getDiffText(payload, 'notes.txt'), /^diff --git a\/notes.txt b\/notes.txt$/m);
});

serialTest('parsePorcelainStatus maps rename records to the destination path and diff paths in source-then-destination order', () => {
  const parsed = parsePorcelainStatus('R  renamed.txt\0tracked.txt\0');

  assert.deepEqual(parsed, [
    {
      path: 'renamed.txt',
      status: 'modified',
      diffPaths: ['tracked.txt', 'renamed.txt'],
    },
  ]);
});

serialTest('parsePorcelainStatus safely consumes copy-style second paths without corrupting later entries', () => {
  const parsed = parsePorcelainStatus('C  copied.txt\0tracked.txt\0?? notes.txt\0');

  assert.deepEqual(parsed, [
    {
      path: 'copied.txt',
      status: 'added',
      diffPaths: ['tracked.txt', 'copied.txt'],
    },
    {
      path: 'notes.txt',
      status: 'untracked',
      diffPaths: ['notes.txt'],
    },
  ]);
});

serialTest('parsePorcelainStatus treats plain staged copies as added when git does not emit copy porcelain records', () => {
  const parsed = parsePorcelainStatus('A  copied.txt\0');

  assert.deepEqual(parsed, [
    {
      path: 'copied.txt',
      status: 'added',
      diffPaths: ['copied.txt'],
    },
  ]);
});

serialTest('GET /api/git/worktrees/:taskId/diff keeps plain staged copies in the diff payload when git reports them as added', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'copied.txt', 'base\n');
  git(fixture.worktreePath, ['add', 'copied.txt']);
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const copiedFile = getFile(payload, 'copied.txt');
  const diff = getDiffText(payload, 'copied.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(copiedFile.status, 'added');
  assert.equal(copiedFile.additions, 1);
  assert.equal(copiedFile.deletions, 0);
  assert.match(diff, /^new file mode /m);
  assert.match(diff, /^\+base$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff returns tracked deleted files as deleted', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  fs.unlinkSync(path.join(fixture.worktreePath, 'tracked.txt'));
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'tracked.txt');
  assert.equal(file.status, 'deleted');
  assert.match(getDiffText(payload, 'tracked.txt'), /^deleted file mode /m);
  assert.match(getDiffText(payload, 'tracked.txt'), /^-base$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff expands untracked directories into file entries with diffs', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'notes/todo.txt', 'hello\nworld\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getFile(payload, 'notes/todo.txt');
  const diff = getDiffText(payload, 'notes/todo.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 2);
  assert.equal(file.deletions, 0);
  assert.match(diff, /^diff --git a\/notes\/todo.txt b\/notes\/todo.txt$/m);
  assert.match(diff, /^\+hello$/m);
  assert.match(diff, /^\+world$/m);
});

serialTest('GET /api/git/worktrees/:taskId/changes expands untracked directories into file entries that match diff keys', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'notes/todo.txt', 'hello\nworld\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getChanges(taskId, projectId);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data?.changes, [
    {
      path: 'notes/todo.txt',
      status: 'untracked',
    },
  ]);
});

serialTest('GET /api/git/worktrees/:taskId/diff combines staged and unstaged tracked changes relative to HEAD', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'line 1\nline 2\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'line 1\nstaged change\n');
  git(fixture.worktreePath, ['add', 'tracked.txt']);
  writeFile(fixture.worktreePath, 'tracked.txt', 'line 1\nstaged change\nunstaged change\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);
  const diff = getDiffText(payload, 'tracked.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.status, 'modified');
  assert.match(diff, /^\+staged change$/m);
  assert.match(diff, /^\+unstaged change$/m);
  assert.doesNotMatch(diff, /^\+line 2$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff keeps the { files, diffs } payload shape', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  assert.equal(response.statusCode, 200);
  assert.ok(payload.data);
  assert.ok(Array.isArray(payload.data.files));
  assert.equal(typeof payload.data.diffs, 'object');
  assert.equal(Array.isArray(payload.data.diffs), false);
});

serialTest('GET /api/git/worktrees/:taskId/diff synthesizes diffs for untracked text files', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'notes.txt', 'hello\nworld\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);
  const diff = getDiffText(payload, 'notes.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'notes.txt');
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 2);
  assert.equal(file.deletions, 0);
  assert.match(diff, /^diff --git a\/notes.txt b\/notes.txt$/m);
  assert.match(diff, /^--- \/dev\/null$/m);
  assert.match(diff, /^\+hello$/m);
  assert.match(diff, /^\+world$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff synthesizes zero-stat diffs for untracked empty files', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'empty.txt', '');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);
  const diff = getDiffText(payload, 'empty.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'empty.txt');
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 0);
  assert.equal(file.deletions, 0);
  assert.match(diff, /^diff --git a\/empty.txt b\/empty.txt$/m);
  assert.match(diff, /^--- \/dev\/null$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff renders binary markers for untracked binary files', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'image.bin', Buffer.from([0x00, 0x01, 0x02, 0x03]));
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);
  const diff = getDiffText(payload, 'image.bin');

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'image.bin');
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 0);
  assert.equal(file.deletions, 0);
  assert.match(diff, /Binary files \/dev\/null and b\/image.bin differ/);
});

serialTest('GET /api/git/worktrees/:taskId/diff expands untracked directories into child file diffs', async () => {
  const fixture = createGitFixture();
  fs.mkdirSync(path.join(fixture.worktreePath, 'broken.txt'), { recursive: true });
  writeFile(fixture.worktreePath, 'broken.txt/child.txt', 'child\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  assert.equal(response.statusCode, 200);
  const file = getFile(payload, 'broken.txt/child.txt');
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 1);
  assert.equal(file.deletions, 0);
  assert.match(getDiffText(payload, 'broken.txt/child.txt'), /^diff --git a\/broken.txt\/child.txt b\/broken.txt\/child.txt$/m);
  assert.match(getDiffText(payload, 'broken.txt/child.txt'), /^\+child$/m);
  assert.equal(payload.data!.files.some((entry) => entry.path === 'broken.txt/'), false);
});

serialTest('GET /api/git/branches includes task worktree branches from the repository that owns them', async () => {
  const projectFixture = createGitFixture({ 'tracked.txt': 'project base\n' });
  const worktreeFixture = createGitFixture({ 'tracked.txt': 'worktree base\n' });
  const { projectId } = await seedRepositories({
    worktreePath: worktreeFixture.worktreePath,
    worktreeBranch: worktreeFixture.branchName,
    projectPath: projectFixture.repoPath,
  });

  const { response, payload } = await getBranches(projectId);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.ok(payload.data);
  assert.equal(payload.data.some((branch) => branch.fullName === worktreeFixture.branchName), true);
});

serialTest('GET /api/git/worktrees/:taskId/diff ignores source and target query parameters', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId, `projectId=${projectId}&source=master&target=${encodeURIComponent(fixture.branchName)}`);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'tracked.txt');
  assert.equal(file.status, 'modified');
  assert.match(getDiffText(payload, 'tracked.txt'), /^\+updated$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff handles unusual valid path names safely', async () => {
  const fixture = createGitFixture({ 'dir with spaces/file name.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'dir with spaces/file name.txt', 'base\nupdated\n');
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'dir with spaces/file name.txt');
  assert.equal(file.status, 'modified');
  assert.match(getDiffText(payload, 'dir with spaces/file name.txt'), /^\+updated$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff falls back to project local_path when task has no worktree', async () => {
  const fixture = createGitFixture();
  const { taskId, projectId } = await seedRepositories({ worktreePath: null, worktreeBranch: null, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  // Route falls back to project local_path, so returns 200 with clean diff
  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.ok(payload.data);
});

serialTest('GET /api/git/worktrees/:taskId/diff preserves wrapped errors for non-git worktree paths', async () => {
  const fixture = createGitFixture();
  const nonGitPath = path.join(fixture.rootPath, 'not-a-repo');
  fs.mkdirSync(nonGitPath, { recursive: true });
  const { taskId, projectId } = await seedRepositories({ worktreePath: nonGitPath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /not a git repository|Command failed/i);
});

serialTest('GET /api/git/worktrees/:taskId/diff preserves wrapped errors for missing worktree paths', async () => {
  const fixture = createGitFixture();
  const missingPath = path.join(fixture.rootPath, 'missing-worktree');
  const { taskId, projectId } = await seedRepositories({ worktreePath: missingPath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /spawnSync git ENOENT|no such file or directory|Command failed/i);
});

serialTest('GET /api/git/worktrees/:taskId/diff preserves wrapped errors for file worktree paths', async () => {
  const fixture = createGitFixture();
  const filePath = path.join(fixture.rootPath, 'not-a-directory');
  fs.writeFileSync(filePath, 'plain file');
  const { taskId, projectId } = await seedRepositories({ worktreePath: filePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /spawnSync git ENOENT|spawnSync git ENOTDIR|not a directory|Command failed/i);
});


serialTest('GET /api/git/worktrees/:taskId/diff returns empty files and diffs for a clean worktree', async () => {
  const fixture = createGitFixture();
  const { taskId, projectId } = await seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(taskId, projectId);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.data, {
    files: [],
    diffs: {},
  });
});
