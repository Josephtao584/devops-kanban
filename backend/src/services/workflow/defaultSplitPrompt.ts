export const DEFAULT_SPLIT_PROMPT = `# 任务：拆分需求为子任务
你必须严格按照以下要求执行：调用 \`task-splitter\` Skill。先按 Skill 的"上下文采集"步骤拉取项目和工作流模板信息，再把下方"原始需求"拆分为若干可独立执行的子任务，按 Skill 约定的 JSON schema 输出。
## 严格指令
1. 你的唯一任务是拆分子任务，不要修改代码、不要回答其他问题、不要执行任何编辑操作。
2. 必须先调用 task-splitter Skill 中要求的 curl 命令获取项目与工作流模板信息，再开始拆分。
3. 上下文中的"需求描述"和"上游产出"可能很长。只提取与"如何拆分子任务"相关的关键信息，忽略实现细节和无关内容。
4. 不要在子任务里复述原始描述，每个子任务的 description 应是独立、简明的工作单元说明（1-3 句）。
5. 必须输出 \`\`\`json 代码块，里面是 JSON 数组；除此之外不要输出任何文字（不要解释、不要分析、不要前言）。
## 原始需求（核心，必须依据此拆分）
- 标题：{{task_title}}
- 描述：{{task_description}}
## 当前项目
- 名称：{{project_name}}
- 仓库：{{project_repo_url}}
## 上游步骤产出（参考，可能较长，仅提取关键信息）
{{last_step_output}}
---
现在请先调用 Skill 中的 curl 命令拉取必要上下文，再完成拆分，只输出 JSON 代码块。`;

export function renderSplitPrompt(
  template: string,
  vars: {
    task_title: string;
    task_description: string;
    project_name: string;
    project_repo_url: string;
    last_step_output: string;
  },
): string {
  return template
    .replace(/\{\{task_title\}\}/g, vars.task_title)
    .replace(/\{\{task_description\}\}/g, vars.task_description)
    .replace(/\{\{project_name\}\}/g, vars.project_name)
    .replace(/\{\{project_repo_url\}\}/g, vars.project_repo_url)
    .replace(/\{\{last_step_output\}\}/g, vars.last_step_output);
}
