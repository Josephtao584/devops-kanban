import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { AgentRepository } from '../src/repositories/agentRepository.js';
import { resolveWorkflowSkills } from '../src/services/workflow/workflowSkillSync.ts';

test.test('resolveWorkflowSkills collects deduplicated agent skills', async () => {
  const originalFindById = AgentRepository.prototype.findById;
  AgentRepository.prototype.findById = async function (id: number) {
    if (id === 1) {
      return { id: 1, skills: ['brainstorming', 'systematic-debugging'] } as never;
    }
    if (id === 2) {
      return { id: 2, skills: ['brainstorming'] } as never;
    }
    return null as never;
  };

  try {
    const skills = await resolveWorkflowSkills({
      id: 1,
      template_id: 'wf',
      name: 'wf',
      created_at: '',
      updated_at: '',
      steps: [
        { id: 'a', name: 'A', instructionPrompt: 'A', agentId: 1 },
        { id: 'b', name: 'B', instructionPrompt: 'B', agentId: 2 },
      ],
    });

    assert.deepEqual(skills.sort(), ['brainstorming', 'systematic-debugging']);
  } finally {
    AgentRepository.prototype.findById = originalFindById;
  }
});

test.test('resolveWorkflowSkills returns empty array when no agent skills exist', async () => {
  const originalFindById = AgentRepository.prototype.findById;
  AgentRepository.prototype.findById = async function () {
    return { id: 1, skills: [] } as never;
  };

  try {
    const skills = await resolveWorkflowSkills({
      id: 1,
      template_id: 'wf',
      name: 'wf',
      created_at: '',
      updated_at: '',
      steps: [
        { id: 'a', name: 'A', instructionPrompt: 'A', agentId: 1 },
      ],
    });

    assert.deepEqual(skills, []);
  } finally {
    AgentRepository.prototype.findById = originalFindById;
  }
});

test.test('resolveWorkflowSkills returns empty array when workflow has no agents', async () => {
  const skills = await resolveWorkflowSkills({
    id: 1,
    template_id: 'wf',
    name: 'wf',
    created_at: '',
    updated_at: '',
    steps: [
      { id: 'a', name: 'A', instructionPrompt: 'A', agentId: undefined },
    ],
  });

  assert.deepEqual(skills, []);
});
