import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { ensureSkillsInWorktree } from '../src/utils/skillSync.js';
import { STORAGE_PATH } from '../src/config/index.js';

const REAL_STORAGE_ROOT = STORAGE_PATH;

async function withTempDirs(run: (skillName: string, projectRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-sync-test-'));
  const projectRoot = path.join(tempRoot, 'project');
  const skillName = `test-skill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(projectRoot, { recursive: true });
  try {
    await run(skillName, projectRoot);
  } finally {
    await fs.rm(path.join(REAL_STORAGE_ROOT, 'skills', skillName), { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('ensureSkillsInWorktree copies managed skills into .claude/skills', async () => {
  await withTempDirs(async (skillName, projectRoot) => {
    const skillDir = path.join(REAL_STORAGE_ROOT, 'skills', skillName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Brainstorming');

    await ensureSkillsInWorktree([skillName], projectRoot);

    const copied = await fs.readFile(path.join(projectRoot, '.claude', 'skills', skillName, 'SKILL.md'), 'utf-8');
    assert.equal(copied, '# Brainstorming');
  });
});

test.test('ensureSkillsInWorktree skips missing skills without throwing', async () => {
  await withTempDirs(async (_skillName, projectRoot) => {
    await ensureSkillsInWorktree(['missing-skill'], projectRoot);

    await assert.rejects(
      fs.access(path.join(projectRoot, '.claude', 'skills', 'missing-skill')),
      /ENOENT/
    );
  });
});
