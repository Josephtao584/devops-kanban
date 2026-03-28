import { ensureSkillsInWorktree } from '../../utils/skillSync.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import type { WorkflowTemplateEntity } from '../../types/entities.js';

const agentRepo = new AgentRepository();

export async function syncWorkflowSkills(
  workflowTemplate: WorkflowTemplateEntity,
  projectPath: string
): Promise<void> {
  // 获取所有 step 用到的 agent IDs（去重）
  const agentIds = [...new Set(
    workflowTemplate.steps
      .map(s => s.agentId)
      .filter((id): id is number => id !== undefined)
  )];

  if (agentIds.length === 0) {
    console.log('[workflowSkillSync] No agents found in workflow template');
    return;
  }

  // 收集所有 skills
  const allSkills = new Set<string>();
  for (const agentId of agentIds) {
    const agent = await agentRepo.findById(agentId);
    if (agent?.skills && Array.isArray(agent.skills)) {
      agent.skills.forEach(s => allSkills.add(s));
    }
  }

  if (allSkills.size === 0) {
    console.log('[workflowSkillSync] No skills found in workflow agents');
    return;
  }

  console.log(`[workflowSkillSync] Syncing ${allSkills.size} skills to project: ${projectPath}`);
  await ensureSkillsInWorktree([...allSkills], projectPath);
}
