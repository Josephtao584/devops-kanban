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
        agentId: 1,
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据上游步骤摘要完成代码实现，保持改动聚焦，并总结主要修改结果。',
        agentId: 2,
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '根据上游步骤摘要执行必要验证，说明测试结果、发现的问题和结论。',
        agentId: 1,
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '根据上游步骤摘要完成代码审查，说明主要风险、问题和审查结论。',
        agentId: 4,
      },
    ],
  };

  assert.equal(payload.steps[1]!.agentId, 2);
  assert.equal(payload.steps[2]!.agentId, null);
});
