import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleWorkflowPrompt } from '../src/services/workflow/workflowPromptAssembler.js';

test('assembleWorkflowPrompt builds first-step prompt without upstream summaries', () => {
  const prompt = assembleWorkflowPrompt({
    step: {
      id: 'requirement-design',
      name: '需求设计',
      instructionPrompt: '先完成需求分析和设计拆解。',
    },
    state: {
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
    inputData: {
      taskId: 1,
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
    upstreamStepIds: [],
  });

  assert.match(prompt, /当前步骤：需求设计/);
  assert.match(prompt, /原始需求标题：\\n实现步骤重试/);
  assert.match(prompt, /原始需求内容：\\n工作流失败步骤支持重试/);
  assert.doesNotMatch(prompt, /上游步骤摘要：/);
  assert.match(prompt, /本步骤要求：\\n先完成需求分析和设计拆解。/);
});

test('assembleWorkflowPrompt includes sequential upstream summary', () => {
  const prompt = assembleWorkflowPrompt({
    step: {
      id: 'code-development',
      name: '代码开发',
      instructionPrompt: '根据设计摘要完成代码实现。',
    },
    state: {
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
    inputData: {
      summary: '已完成重试方案设计',
    },
    upstreamStepIds: ['requirement-design'],
  });

  assert.match(prompt, /上游步骤摘要：/);
  assert.match(prompt, /- requirement-design:\\n已完成重试方案设计/);
  assert.match(prompt, /本步骤要求：\\n根据设计摘要完成代码实现。/);
});

test('assembleWorkflowPrompt includes all upstream summaries for merged inputs', () => {
  const prompt = assembleWorkflowPrompt({
    step: {
      id: 'code-review',
      name: '代码审查',
      instructionPrompt: '根据上游结果完成代码审查。',
    },
    state: {
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
    inputData: {
      'code-development': { summary: '开发完成' },
      testing: { summary: '测试通过' },
    },
    upstreamStepIds: ['code-development', 'testing'],
  });

  assert.match(prompt, /- code-development:\\n开发完成/);
  assert.match(prompt, /- testing:\\n测试通过/);
});

test('assembleWorkflowPrompt omits upstream summary section when summaries are missing', () => {
  const prompt = assembleWorkflowPrompt({
    step: {
      id: 'testing',
      name: '测试',
      instructionPrompt: '执行测试验证。',
    },
    state: {
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
    inputData: {},
    upstreamStepIds: ['code-development'],
  });

  assert.doesNotMatch(prompt, /上游步骤摘要：/);
});
