import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as test from 'node:test';
import Fastify from 'fastify';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'git-routes-test-'));
const storagePath = path.join(testRoot, 'data');
const fixtureRoots: string[] = [];

fs.mkdirSync(storagePath, { recursive: true });
fs.writeFileSync(path.join(storagePath, 'projects.json'), '[]');
fs.writeFileSync(path.join(storagePath, 'tasks.json'), '[]');
process.env.STORAGE_PATH = storagePath;

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
});

type RouteFile = {
  path: string;
  additions: number;
  deletions: number;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
};

type DiffPayload = {
  files: RouteFile[];
  diffs: Record<string, string>;
};

type PushPayload = {
  output: string;
};

type GitFixture = {
  rootPath: string;
  repoPath: string;
  worktreePath: string;
  branchName: string;
  remotePath: string;
};

type PushRoutePayload = {
  success: boolean;
  message: string;
  data: PushPayload | null;
  error: unknown;
};

type DiffRoutePayload = {
  success: boolean;
  message: string;
  data: DiffPayload | null;
  error: unknown;
};

type SeedTaskOverrides = {
  id?: number;
  title?: string;
  worktreePath: string | null;
  worktreeBranch?: string | null;
  projectPath?: string | null;
};

type PushRequestBody = {
  remote?: string;
  setUpstream?: boolean;
};

function getDiffData(payload: DiffRoutePayload): DiffPayload {
  assert.ok(payload.data);
  return payload.data;
}

function getPushData(payload: PushRoutePayload): PushPayload {
  assert.ok(payload.data);
  return payload.data;
}

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
  const remotePath = path.join(rootPath, 'remote.git');
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
  git(rootPath, ['init', '--bare', remotePath]);
  git(repoPath, ['remote', 'add', 'origin', remotePath]);
  git(repoPath, ['push', '-u', 'origin', 'master']);
  git(repoPath, ['worktree', 'add', '-b', branchName, worktreePath]);

  return { rootPath, repoPath, worktreePath, branchName, remotePath };
}

