import { AgentRepository } from '../../repositories/agentRepository.js';
import { SkillRepository } from '../../repositories/skillRepository.js';
import type { WorkflowInstanceEntity } from '../../types/entities.js';
import type { ExecutorType } from '../../types/executors.js';
import { logger } from '../../utils/logger.js';

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

  const allSkillNames = new Set<string>();
  for (const agentId of agentIds) {
    const { skillNames } = await resolveAgentSkills(agentId);
    skillNames.forEach(name => allSkillNames.add(name));
  }

  return [...allSkillNames];
}

async function resolveAgentSkills(agentId: number): Promise<{ skillNames: string[]; executorType: ExecutorType }> {
  const agent = await agentRepo.findById(agentId);
  if(!agent){
    return { skillNames: [], executorType: 'CLAUDE_CODE' as ExecutorType };
  }
  if (!Array.isArray(agent.skills) || agent.skills.length === 0) {
    return { skillNames: [], executorType: agent.executorType };
  }

  const allSkills = await skillRepo.findAll();
  const skillMap = new Map(allSkills.map(s => [s.id, s.identifier || s.name]));

  const skillNames = agent.skills
    .map(id => skillMap.get(id) || String(id))
    .filter(name => {
      if (name === String(Number(name))) {
        logger.warn('WorkflowSkillSync', `Skill ID ${name} not found in DB, skipping`);
        return false;
      }
      return true;
    });

  return { skillNames, executorType: agent.executorType};
}

export { resolveWorkflowSkills, resolveAgentSkills };
