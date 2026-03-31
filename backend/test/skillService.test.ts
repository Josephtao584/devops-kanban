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

test.test('writeSkillFile and readSkillFile work correctly', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('test-skill');

    // Write a file
    await service.writeSkillFile('test-skill', 'SKILL.md', '# Test Skill\n\nContent here.');

    // Read it back
    const content = await service.readSkillFile('test-skill', 'SKILL.md');
    assert.equal(content, '# Test Skill\n\nContent here.');
  });
});

test.test('readSkillFile rejects path traversal', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('test-skill');

    await assert.rejects(
      async () => service.readSkillFile('test-skill', '../../../etc/passwd'),
      /Invalid file path/
    );
  });
});

test.test('writeSkillFile rejects path traversal', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('test-skill');

    await assert.rejects(
      async () => service.writeSkillFile('test-skill', '../../../etc/passwd', 'malicious'),
      /Invalid file path/
    );
  });
});

test.test('listSkillFiles returns all files in skill directory', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('test-skill');

    await service.writeSkillFile('test-skill', 'SKILL.md', '# Skill');
    await service.writeSkillFile('test-skill', 'scripts/helper.js', 'module.exports = {}');

    const files = await service.listSkillFiles('test-skill');

    assert.ok(files.includes('SKILL.md'), 'should include SKILL.md');
    assert.ok(files.includes('scripts/helper.js'), 'should include scripts/helper.js');
    // With recursive readdir, directories are also listed, so we just verify expected files exist
    assert.ok(files.length >= 2, 'should have at least 2 entries');
  });
});

test.test('uploadSkillZip extracts zip contents', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('test-skill');

    const AdmZipModule = await import('adm-zip');
    const zip = new (AdmZipModule as unknown as { default: typeof import('adm-zip') }).default();
    zip.addFile('SKILL.md', Buffer.from('# Zipped Skill\n\nContent'));
    zip.addFile('README.txt', Buffer.from('Readme content'));
    const zipBuffer = zip.toBuffer();

    await service.uploadSkillZip('test-skill', zipBuffer);

    const files = await service.listSkillFiles('test-skill');
    assert.ok(files.includes('SKILL.md'), 'should include extracted SKILL.md');
    assert.ok(files.includes('README.txt'), 'should include extracted README.txt');

    const content = await service.readSkillFile('test-skill', 'SKILL.md');
    assert.equal(content, '# Zipped Skill\n\nContent');
  });
});

test.test('readSkillFile returns 404 for non-existent file', async () => {
  await withIsolatedStorage(async (tempRoot) => {
    const service = new SkillService({ storagePath: tempRoot });
    await service.createSkill('test-skill');

    await assert.rejects(
      async () => service.readSkillFile('test-skill', 'nonexistent.md'),
      /File not found/
    );
  });
});