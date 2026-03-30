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

  switch (executorType) {
    case 'CLAUDE_CODE':
      await prepareClaudeCodeSkills(skillNames, executionPath);
      return;
    case 'CODEX':
    case 'OPENCODE':
      return;
    default:
      return;
  }
}

export { prepareExecutionSkills };
export type { PrepareExecutionSkillsInput };
