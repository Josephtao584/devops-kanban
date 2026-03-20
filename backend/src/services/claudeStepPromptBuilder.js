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
        '执行完成后，只输出最后结果。',
        '必须在stdout最后一行输出__STEP_RESULT__(json)。',
        '结果JSON固定格式为{\"changedFiles\":[...],\"summary\":\"...\"}。',
        'changedFiles必须填写实际修改过的相对路径文件列表。',
        'summary必须概括完成的主要工作。',
    ].join('\\n');
}
