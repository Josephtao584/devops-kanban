import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { prepareExecutionSkills } from '../src/services/workflow/executorSkillPreparation.js';
import { STORAGE_PATH } from '../src/config/index.js';
import { ExecutorType } from '../src/types/executors.js';

const REAL_STORAGE_ROOT = STORAGE_PATH;

async function withTempProject(run: (skillName: string, projectRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'executor-skill-prep-'));
  const projectRoot = path.join(tempRoot, 'project');
  const skillName = `prep-skill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(projectRoot, { recursive: true });
  try {
    await run(skillName, projectRoot);
  } finally {
    await fs.rm(path.join(REAL_STORAGE_ROOT, 'skills', skillName), { recursive: true, force: true });
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('prepareExecutionSkills copies skills for CLAUDE_CODE', async () => {
  await withTempProject(async (skillName, projectRoot) => {
    const managedDir = path.join(REAL_STORAGE_ROOT, 'skills', skillName);
    await fs.mkdir(managedDir, { recursive: true });
    await fs.writeFile(path.join(managedDir, 'SKILL.md'), '# Claude Skill');

    await prepareExecutionSkills({
      executorType: ExecutorType.CLAUDE_CODE,
      skillNames: [skillName],
      executionPath: projectRoot,
    });

    const copied = await fs.readFile(path.join(projectRoot, '.claude', 'skills', skillName, 'SKILL.md'), 'utf-8');
    assert.equal(copied, '# Claude Skill');
  });
});

test.test('prepareExecutionSkills is no-op when no skills provided', async () => {
  await withTempProject(async (_skillName, projectRoot) => {
    await prepareExecutionSkills({
      executorType: ExecutorType.CLAUDE_CODE,
      skillNames: [],
      executionPath: projectRoot,
    });

    await assert.rejects(
      fs.access(path.join(projectRoot, '.claude', 'skills')),
      /ENOENT/
    );
  });
});
