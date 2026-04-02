import { AgentRepository } from '../../repositories/agentRepository.js';
import { SkillRepository } from '../../repositories/skillRepository.js';
import type { WorkflowInstanceEntity } from '../../types/entities.js';

const agentRepo = new AgentRepository();
const skillRepo = new SkillRepository();

async function resolveWorkflowSkills(workflow: WorkflowInstanceEntity): Promise<string[]> {
  const agentIds = [...new Set(
    workflow.steps
      .map(s => s.agentId)
      .filter((id): id is number => id !== undefined)
  )];

  if (agentIds.length === 0) {
    return [];
  }

  const allSkillIds = new Set<number>();
  for (const agentId of agentIds) {
    const agent = await agentRepo.findById(agentId);
    if (agent?.skills && Array.isArray(agent.skills)) {
      agent.skills.forEach(id => allSkillIds.add(id));
    }
  }

  const allSkills = await skillRepo.findAll();
  const skillMap = new Map(allSkills.map(s => [s.id, s.identifier || s.name]));

  return [...allSkillIds].map(id => skillMap.get(id) || String(id));
}

async function resolveAgentSkills(agentId: number): Promise<{ skillNames: string[]; executorType: string }> {
  const agent = await agentRepo.findById(agentId);
  if (!agent || !Array.isArray(agent.skills) || agent.skills.length === 0) {
    return { skillNames: [], executorType: agent?.executorType || 'CLAUDE_CODE' };
  }

  const allSkills = await skillRepo.findAll();
  const skillMap = new Map(allSkills.map(s => [s.id, s.identifier || s.name]));

  const skillNames = agent.skills
    .map(id => skillMap.get(id) || String(id))
    .filter(name => {
      if (name === String(Number(name))) {
        console.warn(`[workflowSkillSync] Skill ID ${name} not found in DB, skipping`);
        return false;
      }
      return true;
    });

  return { skillNames, executorType: agent.executorType || 'CLAUDE_CODE' };
}

export { resolveWorkflowSkills, resolveAgentSkills };
