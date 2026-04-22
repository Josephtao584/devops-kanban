import { writeSummaryToFile } from './workflowSummaryWriter.js';

type WorkflowAgent = {
  name: string;
  role: string;
  description?: string;
  skills: number[];
};

function normalizeSummaryText(summary: string) {
  return summary.replace(/```[\s\S]*?```/g, '[code block omitted]').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractUpstreamSummaries(
  inputData: Record<string, unknown> = {},
  upstreamStepIds: string[] = [],
  worktreePath?: string,
): Promise<Array<{ stepId: string; summary: string }>> {
  if (!Array.isArray(upstreamStepIds) || upstreamStepIds.length === 0) {
    return [];
  }

  const directSummary = inputData.summary;
  if (upstreamStepIds.length === 1 && typeof directSummary === 'string' && directSummary.trim()) {
    const text = normalizeSummaryText(directSummary.trim());
    const relativePath = worktreePath ? await writeSummaryToFile(worktreePath, upstreamStepIds[0]!, text) : null;
    if (relativePath) {
      return [{ stepId: upstreamStepIds[0]!, summary: `上游步骤摘要较长，已保存至 ${relativePath}，请读取该文件。` }];
    }
    return [{ stepId: upstreamStepIds[0]!, summary: text }];
  }

  const results: Array<{ stepId: string; summary: string }> = [];
  for (const stepId of upstreamStepIds) {
    const candidate = inputData[stepId] as { summary?: string } | undefined;
    const summary = candidate?.summary;
    if (typeof summary !== 'string' || !summary.trim()) {
      continue;
    }
    const text = normalizeSummaryText(summary.trim());
    const relativePath = worktreePath ? await writeSummaryToFile(worktreePath, stepId, text) : null;
    if (relativePath) {
      results.push({ stepId, summary: `上游步骤摘要较长，已保存至 ${relativePath}，请读取该文件。` });
    } else {
      results.push({ stepId, summary: text });
    }
  }
  return results;
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

function formatRepoAnalysisContext(isFirstStep: boolean) {
  if (!isFirstStep) {
    return '';
  }
  return '提示：代码仓根目录可能存在 KANBAN_COMPASS.md 文件，包含项目结构和上下文信息，需要时可参考。';
}

function renderPromptPlaceholders(prompt: string, projectEnv: Record<string, string>): string {
  if (!projectEnv || Object.keys(projectEnv).length === 0) {
    return prompt;
  }
  return prompt.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in projectEnv ? (projectEnv[key] as string) : match;
  });
}

async function assembleWorkflowPrompt({
  step,
  state,
  inputData,
  upstreamStepIds = [],
  agent,
  projectEnv,
  isFirstStep = true,
  worktreePath,
  canEarlyExit = false,
}: {
  step: { name: string; instructionPrompt: string };
  state: { taskTitle: string; taskDescription: string };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
  agent?: WorkflowAgent;
  projectEnv?: Record<string, string>;
  isFirstStep?: boolean;
  worktreePath?: string;
  canEarlyExit?: boolean;
}) {
  const upstreamSummaries = await extractUpstreamSummaries(inputData, upstreamStepIds, worktreePath);
  const agentIdentitySection = formatAgentIdentitySection(agent);
  const repoAnalysisContext = formatRepoAnalysisContext(isFirstStep);

  const renderedInstruction = projectEnv
    ? renderPromptPlaceholders(step.instructionPrompt, projectEnv)
    : step.instructionPrompt;

  // When step's instructionPrompt already contains summary format instructions,
  // skip the generic summary instruction to avoid conflicts
  const hasCustomSummaryInstruction = /summary\s*(必须|需要|要求|只|格式|包含)/.test(renderedInstruction);
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
    repoAnalysisContext,
    `本步骤要求：\n${renderedInstruction}`,
    '执行完成后，只输出最后结果总结。',
    summaryInstruction,
    canEarlyExit
      ? '如果认为目标已达成或无法继续，请在总结末尾以 JSON 格式输出：\n{"decision": "SUCCESS_EXIT", "reason": "..."}  或\n{"decision": "FAIL_EXIT", "reason": "..."}  或\n{"decision": "CONTINUE"}'
      : '',
  ].filter(Boolean).join('\n\n').replaceAll('\n', '\\n');
}

export { assembleWorkflowPrompt, extractUpstreamSummaries, renderPromptPlaceholders };
