import { ensureSkillsInWorktree } from '../../utils/skillSync.js';
import type { ExecutorType } from '../../types/executors.js';

type PrepareExecutionSkillsInput = {
  executorType: ExecutorType;
  skillNames: string[];
  executionPath: string;
};

async function prepareClaudeCodeSkills(skillNames: string[], executionPath: string) {
  await ensureSkillsInWorktree(skillNames, executionPath);
}

async function prepareExecutionSkills({ executorType, skillNames, executionPath }: PrepareExecutionSkillsInput): Promise<void> {
  if (!skillNames || skillNames.length === 0) {
    return;
  }

  if (executorType === 'CLAUDE_CODE') {
    await prepareClaudeCodeSkills(skillNames, executionPath);
  }
}

export { prepareExecutionSkills };
export type { PrepareExecutionSkillsInput };
