import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStepPrompt } from '../src/services/claudeStepPromptBuilder.js';

test('buildStepPrompt 生成当前的精简 step 指令', () => {
  const prompt = buildStepPrompt({
    stepId: 'requirement-design',
    taskTitle: '测试任务',
    taskDescription: '生成设计文档',
    worktreePath: '/tmp/task-1',
  });

  assert.match(prompt, /^请你完成以下需求的设计文档/);
  assert.match(prompt, /需求标题:测试任务/);
  assert.match(prompt, /需求内容:生成设计文档/);
  assert.match(prompt, /执行完成后，只输出最后结果。/);
  assert.match(prompt, /__STEP_RESULT__/);
  assert.match(prompt, /changedFiles/);
});

