import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const testDir = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
const sourceConfigModuleUrl = pathToFileURL(
  path.resolve(testDir, '../../src/config/index.ts')
).href;
const repoRoot = path.resolve(testDir, '../../..');
const startScriptSourcePath = path.join(repoRoot, 'start.sh');

async function writeExecutable(filePath: string, content: string) {
  await fs.writeFile(filePath, content, 'utf-8');
  await fs.chmod(filePath, 0o755);
}

async function withStartScriptFixture<T>(callback: (fixture: {
  rootPath: string;
  run: (options?: {
    frontendReady?: boolean;
    backendReady?: boolean;
  }) => Promise<{ stdout: string; stderr: string }>;
}) => Promise<T>) {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'start-script-test-'));
  const fakeBinPath = path.join(rootPath, 'fake-bin');
  const startScriptPath = path.join(rootPath, 'start.sh');

  await fs.mkdir(fakeBinPath, { recursive: true });
  await fs.mkdir(path.join(rootPath, 'frontend'), { recursive: true });
  await fs.mkdir(path.join(rootPath, 'backend'), { recursive: true });
  await fs.mkdir(path.join(rootPath, 'data-sample'), { recursive: true });
  await fs.writeFile(path.join(rootPath, 'data-sample', 'projects.json'), '[]', 'utf-8');
  await fs.writeFile(startScriptPath, await fs.readFile(startScriptSourcePath, 'utf-8'), 'utf-8');
  await fs.chmod(startScriptPath, 0o755);

  await writeExecutable(path.join(fakeBinPath, 'node'), `#!/bin/sh
if [ "$1" = "-v" ]; then
  echo "v22.0.0"
  exit 0
fi
if [ "$1" = "-p" ]; then
  echo "22"
  exit 0
fi
exit 0
`);

  await writeExecutable(path.join(fakeBinPath, 'npm'), `#!/bin/sh
if [ "$1" = "install" ]; then
  exit 0
fi
if [ "$1" = "run" ] && [ "$2" = "dev" ]; then
  case "$PWD" in
    */frontend)
      if [ -d "$FAKE_START_ROOT/data" ]; then
        printf "present" > "$FAKE_START_ROOT/frontend-data-state.txt"
      else
        printf "missing" > "$FAKE_START_ROOT/frontend-data-state.txt"
      fi
      ;;
  esac
  exit 0
fi
exit 0
`);

  await writeExecutable(path.join(fakeBinPath, 'curl'), `#!/bin/sh
url=""
for arg in "$@"; do
  url="$arg"
done
if [ "$url" = "http://localhost:3000" ]; then
  [ "$FRONTEND_READY" = "1" ] && exit 0
  exit 1
fi
if [ "$url" = "http://localhost:8000/api/projects" ]; then
  [ "$BACKEND_READY" = "1" ] && exit 0
  exit 1
fi
exit 1
`);

  await writeExecutable(path.join(fakeBinPath, 'lsof'), '#!/bin/sh\nexit 0\n');
  await writeExecutable(path.join(fakeBinPath, 'pkill'), '#!/bin/sh\nexit 0\n');
  await writeExecutable(path.join(fakeBinPath, 'kill'), '#!/bin/sh\nexit 0\n');
  await writeExecutable(path.join(fakeBinPath, 'sleep'), '#!/bin/sh\nexit 0\n');
  await writeExecutable(path.join(fakeBinPath, 'tail'), '#!/bin/sh\nexit 0\n');

  try {
    return await callback({
      rootPath,
      run: async (options) => {
        const result = await execFileAsync('bash', ['start.sh'], {
          cwd: rootPath,
          env: {
            ...process.env,
            PATH: `${fakeBinPath}:${process.env.PATH ?? ''}`,
            FAKE_START_ROOT: rootPath,
            FRONTEND_READY: options?.frontendReady === false ? '0' : '1',
            BACKEND_READY: options?.backendReady === false ? '0' : '1',
          },
        });

        return {
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
        };
      },
    });
  } finally {
    await fs.rm(rootPath, { recursive: true, force: true });
  }
}

test.test('config defaults resolve storage path from project root data directory', async () => {
  const config = await import(sourceConfigModuleUrl);
  assert.equal(config.STORAGE_PATH.replace(/\\/g, '/').endsWith('/data'), true);
});

test.test('config defaults resolve task source config from backend task-sources directory', async () => {
  const config = await import(sourceConfigModuleUrl);
  assert.equal(config.TASK_SOURCE_CONFIG_PATH.replace(/\\/g, '/').endsWith('/backend/task-sources/config.yaml'), true);
});

test.test('start script initializes data before launching frontend dev server', async () => {
  await withStartScriptFixture(async ({ rootPath, run }) => {
    await run();

    assert.equal(
      await fs.readFile(path.join(rootPath, 'frontend-data-state.txt'), 'utf-8'),
      'present'
    );
    assert.equal(
      await fs.readFile(path.join(rootPath, 'data', 'projects.json'), 'utf-8'),
      '[]'
    );
  });
});

test.test('start script prints the actual frontend timeout log path', async () => {
  await withStartScriptFixture(async ({ run }) => {
    const result = await run({ frontendReady: false });
    assert.match(result.stdout, /\/tmp\/kanban-frontend\.log/);
  });
});
