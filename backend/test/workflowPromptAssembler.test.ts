import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { assembleWorkflowPrompt } from '../src/services/workflow/workflowPromptAssembler.js';

type WorkflowPromptParams = Parameters<typeof assembleWorkflowPrompt>[0];
type WorkflowAgent = NonNullable<WorkflowPromptParams['agent']>;
type DefaultWorkflowPromptParams = Omit<WorkflowPromptParams, 'upstreamStepIds'> & {
  upstreamStepIds: string[];
};
type WorkflowPromptOverrides = Omit<Partial<WorkflowPromptParams>, 'step' | 'state'> & {
  step?: Partial<WorkflowPromptParams['step']>;
  state?: Partial<WorkflowPromptParams['state']>;
};

const literalLineBreak = '\\n';

const defaultPromptParams: DefaultWorkflowPromptParams = {
  step: {
    name: '测试',
    instructionPrompt: '执行测试验证。',
  },
  state: {
    taskTitle: '实现步骤重试',
    taskDescription: '工作流失败步骤支持重试',
  },
  inputData: {},
  upstreamStepIds: [],
};

function buildPrompt(overrides: WorkflowPromptOverrides = {}) {
  return assembleWorkflowPrompt({
    ...defaultPromptParams,
    ...overrides,
    step: {
      ...defaultPromptParams.step,
      ...overrides.step,
    },
    state: {
      ...defaultPromptParams.state,
      ...overrides.state,
    },
    inputData: overrides.inputData ?? defaultPromptParams.inputData,
    upstreamStepIds: overrides.upstreamStepIds ?? defaultPromptParams.upstreamStepIds,
  });
}

function buildAgent(overrides: Partial<WorkflowAgent> = {}): WorkflowAgent {
  return {
    name: '需求代理',
    role: '需求分析师',
    description: '负责需求分析与方案拆解',
    skills: [1, 2],
    ...overrides,
  };
}

function assertPromptIncludesLiteralLine(prompt: string, label: string, value: string) {
  assert.ok(
    prompt.includes(`${label}${literalLineBreak}${value}`),
    `Expected prompt to include "${label}${literalLineBreak}${value}"`,
  );
}

function assertInOrder(prompt: string, sections: string[]) {
  const positions = sections.map((section) => prompt.indexOf(section));

  sections.forEach((section, index) => {
    assert.notEqual(positions[index], -1, `Expected prompt to include "${section}"`);
  });

  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(
      positions[index - 1]! < positions[index]!,
      `Expected "${sections[index - 1]}" to appear before "${sections[index]}"`,
    );
  }
}

test.test('assembleWorkflowPrompt builds first-step prompt with agent identity and required guidance', () => {
  const prompt = buildPrompt({
    step: {
      name: '需求设计',
      instructionPrompt: '先完成需求分析和设计拆解。',
    },
    inputData: {
      taskId: 1,
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
    agent: buildAgent(),
  });

  assert.match(prompt, /当前步骤：需求设计/);
  assertPromptIncludesLiteralLine(prompt, '原始需求标题：', '实现步骤重试');
  assertPromptIncludesLiteralLine(prompt, '原始需求内容：', '工作流失败步骤支持重试');
  assert.doesNotMatch(prompt, /上游步骤摘要：/);
  assert.match(prompt, /当前执行代理：/);
  assert.match(prompt, /代理名称：需求代理/);
  assert.match(prompt, /代理角色：需求分析师/);
  assert.match(prompt, /代理描述：负责需求分析与方案拆解/);
  assert.match(prompt, /代理角色是否匹配/);
  assert.match(prompt, /最后结果总结/);
  assertInOrder(prompt, ['原始需求标题：', '原始需求内容：', '当前执行代理：', '本步骤要求：']);
  assertPromptIncludesLiteralLine(prompt, '本步骤要求：', '先完成需求分析和设计拆解。');
});

test.test('assembleWorkflowPrompt omits the entire current-agent section when no agent is supplied', () => {
  const prompt = buildPrompt({
    step: {
      name: '需求设计',
      instructionPrompt: '先完成需求分析和设计拆解。',
    },
    inputData: {
      taskId: 1,
      taskTitle: '实现步骤重试',
      taskDescription: '工作流失败步骤支持重试',
      worktreePath: '/tmp/worktree',
    },
  });

  assert.doesNotMatch(prompt, /当前执行代理：/);
  assert.doesNotMatch(prompt, /代理名称：/);
  assert.doesNotMatch(prompt, /代理角色：/);
  assert.doesNotMatch(prompt, /代理描述：/);
  assert.doesNotMatch(prompt, /代理角色是否匹配/);
  assertPromptIncludesLiteralLine(prompt, '本步骤要求：', '先完成需求分析和设计拆解。');
});

test.test('assembleWorkflowPrompt places agent identity after upstream summaries and before step requirements', () => {
  const prompt = buildPrompt({
    step: {
      name: '代码开发',
      instructionPrompt: '根据设计摘要完成代码实现。',
    },
    inputData: {
      summary: '已完成重试方案设计',
    },
    upstreamStepIds: ['requirement-design'],
    agent: buildAgent({
      name: '开发代理',
      role: '工程师',
      description: '负责实现与交付',
      skills: [3, 4],
    }),
  });

  assert.match(prompt, /上游步骤摘要：/);
  assert.ok(prompt.includes(`- requirement-design:${literalLineBreak}已完成重试方案设计`));
  assert.match(prompt, /当前执行代理：/);
  assert.match(prompt, /代理名称：开发代理/);
  assert.match(prompt, /代理角色：工程师/);
  assertInOrder(prompt, ['上游步骤摘要：', '当前执行代理：', '本步骤要求：']);
  assertPromptIncludesLiteralLine(prompt, '本步骤要求：', '根据设计摘要完成代码实现。');
});

test.test('assembleWorkflowPrompt includes all upstream summaries for merged inputs', () => {
  const prompt = buildPrompt({
    step: {
      name: '代码审查',
      instructionPrompt: '根据上游结果完成代码审查。',
    },
    inputData: {
      'code-development': { summary: '开发完成' },
      testing: { summary: '测试通过' },
    },
    upstreamStepIds: ['code-development', 'testing'],
  });

  assert.ok(prompt.includes(`- code-development:${literalLineBreak}开发完成`));
  assert.ok(prompt.includes(`- testing:${literalLineBreak}测试通过`));
});

test.test('assembleWorkflowPrompt omits upstream summary section when summaries are missing', () => {
  const prompt = buildPrompt({
    inputData: {},
    upstreamStepIds: ['code-development'],
  });

  assert.doesNotMatch(prompt, /上游步骤摘要：/);
});

test.test('assembleWorkflowPrompt omits agent description when description is missing', () => {
  const prompt = buildPrompt({
    agent: {
      name: '测试代理',
      role: '测试工程师',
      skills: [],
    },
  });

  assert.match(prompt, /当前执行代理：/);
  assert.match(prompt, /代理名称：测试代理/);
  assert.match(prompt, /代理角色：测试工程师/);
  assert.doesNotMatch(prompt, /代理描述：/);
});

test.test('assembleWorkflowPrompt omits agent description when description is blank', () => {
  const prompt = buildPrompt({
    agent: buildAgent({
      name: '测试代理',
      role: '测试工程师',
      description: '   ',
      skills: [5],
    }),
  });

  assert.match(prompt, /当前执行代理：/);
  assert.doesNotMatch(prompt, /代理描述：/);
});
