import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { AgentRepository } from '../src/repositories/agentRepository.js';
import { syncWorkflowSkills } from '../src/services/workflow/workflowSkillSync.ts';

const REAL_STORAGE_ROOT = '/Users/taowenpeng/IdeaProjects/devops-kanban/data';

async function withTempDirs(run: (skillNames: string[], projectRoot: string) => Promise<void>) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-skill-sync-test-'));
  const projectRoot = path.join(tempRoot, 'project');
  const skillNames = [
    `brainstorming-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    `debug-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  ];
  await fs.mkdir(projectRoot, { recursive: true });
  try {
    await run(skillNames, projectRoot);
  } finally {
    for (const skillName of skillNames) {
      await fs.rm(path.join(REAL_STORAGE_ROOT, 'skills', skillName), { recursive: true, force: true });
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

test.test('syncWorkflowSkills collects deduplicated agent skills and copies them', async () => {
  await withTempDirs(async ([brainstormSkill, debugSkill], projectRoot) => {
    const brainstormDir = path.join(REAL_STORAGE_ROOT, 'skills', brainstormSkill);
    const debugDir = path.join(REAL_STORAGE_ROOT, 'skills', debugSkill);
    await fs.mkdir(brainstormDir, { recursive: true });
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(path.join(brainstormDir, 'SKILL.md'), '# Brainstorming');
    await fs.writeFile(path.join(debugDir, 'SKILL.md'), '# Debug');

    const originalFindById = AgentRepository.prototype.findById;
    AgentRepository.prototype.findById = async function (id: number) {
      if (id === 1) {
        return { id: 1, skills: [brainstormSkill, debugSkill] } as never;
      }
      if (id === 2) {
        return { id: 2, skills: [brainstormSkill] } as never;
      }
      return null as never;
    };

    try {
      await syncWorkflowSkills({
        id: 1,
        template_id: 'wf',
        name: 'wf',
        created_at: '',
        updated_at: '',
        steps: [
          { id: 'a', name: 'A', instructionPrompt: 'A', agentId: 1 },
          { id: 'b', name: 'B', instructionPrompt: 'B', agentId: 2 },
        ],
      }, projectRoot);

      const copiedBrainstorm = await fs.readFile(path.join(projectRoot, '.claude', 'skills', brainstormSkill, 'SKILL.md'), 'utf-8');
      const copiedDebug = await fs.readFile(path.join(projectRoot, '.claude', 'skills', debugSkill, 'SKILL.md'), 'utf-8');
      assert.equal(copiedBrainstorm, '# Brainstorming');
      assert.equal(copiedDebug, '# Debug');
    } finally {
      AgentRepository.prototype.findById = originalFindById;
    }
  });
});

test.test('syncWorkflowSkills does nothing when no agent skills exist', async () => {
  await withTempDirs(async (_skillNames, projectRoot) => {
    const originalFindById = AgentRepository.prototype.findById;
    AgentRepository.prototype.findById = async function () {
      return { id: 1, skills: [] } as never;
    };

    try {
      await syncWorkflowSkills({
        id: 1,
        template_id: 'wf',
        name: 'wf',
        created_at: '',
        updated_at: '',
        steps: [
          { id: 'a', name: 'A', instructionPrompt: 'A', agentId: 1 },
        ],
      }, projectRoot);

      await assert.rejects(
        fs.access(path.join(projectRoot, '.claude', 'skills')),
        /ENOENT/
      );
    } finally {
      AgentRepository.prototype.findById = originalFindById;
    }
  });
});

test.test('syncWorkflowSkills does nothing when workflow has no agents', async () => {
  await withTempDirs(async (_skillNames, projectRoot) => {
    await syncWorkflowSkills({
      id: 1,
      template_id: 'wf',
      name: 'wf',
      created_at: '',
      updated_at: '',
      steps: [
        { id: 'a', name: 'A', instructionPrompt: 'A', agentId: undefined },
      ],
    }, projectRoot);

    await assert.rejects(
      fs.access(path.join(projectRoot, '.claude', 'skills')),
      /ENOENT/
    );
  });
});
