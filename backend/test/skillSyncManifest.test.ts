import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { cleanupSkillsByManifest, writeSkillManifest, readSkillManifest } from '../src/utils/skillSync.js';

async function withTempDir(run: (dir: string) => Promise<void>) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-test-'));
  try {
    await run(temp);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

test.test('writeSkillManifest creates manifest file', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    await writeSkillManifest(skillsDir, {
      runId: 1,
      stepId: 'step-1',
      installedSkills: ['brainstorming'],
      updatedAt: '2026-04-02T10:00:00Z',
    });

    const raw = await fs.readFile(path.join(skillsDir, '.workflow-manifest.json'), 'utf-8');
    const manifest = JSON.parse(raw);
    assert.equal(manifest.runId, 1);
    assert.equal(manifest.stepId, 'step-1');
    assert.deepEqual(manifest.installedSkills, ['brainstorming']);
  });
});

test.test('readSkillManifest returns null when no manifest exists', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    const result = await readSkillManifest(skillsDir);
    assert.equal(result, null);
  });
});

test.test('readSkillManifest returns parsed manifest', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    const data = { runId: 5, stepId: 's2', installedSkills: ['x'], updatedAt: '2026-04-02T10:00:00Z' };
    await fs.writeFile(path.join(skillsDir, '.workflow-manifest.json'), JSON.stringify(data));

    const result = await readSkillManifest(skillsDir);
    assert.deepEqual(result, data);
  });
});

test.test('cleanupSkillsByManifest removes only manifest-tracked skills', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    // Create a workflow-installed skill
    await fs.mkdir(path.join(skillsDir, 'brainstorming'));
    await fs.writeFile(path.join(skillsDir, 'brainstorming', 'SKILL.md'), '# brainstorm');
    // Create a user-owned skill
    await fs.mkdir(path.join(skillsDir, 'my-skill'));
    await fs.writeFile(path.join(skillsDir, 'my-skill', 'SKILL.md'), '# mine');
    // Write manifest tracking only brainstorming
    await writeSkillManifest(skillsDir, {
      runId: 1,
      stepId: 'step-1',
      installedSkills: ['brainstorming'],
      updatedAt: '2026-04-02T10:00:00Z',
    });

    await cleanupSkillsByManifest(skillsDir, 1);

    // brainstorming removed
    await assert.rejects(fs.access(path.join(skillsDir, 'brainstorming')), /ENOENT/);
    // manifest file removed
    await assert.rejects(fs.access(path.join(skillsDir, '.workflow-manifest.json')), /ENOENT/);
    // user skill preserved
    const content = await fs.readFile(path.join(skillsDir, 'my-skill', 'SKILL.md'), 'utf-8');
    assert.equal(content, '# mine');
  });
});

test.test('cleanupSkillsByManifest skips cleanup when runId does not match', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(path.join(skillsDir, 'brainstorming'));
    await writeSkillManifest(skillsDir, {
      runId: 1,
      stepId: 'step-1',
      installedSkills: ['brainstorming'],
      updatedAt: '2026-04-02T10:00:00Z',
    });

    // Different runId — should NOT clean up
    await cleanupSkillsByManifest(skillsDir, 999);

    // brainstorming still exists
    const stat = await fs.stat(path.join(skillsDir, 'brainstorming'));
    assert.ok(stat.isDirectory());
    // manifest still exists
    const raw = await fs.readFile(path.join(skillsDir, '.workflow-manifest.json'), 'utf-8');
    assert.ok(JSON.parse(raw));
  });
});

test.test('cleanupSkillsByManifest is no-op when no manifest exists', async () => {
  await withTempDir(async (dir) => {
    const skillsDir = path.join(dir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(path.join(skillsDir, 'my-skill'));

    // Should not throw
    await cleanupSkillsByManifest(skillsDir, 1);

    const stat = await fs.stat(path.join(skillsDir, 'my-skill'));
    assert.ok(stat.isDirectory());
  });
});
