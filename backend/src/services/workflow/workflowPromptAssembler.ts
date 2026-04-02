type WorkflowAgent = {
  name: string;
  role: string;
  description?: string;
  skills: number[];
};

const MAX_UPSTREAM_SUMMARY_LENGTH = 1200;

function normalizeSummaryText(summary: string) {
  const collapsed = summary.replace(/```[\s\S]*?```/g, '[code block omitted]').replace(/\n{3,}/g, '\n\n').trim();
  if (collapsed.length <= MAX_UPSTREAM_SUMMARY_LENGTH) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_UPSTREAM_SUMMARY_LENGTH).trim()}\n...[truncated]`;
}

function extractUpstreamSummaries(inputData: Record<string, unknown> = {}, upstreamStepIds: string[] = []) {
  if (!Array.isArray(upstreamStepIds) || upstreamStepIds.length === 0) {
    return [] as Array<{ stepId: string; summary: string }>;
  }

  const directSummary = inputData.summary;
  if (upstreamStepIds.length === 1 && typeof directSummary === 'string' && directSummary.trim()) {
    return [{ stepId: upstreamStepIds[0]!, summary: normalizeSummaryText(directSummary.trim()) }];
  }

  return upstreamStepIds
    .map((stepId) => {
      const candidate = inputData[stepId] as { summary?: string } | undefined;
      const summary = candidate?.summary;
      if (typeof summary !== 'string' || !summary.trim()) {
        return null;
      }
      return { stepId, summary: normalizeSummaryText(summary.trim()) };
    })
    .filter((item): item is { stepId: string; summary: string } => item !== null);
}

function formatAgentIdentitySection(agent?: WorkflowAgent) {
  if (!agent) {
    return '';
  }

  const description = typeof agent.description === 'string' ? agent.description.trim() : '';

  return [
    '当前执行代理：',
    `代理名称：${agent.name}`,
    `代理角色：${agent.role}`,
    ...(description ? [`代理描述：${description}`] : []),
    '硬性约束：你当前正在以该代理身份执行本步骤。',
    '在分析、执行和总结时，必须保持与该代理角色和技能一致的上下文，不要偏离该代理的职责边界。',
  ].join('\n');
}

function assembleWorkflowPrompt({
  step,
  state,
  inputData,
  upstreamStepIds = [],
  agent,
}: {
  step: { name: string; instructionPrompt: string };
  state: { taskTitle: string; taskDescription: string };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
  agent?: WorkflowAgent;
}) {
  const upstreamSummaries = extractUpstreamSummaries(inputData, upstreamStepIds);
  const agentIdentitySection = formatAgentIdentitySection(agent);

  // When step's instructionPrompt already contains summary format instructions,
  // skip the generic summary instruction to avoid conflicts
  const hasCustomSummaryInstruction = /summary\s*(必须|需要|要求|只|格式|包含)/.test(step.instructionPrompt);
  const defaultSummaryInstruction = agent
    ? '总结中说明本步骤做了什么、是否修改了文件、主要结果、代理角色是否匹配，以及在不匹配时说明偏差或风险。'
    : '总结中说明本步骤做了什么、是否修改了文件、以及主要结果。';
  const summaryInstruction = hasCustomSummaryInstruction ? '' : defaultSummaryInstruction;

  return [
    `当前步骤：${step.name}`,
    `原始需求标题：\n${state.taskTitle}`,
    `原始需求内容：\n${state.taskDescription}`,
    upstreamSummaries.length > 0
      ? ['上游步骤摘要：', ...upstreamSummaries.map((item) => `- ${item.stepId}:\n${item.summary}`)].join('\n')
      : '',
    agentIdentitySection,
    `本步骤要求：\n${step.instructionPrompt}`,
    '执行完成后，只输出最后结果总结。',
    summaryInstruction,
  ].filter(Boolean).join('\n\n').replaceAll('\n', '\\n');
}

export { assembleWorkflowPrompt, extractUpstreamSummaries };
