function extractUpstreamSummaries(inputData: Record<string, unknown> = {}, upstreamStepIds: string[] = []) {
  if (!Array.isArray(upstreamStepIds) || upstreamStepIds.length === 0) {
    return [] as Array<{ stepId: string; summary: string }>;
  }

  const directSummary = inputData.summary;
  if (upstreamStepIds.length === 1 && typeof directSummary === 'string' && directSummary.trim()) {
    return [{ stepId: upstreamStepIds[0]!, summary: directSummary.trim() }];
  }

  return upstreamStepIds
    .map((stepId) => {
      const candidate = inputData[stepId] as { summary?: string } | undefined;
      const summary = candidate?.summary;
      if (typeof summary !== 'string' || !summary.trim()) {
        return null;
      }
      return { stepId, summary: summary.trim() };
    })
    .filter((item): item is { stepId: string; summary: string } => item !== null);
}

function assembleWorkflowPrompt({
  step,
  state,
  inputData,
  upstreamStepIds = [],
}: {
  step: { name: string; instructionPrompt: string };
  state: { taskTitle: string; taskDescription: string };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
}) {
  const upstreamSummaries = extractUpstreamSummaries(inputData, upstreamStepIds);

  return [
    `当前步骤：${step.name}`,
    `原始需求标题：\n${state.taskTitle}`,
    `原始需求内容：\n${state.taskDescription}`,
    upstreamSummaries.length > 0
      ? ['上游步骤摘要：', ...upstreamSummaries.map((item) => `- ${item.stepId}:\n${item.summary}`)].join('\n')
      : '',
    `本步骤要求：\n${step.instructionPrompt}`,
    '执行完成后，只输出最后结果总结。',
    '总结中说明本步骤做了什么、是否修改了文件、以及主要结果。',
  ].filter(Boolean).join('\n\n');
}

export { assembleWorkflowPrompt, extractUpstreamSummaries };
