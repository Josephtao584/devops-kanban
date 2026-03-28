import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { SkillService } from '../src/services/skillService.js';

async function withIsolatedStorage(run: (tempRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-service-test-'));
  try {
    await run(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('createSkill creates skill record and initializes skill directory', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    const skill = await service.createSkill('brainstorming', '用于头脑风暴的技能');

    assert.equal(skill.name, 'brainstorming');
    assert.equal(skill.description, '用于头脑风暴的技能');
  });
});

test.test('createSkill prevents duplicate names', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('brainstorming');

    await assert.rejects(
      async () => service.createSkill('brainstorming'),
      /already exists/
    );
  });
});

test.test('listSkills returns all created skills', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('skill1');
    await service.createSkill('skill2');

    const skills = await service.listSkills();

    assert.equal(skills.length, 2);
  });
});

test.test('deleteSkill removes skill record', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    const created = await service.createSkill('to-delete');

    const deleted = await service.deleteSkill(created.id);

    assert.equal(deleted, true);
    const skills = await service.listSkills();
    assert.equal(skills.length, 0);
  });
});

test.test('deleteSkill returns false for non-existent id', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    const deleted = await service.deleteSkill(9999);
    assert.equal(deleted, false);
  });
});