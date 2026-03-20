export function buildStepPrompt({
  stepId,
  taskTitle,
  taskDescription,
  worktreePath,
  previousSummary = '',
}) {
  const taskBody = [
    `需求标题:${taskTitle}`,
    `需求内容:${taskDescription}`,
    previousSummary ? `上一步摘要:${previousSummary}` : '',
  ].filter(Boolean).join(',');

  return [
    '请你完成以下需求的设计文档',
    taskBody,
    '执行完成后，只输出最后结果总结。',
    '总结中说明本步骤做了什么、是否修改了文件、以及主要结果。',
  ].join('\n');
}
