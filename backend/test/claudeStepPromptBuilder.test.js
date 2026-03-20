import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStepPrompt } from '../src/services/claudeStepPromptBuilder.js';

test('buildStepPrompt 生成具体的一次性执行指令', () => {
  const prompt = buildStepPrompt({
    stepId: 'requirement-design',
    taskTitle: '测试任务',
    taskDescription: '生成设计文档',
    worktreePath: '/tmp/task-1',
  });

  assert.match(prompt, /^你是一个一次性执行的 Claude Code 代理。/);
  assert.match(prompt, /不要提问，不要解释，直接执行任务。/);
  assert.match(prompt, /执行完成后，只输出最后结果。/);
  assert.match(prompt, /\.kanban\/step-result\.json/);
  assert.match(prompt, /__STEP_RESULT__/);
  assert.match(prompt, /测试任务/);
});