function seedRepositories(task: SeedTaskOverrides) {
  const now = new Date().toISOString();
  const projects = [
    {
      id: 1,
      name: 'Test Project',
      local_path: task.projectPath ?? null,
      git_url: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const tasks = [
    {
      id: task.id ?? 1,
      title: task.title ?? 'Test Task',
      description: 'Task for git route tests',
      project_id: 1,
      status: 'TODO',
      priority: 'MEDIUM',
      worktree_path: task.worktreePath,
      worktree_branch: task.worktreeBranch ?? null,
      created_at: now,
      updated_at: now,
    },
  ];

  fs.writeFileSync(path.join(storagePath, 'projects.json'), JSON.stringify(projects, null, 2));
  fs.writeFileSync(path.join(storagePath, 'tasks.json'), JSON.stringify(tasks, null, 2));
}

async function postPush(taskId = 1, body: PushRequestBody = {}) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/git/worktrees/${taskId}/push?projectId=1`,
    payload: body,
  });

  return {
    response,
    payload: response.json() as PushRoutePayload,
  };
}

function getRemoteHead(remotePath: string, branchName: string) {
  return git(remotePath, ['rev-parse', branchName]).trim();
}

function getBranchUpstream(worktreePath: string) {
  return git(worktreePath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']).trim();
}

async function getDiff(query = 'projectId=1') {
  const response = await app.inject({
    method: 'GET',
    url: `/api/git/worktrees/1/diff?${query}`,
  });

  return {
    response,
    payload: response.json() as DiffRoutePayload,
  };
}

function getOnlyFile(payload: DiffRoutePayload): RouteFile {
  const data = getDiffData(payload);
  assert.equal(data.files.length, 1);
  const [file] = data.files;
  assert.ok(file);
  return file;
}

function getFile(payload: DiffRoutePayload, filePath: string): RouteFile {
  const data = getDiffData(payload);
  const file = data.files.find((entry) => entry.path === filePath);
  assert.ok(file, `Expected ${filePath} to be present in diff payload`);
  return file;
}

function getDiffText(payload: DiffRoutePayload, filePath: string): string {
  const data = getDiffData(payload);
  const diff = data.diffs[filePath];
  if (typeof diff !== 'string') {
    throw new Error(`Expected diff text for ${filePath}`);
  }
  return diff;
}

function commitAll(worktreePath: string, message = 'worktree change') {
  git(worktreePath, ['add', '.']);
  git(worktreePath, ['commit', '-m', message]);
}

serialTest('POST /api/git/worktrees/:taskId/push returns 404 when the task does not exist', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await postPush(999);

  assert.equal(response.statusCode, 404);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Task not found/);
});

serialTest('POST /api/git/worktrees/:taskId/push returns 400 when the task has no worktree', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: null, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await postPush();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Task has no worktree/);
});

serialTest('POST /api/git/worktrees/:taskId/push returns 400 when the task worktree path does not exist', async () => {
  const fixture = createGitFixture();
  const missingPath = path.join(fixture.rootPath, 'missing-worktree');
  seedRepositories({ worktreePath: missingPath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await postPush();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Task worktree path does not exist/);
});

serialTest('POST /api/git/worktrees/:taskId/push returns 400 when the remote name is invalid', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await postPush(1, { remote: '--force' });

  assert.equal(response.statusCode, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Invalid remote/);
});

serialTest('POST /api/git/worktrees/:taskId/push pushes to origin by default when the branch already tracks origin', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\ntracked\n');
  commitAll(fixture.worktreePath, 'create tracked branch');
  git(fixture.worktreePath, ['push', '--set-upstream', 'origin', fixture.branchName]);
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\ntracked\ndefault push\n');
  commitAll(fixture.worktreePath, 'push default remote');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const localHead = git(fixture.worktreePath, ['rev-parse', 'HEAD']).trim();
  const { response, payload } = await postPush();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.match(getPushData(payload).output, /task\/test-|To /);
  assert.equal(getRemoteHead(fixture.remotePath, fixture.branchName), localHead);
});

serialTest('POST /api/git/worktrees/:taskId/push sets upstream to the task branch when requested', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupstream\n');
  commitAll(fixture.worktreePath, 'push with upstream');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await postPush(1, { setUpstream: true });

  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(getBranchUpstream(fixture.worktreePath), `origin/${fixture.branchName}`);
  assert.match(getPushData(payload).output, /set up to track|upstream|new branch|To /i);
});

serialTest('GET /api/git/worktrees/:taskId/diff returns tracked uncommitted diff against HEAD', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'tracked.txt');
  assert.equal(file.status, 'deleted');
  assert.match(getDiffText(payload, 'tracked.txt'), /^deleted file mode /m);
  assert.match(getDiffText(payload, 'tracked.txt'), /^-base$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff combines staged and unstaged tracked changes relative to HEAD', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'line 1\nline 2\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'line 1\nstaged change\n');
  git(fixture.worktreePath, ['add', 'tracked.txt']);
  writeFile(fixture.worktreePath, 'tracked.txt', 'line 1\nstaged change\nunstaged change\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 200);
  assert.ok(payload.data);
  assert.ok(Array.isArray(payload.data.files));
  assert.equal(typeof payload.data.diffs, 'object');
  assert.equal(Array.isArray(payload.data.diffs), false);
});

serialTest('GET /api/git/worktrees/:taskId/diff synthesizes diffs for untracked text files', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'notes.txt', 'hello\nworld\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
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
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 200);
  const file = getFile(payload, 'broken.txt/child.txt');
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 1);
  assert.equal(file.deletions, 0);
  assert.match(getDiffText(payload, 'broken.txt/child.txt'), /^diff --git a\/broken.txt\/child.txt b\/broken.txt\/child.txt$/m);
  assert.match(getDiffText(payload, 'broken.txt/child.txt'), /^\+child$/m);
  assert.equal(getDiffData(payload).files.some((entry) => entry.path === 'broken.txt/'), false);
});

serialTest('GET /api/git/worktrees/:taskId/diff ignores source and target query parameters', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(`projectId=1&source=master&target=${encodeURIComponent(fixture.branchName)}`);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'tracked.txt');
  assert.equal(file.status, 'modified');
  assert.match(getDiffText(payload, 'tracked.txt'), /^\+updated$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff handles unusual valid path names safely', async () => {
  const fixture = createGitFixture({ 'dir with spaces/file name.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'dir with spaces/file name.txt', 'base\nupdated\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'dir with spaces/file name.txt');
  assert.equal(file.status, 'modified');
  assert.match(getDiffText(payload, 'dir with spaces/file name.txt'), /^\+updated$/m);
});

serialTest('GET /api/git/worktrees/:taskId/diff returns 400 when the task has no worktree', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: null, worktreeBranch: null, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Task has no worktree/);
});

serialTest('GET /api/git/worktrees/:taskId/diff preserves wrapped errors for non-git worktree paths', async () => {
  const fixture = createGitFixture();
  const nonGitPath = path.join(fixture.rootPath, 'not-a-repo');
  fs.mkdirSync(nonGitPath, { recursive: true });
  seedRepositories({ worktreePath: nonGitPath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /not a git repository|Command failed/i);
});

serialTest('GET /api/git/worktrees/:taskId/diff preserves wrapped errors for missing worktree paths', async () => {
  const fixture = createGitFixture();
  const missingPath = path.join(fixture.rootPath, 'missing-worktree');
  seedRepositories({ worktreePath: missingPath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /spawnSync git ENOENT|no such file or directory|Command failed/i);
});

serialTest('GET /api/git/worktrees/:taskId/diff preserves wrapped errors for file worktree paths', async () => {
  const fixture = createGitFixture();
  const filePath = path.join(fixture.rootPath, 'not-a-directory');
  fs.writeFileSync(filePath, 'plain file');
  seedRepositories({ worktreePath: filePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /spawnSync git ENOENT|not a directory|Command failed/i);
});


serialTest('GET /api/git/worktrees/:taskId/diff returns empty files and diffs for a clean worktree', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.data, {
    files: [],
    diffs: {},
  });
});
