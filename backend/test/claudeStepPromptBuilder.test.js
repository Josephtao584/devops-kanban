import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStepPrompt } from '../src/services/claudeStepPromptBuilder.js';

test('buildStepPrompt 生成 summary-only step 指令', () => {
  const prompt = buildStepPrompt({
    stepId: 'requirement-design',
    taskTitle: '测试任务',
    taskDescription: '生成设计文档',
    worktreePath: '/tmp/task-1',
  });

  assert.match(prompt, /^请你完成以下需求的设计文档/);
  assert.match(prompt, /需求标题:测试任务/);
  assert.match(prompt, /需求内容:生成设计文档/);
  assert.match(prompt, /执行完成后，只输出最后结果总结。/);
  assert.doesNotMatch(prompt, /__STEP_RESULT__/);
  assert.doesNotMatch(prompt, /changedFiles/);
  assert.match(prompt, /总结中说明本步骤做了什么/);
});

