import { ClaudeStepRunner } from './claudeStepRunner.js';

const defaultRunner = new ClaudeStepRunner();

export async function executeClaudeWorkflowStep({
  runner = defaultRunner,
  context,
  stepId,
  worktreePath,
  taskTitle,
  taskDescription,
  previousSummary = '',
}) {
  const result = await runner.runStep({
    stepId,
    worktreePath,
    taskTitle,
    taskDescription,
    previousSummary,
    onSpawn: (proc) => {
      if (context) {
        context.proc = proc;
      }
    },
  });

  return result.parsedResult;
}
