import { ensureSkillsInWorktree, ensureOpenCodeSkillsInWorktree } from '../../utils/skillSync.js';
import {ExecutorType} from '../../types/executors.js';

const BUILTIN_OPENCODE_SKILLS = ['ask-user-question'];

type PrepareExecutionSkillsInput = {
  executorType: ExecutorType;
  skillNames: string[];
  executionPath: string;
};

async function prepareClaudeCodeSkills(skillNames: string[], executionPath: string) {
  await ensureSkillsInWorktree(skillNames, executionPath);
}

async function prepareOpenCodeSkills(skillNames: string[], executionPath: string) {
  const allSkills = [...BUILTIN_OPENCODE_SKILLS, ...skillNames.filter(s => !BUILTIN_OPENCODE_SKILLS.includes(s))];
  await ensureOpenCodeSkillsInWorktree(allSkills, executionPath);
}

async function prepareExecutionSkills({ executorType, skillNames, executionPath }: PrepareExecutionSkillsInput): Promise<void> {
  if (executorType === ExecutorType.OPEN_CODE) {
    await prepareOpenCodeSkills(skillNames, executionPath);
  } else if (executorType === ExecutorType.CLAUDE_CODE && skillNames && skillNames.length > 0) {
    await prepareClaudeCodeSkills(skillNames, executionPath);
  }
}

export { prepareExecutionSkills };
export type { PrepareExecutionSkillsInput };
