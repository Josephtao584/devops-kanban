import { AgentRepository } from '../../repositories/agentRepository.js';
import type { WorkflowTemplateEntity } from '../../types/entities.js';

const agentRepo = new AgentRepository();

async function resolveWorkflowSkills(workflowTemplate: WorkflowTemplateEntity): Promise<string[]> {
  const agentIds = [...new Set(
    workflowTemplate.steps
      .map(s => s.agentId)
      .filter((id): id is number => id !== undefined)
  )];

  if (agentIds.length === 0) {
    return [];
  }

  const allSkills = new Set<string>();
  for (const agentId of agentIds) {
    const agent = await agentRepo.findById(agentId);
    if (agent?.skills && Array.isArray(agent.skills)) {
      agent.skills.forEach(s => allSkills.add(s));
    }
  }

  return [...allSkills];
}

export { resolveWorkflowSkills };
