import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { AgentRepository } from '../src/repositories/agentRepository.js';
import { SkillRepository } from '../src/repositories/skillRepository.js';
import { resolveAgentSkills } from '../src/services/workflow/workflowSkillSync.js';

test.test('resolveAgentSkills resolves single agent skills to identifiers', async () => {
  const origFindById = AgentRepository.prototype.findById;
  const origFindAll = SkillRepository.prototype.findAll;

  AgentRepository.prototype.findById = async function (id: number) {
    if (id === 10) {
      return { id: 10, skills: [1, 2], executorType: 'CLAUDE_CODE' } as never;
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
    const result = await resolveAgentSkills(10);
    assert.deepEqual(result.skillNames.sort(), ['brainstorming', 'systematic-debugging']);
    assert.equal(result.executorType, 'CLAUDE_CODE');
  } finally {
    AgentRepository.prototype.findById = origFindById;
    SkillRepository.prototype.findAll = origFindAll;
  }
});

test.test('resolveAgentSkills returns empty when agent has no skills', async () => {
  const origFindById = AgentRepository.prototype.findById;
  const origFindAll = SkillRepository.prototype.findAll;

  AgentRepository.prototype.findById = async function () {
    return { id: 10, skills: [], executorType: 'CLAUDE_CODE' } as never;
  };
  SkillRepository.prototype.findAll = async function () {
    return [] as never;
  };

  try {
    const result = await resolveAgentSkills(10);
    assert.deepEqual(result.skillNames, []);
    assert.equal(result.executorType, 'CLAUDE_CODE');
  } finally {
    AgentRepository.prototype.findById = origFindById;
    SkillRepository.prototype.findAll = origFindAll;
  }
});

test.test('resolveAgentSkills returns defaults when agent not found', async () => {
  const origFindById = AgentRepository.prototype.findById;
  const origFindAll = SkillRepository.prototype.findAll;

  AgentRepository.prototype.findById = async function () {
    return null as never;
  };
  SkillRepository.prototype.findAll = async function () {
    return [] as never;
  };

  try {
    const result = await resolveAgentSkills(999);
    assert.deepEqual(result.skillNames, []);
    assert.equal(result.executorType, 'CLAUDE_CODE');
  } finally {
    AgentRepository.prototype.findById = origFindById;
    SkillRepository.prototype.findAll = origFindAll;
  }
});
