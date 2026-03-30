import { AgentRepository } from '../../repositories/agentRepository.js';
import { SkillRepository } from '../../repositories/skillRepository.js';
import type { WorkflowTemplateEntity } from '../../types/entities.js';

const agentRepo = new AgentRepository();
const skillRepo = new SkillRepository();

async function resolveWorkflowSkills(workflowTemplate: WorkflowTemplateEntity): Promise<string[]> {
  const agentIds = [...new Set(
    workflowTemplate.steps
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

export { resolveWorkflowSkills };
