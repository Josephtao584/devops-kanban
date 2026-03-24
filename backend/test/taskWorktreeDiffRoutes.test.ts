import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as test from 'node:test';
import Fastify from 'fastify';

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'task-worktree-diff-routes-test-'));
const storagePath = path.join(testRoot, 'data');
const fixtureRoots: string[] = [];

fs.mkdirSync(storagePath, { recursive: true });
fs.writeFileSync(path.join(storagePath, 'projects.json'), '[]');
fs.writeFileSync(path.join(storagePath, 'tasks.json'), '[]');
process.env.STORAGE_PATH = storagePath;

const { taskRoutes } = await import('../src/routes/tasks.js');

const app = Fastify();
app.register(taskRoutes, { prefix: '/api/tasks' });
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

type RoutePayload = {
  success: boolean;
  message: string;
  data: {
    files: RouteFile[];
    diffs: Record<string, string>;
  } | null;
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
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'task-worktree-diff-fixture-'));
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

function seedRepositories(task: { worktreePath: string | null; worktreeBranch?: string | null; projectPath?: string | null }) {
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
      id: 1,
      title: 'Test Task',
      description: 'Task for task worktree diff route tests',
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

async function getDiff(query = 'project_id=1') {
  const response = await app.inject({
    method: 'GET',
    url: `/api/tasks/1/worktree/diff?${query}`,
  });

  return {
    response,
    payload: response.json() as RoutePayload,
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

function assertNoFile(payload: RoutePayload, filePath: string) {
  assert.ok(payload.data);
  assert.equal(payload.data.files.some((entry) => entry.path === filePath), false);
}

serialTest('GET /api/tasks/:id/worktree/diff returns tracked uncommitted diff against HEAD', async () => {
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

serialTest('GET /api/tasks/:id/worktree/diff combines staged and unstaged tracked changes relative to HEAD', async () => {
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

serialTest('GET /api/tasks/:id/worktree/diff expands untracked directories into file entries with diffs', async () => {
  const fixture = createGitFixture();
  writeFile(fixture.worktreePath, 'notes/todo.txt', 'hello\nworld\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
  const file = getFile(payload, 'notes/todo.txt');
  const diff = getDiffText(payload, 'notes/todo.txt');

  assert.equal(response.statusCode, 200);
  assert.equal(file.status, 'untracked');
  assert.equal(file.additions, 2);
  assert.equal(file.deletions, 0);
  assert.match(diff, /^diff --git a\/notes\/todo.txt b\/notes\/todo.txt$/m);
  assert.match(diff, /^\+hello$/m);
  assert.match(diff, /^\+world$/m);
  assertNoFile(payload, 'notes/');
});

serialTest('GET /api/tasks/:id/worktree/diff includes both tracked changes and untracked files from new directories', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  writeFile(fixture.worktreePath, 'docs/guide.md', '# Guide\n\ncontent\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();
  const trackedFile = getFile(payload, 'tracked.txt');
  const untrackedFile = getFile(payload, 'docs/guide.md');

  assert.equal(response.statusCode, 200);
  assert.equal(trackedFile.status, 'modified');
  assert.equal(untrackedFile.status, 'untracked');
  assert.match(getDiffText(payload, 'tracked.txt'), /^\+updated$/m);
  assert.match(getDiffText(payload, 'docs/guide.md'), /^diff --git a\/docs\/guide.md b\/docs\/guide.md$/m);
  assert.match(getDiffText(payload, 'docs/guide.md'), /^\+# Guide$/m);
});

serialTest('GET /api/tasks/:id/worktree/diff returns 400 when the task has no worktree', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: null, worktreeBranch: null, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 400);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Task has no worktree/);
  assert.equal(payload.data, null);
});

serialTest('GET /api/tasks/:id/worktree/diff returns 404 when the task does not exist', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const response = await app.inject({
    method: 'GET',
    url: '/api/tasks/999/worktree/diff?project_id=1',
  });
  const payload = response.json() as RoutePayload;

  assert.equal(response.statusCode, 404);
  assert.equal(payload.success, false);
  assert.match(payload.message, /Task not found/);
  assert.equal(payload.data, null);
});

serialTest('GET /api/tasks/:id/worktree/diff preserves wrapped errors for non-git worktree paths', async () => {
  const fixture = createGitFixture();
  const nonGitPath = path.join(fixture.rootPath, 'not-a-repo');
  fs.mkdirSync(nonGitPath, { recursive: true });
  seedRepositories({ worktreePath: nonGitPath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 500);
  assert.equal(payload.success, false);
  assert.match(payload.message, /not a git repository|Command failed/i);
  assert.equal(payload.data, null);
});

serialTest('GET /api/tasks/:id/worktree/diff keeps the { files, diffs } payload shape', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 200);
  assert.ok(payload.data);
  assert.ok(Array.isArray(payload.data.files));
  assert.equal(payload.data.files.length, 1);
  assert.equal(payload.data.files[0]?.path, 'tracked.txt');
  assert.equal(typeof payload.data.diffs, 'object');
  assert.equal(Array.isArray(payload.data.diffs), false);
});

serialTest('GET /api/tasks/:id/worktree/diff ignores source and target query parameters', async () => {
  const fixture = createGitFixture({ 'tracked.txt': 'base\n' });
  writeFile(fixture.worktreePath, 'tracked.txt', 'base\nupdated\n');
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff(`project_id=1&source=master&target=${encodeURIComponent(fixture.branchName)}`);
  const file = getOnlyFile(payload);

  assert.equal(response.statusCode, 200);
  assert.equal(file.path, 'tracked.txt');
  assert.equal(file.status, 'modified');
  assert.match(getDiffText(payload, 'tracked.txt'), /^\+updated$/m);
});

serialTest('GET /api/tasks/:id/worktree/diff returns empty files and diffs for a clean worktree', async () => {
  const fixture = createGitFixture();
  seedRepositories({ worktreePath: fixture.worktreePath, worktreeBranch: fixture.branchName, projectPath: fixture.repoPath });

  const { response, payload } = await getDiff();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.data, {
    files: [],
    diffs: {},
  });
});

