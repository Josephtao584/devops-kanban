import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { AgentRepository } from '../src/repositories/agentRepository.js';
import { SkillRepository } from '../src/repositories/skillRepository.js';
import { resolveWorkflowSkills } from '../src/services/workflow/workflowSkillSync.js';
import type { WorkflowInstanceEntity } from '../src/types/entities.js';

test.test('resolveWorkflowSkills collects deduplicated agent skills', async () => {
  const originalAgentFindById = AgentRepository.prototype.findById;
  const originalSkillFindAll = SkillRepository.prototype.findAll;
  AgentRepository.prototype.findById = async function (id: number) {
    if (id === 1) {
      return { id: 1, skills: [1, 2] } as never;
    }
    if (id === 2) {
      return { id: 2, skills: [1] } as never;
    }
    return null as never;
  };
  SkillRepository.prototype.findAll = async function () {
    return [
      { id: 1, identifier: 'brainstorming', name: '头脑风暴', created_at: '', updated_at: '' },
      { id: 2, identifier: 'systematic-debugging', name: '系统调试', created_at: '', updated_at: '' },
    ] as never;
  };

  try {
    const workflow: WorkflowInstanceEntity = {
      id: 1,
      instance_id: 'test-instance',
      template_id: 'template-1',
      template_version: '2026-03-22T00:00:00.000Z',
      name: 'Test Instance',
      steps: [
        { id: 'a', name: 'A', instructionPrompt: 'A', agentId: 1 },
        { id: 'b', name: 'B', instructionPrompt: 'B', agentId: 2 },
      ],
      created_at: '2026-03-22T00:00:00.000Z',
      updated_at: '2026-03-22T00:00:00.000Z',
    };

    const skills = await resolveWorkflowSkills(workflow);

    assert.deepEqual(skills.sort(), ['brainstorming', 'systematic-debugging']);
  } finally {
    AgentRepository.prototype.findById = originalAgentFindById;
    SkillRepository.prototype.findAll = originalSkillFindAll;
  }
});

test.test('resolveWorkflowSkills returns empty array when no agent skills exist', async () => {
  const originalAgentFindById = AgentRepository.prototype.findById;
  const originalSkillFindAll = SkillRepository.prototype.findAll;
  AgentRepository.prototype.findById = async function () {
    return { id: 1, skills: [] } as never;
  };
  SkillRepository.prototype.findAll = async function () {
    return [] as never;
  };

  try {
    const workflow: WorkflowInstanceEntity = {
      id: 1,
      instance_id: 'test-instance',
      template_id: 'template-1',
      template_version: '2026-03-22T00:00:00.000Z',
      name: 'Test Instance',
      steps: [
        { id: 'a', name: 'A', instructionPrompt: 'A', agentId: 1 },
      ],
      created_at: '2026-03-22T00:00:00.000Z',
      updated_at: '2026-03-22T00:00:00.000Z',
    };

    const skills = await resolveWorkflowSkills(workflow);

    assert.deepEqual(skills, []);
  } finally {
    AgentRepository.prototype.findById = originalAgentFindById;
    SkillRepository.prototype.findAll = originalSkillFindAll;
  }
});

test.test('resolveWorkflowSkills returns empty array when workflow has no agents', async () => {
  const workflow: WorkflowInstanceEntity = {
    id: 1,
    instance_id: 'test-instance',
    template_id: 'template-1',
    template_version: '2026-03-22T00:00:00.000Z',
    name: 'Test Instance',
    steps: [
      { id: 'a', name: 'A', instructionPrompt: 'A', agentId: undefined as unknown as number },
    ],
    created_at: '2026-03-22T00:00:00.000Z',
    updated_at: '2026-03-22T00:00:00.000Z',
  };

  const skills = await resolveWorkflowSkills(workflow);

  assert.deepEqual(skills, []);
});
