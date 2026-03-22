import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { UpdateWorkflowTemplateInput } from '../../src/types/dto/workflowTemplates.ts';

test.test('workflow template DTO accepts the existing full-template update payload', () => {
  const payload: UpdateWorkflowTemplateInput = {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        instructionPrompt: '先完成需求分析，整理实现思路、关键约束和交付方案。',
        executor: {
          type: 'CLAUDE_CODE',
          commandOverride: null,
          args: [],
          env: {},
        },
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据上游步骤摘要完成代码实现，保持改动聚焦，并总结主要修改结果。',
        executor: {
          type: 'CODEX',
          commandOverride: 'codex run',
          args: ['--json'],
          env: { MODE: 'strict' },
        },
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '根据上游步骤摘要执行必要验证，说明测试结果、发现的问题和结论。',
        executor: {
          type: 'OPENCODE',
          commandOverride: null,
          args: ['test'],
          env: { CI: 'true' },
        },
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '根据上游步骤摘要完成代码审查，说明主要风险、问题和审查结论。',
        executor: {
          type: 'CLAUDE_CODE',
          commandOverride: null,
          args: [],
          env: {},
        },
      },
    ],
  };

  assert.equal(payload.steps[1]!.executor.type, 'CODEX');
  assert.equal(payload.steps[2]!.executor.env.CI, 'true');
});
