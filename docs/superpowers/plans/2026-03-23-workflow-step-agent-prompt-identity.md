# Workflow Step Agent Prompt Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject each workflow step's bound agent role and skills into the runtime prompt so the executor works under that identity and is instructed to report role mismatch in the final summary.

**Architecture:** Keep the change inside the existing workflow prompt assembly path. `workflowStepExecutor.ts` already resolves the bound agent before executor selection, so it should pass that agent into `workflowPromptAssembler.ts`, which becomes the single place that turns task context, upstream summaries, and agent identity into the final prompt text. This preserves executor behavior and makes the feature apply uniformly to Claude Code, Codex, and OpenCode.

**Tech Stack:** TypeScript, Fastify backend services, Node test runner, tsx

---

## File Map

### Backend files to modify
- `backend/src/services/workflow/workflowPromptAssembler.ts` — add agent identity input and render the new hard-constraint prompt block
- `backend/src/services/workflow/workflowStepExecutor.ts` — pass the resolved bound agent into prompt assembly

### Backend tests to modify
- `backend/test/workflowPromptAssembler.test.ts` — lock the new prompt section, ordering, edge cases, and summary instructions
- `backend/test/workflowStepExecutor.test.ts` — verify the executor receives a prompt containing the bound agent identity and that mismatch stays non-blocking

### Verification commands
- `cd backend && node --import tsx --test test/workflowPromptAssembler.test.ts`
- `cd backend && node --import tsx --test test/workflowStepExecutor.test.ts`
- `cd backend && node --import tsx --test test/workflowPromptAssembler.test.ts test/workflowStepExecutor.test.ts`
- `cd backend && npm run typecheck`

## Task 1: Add failing prompt-assembler coverage for agent identity and prompt shape

**Files:**
- Modify: `backend/test/workflowPromptAssembler.test.ts`
- Reference: `backend/src/services/workflow/workflowPromptAssembler.ts`

- [ ] **Step 1: Update the first-step prompt test to pass an agent object and assert the new identity section**

```ts
const prompt = assembleWorkflowPrompt({
  step: {
    name: '需求设计',
    instructionPrompt: '先完成需求分析和设计拆解。',
  },
  agent: {
    name: '后端开发 - 小李',
    role: 'BACKEND_DEV',
    description: '后端开发专家',
    skills: ['Java', 'Spring Boot', 'RESTful API'],
  },
  state: {
    taskTitle: '实现步骤重试',
    taskDescription: '工作流失败步骤支持重试',
  },
  inputData: {
    taskId: 1,
    taskTitle: '实现步骤重试',
    taskDescription: '工作流失败步骤支持重试',
    worktreePath: '/tmp/worktree',
  },
  upstreamStepIds: [],
});

assert.match(prompt, /当前执行代理：/);
assert.match(prompt, /代理名称：\\n后端开发 - 小李/);
assert.match(prompt, /代理角色：\\nBACKEND_DEV/);
assert.match(prompt, /代理技能：\\n- Java\\n- Spring Boot\\n- RESTful API/);
```

- [ ] **Step 2: Add assertions for the hard-constraint wording, ordering, and mismatch-reporting instruction**

```ts
assert.match(prompt, /你当前正在以该代理身份执行此工作流步骤/);
assert.match(prompt, /角色与步骤不完全匹配时，仍然继续完成当前步骤/);
assert.match(prompt, /总结中说明与当前代理角色是否匹配/);
assert.ok(prompt.indexOf('当前执行代理：') > prompt.indexOf('上游步骤摘要：') || !prompt.includes('上游步骤摘要：'));
assert.ok(prompt.indexOf('当前执行代理：') < prompt.indexOf('本步骤要求：'));
```

- [ ] **Step 3: Add edge-case tests for missing description and empty skills**

Define expected rendering explicitly:

```ts
assert.doesNotMatch(promptWithoutDescription, /代理描述：/);
assert.match(promptWithEmptySkills, /代理技能：\\n未提供/);
```

- [ ] **Step 4: Run the direct prompt-assembler test command and verify it fails**

Run: `cd backend && node --import tsx --test test/workflowPromptAssembler.test.ts`
Expected: FAIL because `assembleWorkflowPrompt` does not yet accept `agent` or render the identity block and edge-case output.

- [ ] **Step 5: Commit the failing test update**

```bash
git add backend/test/workflowPromptAssembler.test.ts
git commit -m "test: define workflow agent prompt identity expectations"
```

## Task 2: Implement the agent identity prompt block

**Files:**
- Modify: `backend/src/services/workflow/workflowPromptAssembler.ts`
- Test: `backend/test/workflowPromptAssembler.test.ts`

- [ ] **Step 1: Extend the prompt assembler input shape to include the bound agent**

Use a minimal inline type like:

```ts
agent: {
  name: string;
  role: string;
  description?: string;
  skills: string[];
};
```

- [ ] **Step 2: Add a helper that formats the agent identity section with stable edge-case rendering**

Implement a focused helper that returns a single block string, for example:

```ts
function buildAgentContext(agent: { name: string; role: string; description?: string; skills: string[] }) {
  const renderedSkills = agent.skills.length > 0
    ? agent.skills.map((skill) => `- ${skill}`).join('\n')
    : '未提供';

  return [
    '当前执行代理：',
    `代理名称：\n${agent.name}`,
    `代理角色：\n${agent.role}`,
    agent.description?.trim() ? `代理描述：\n${agent.description.trim()}` : '',
    `代理技能：\n${renderedSkills}`,
    '执行约束：\n你当前正在以该代理身份执行此工作流步骤。角色与技能属于硬性上下文，分析、实现、验证与输出措辞都必须体现该代理身份。若角色与步骤不完全匹配，仍然继续完成当前步骤，但必须在最终总结中明确说明匹配情况、偏差与风险。',
  ].filter(Boolean).join('\n\n');
}
```

- [ ] **Step 3: Insert the agent context block before the step instruction block**

Update the final prompt array so the order becomes:
1. 当前步骤
2. 原始需求标题
3. 原始需求内容
4. 上游步骤摘要（if any）
5. 代理身份区块
6. 本步骤要求
7. 输出总结约束

- [ ] **Step 4: Extend the final summary-only instructions without changing result parsing**

Replace the current ending:

```ts
'执行完成后，只输出最后结果总结。',
'总结中说明本步骤做了什么、是否修改了文件、以及主要结果。',
```

with wording that still keeps final-summary-only output but only instructs role alignment reporting, for example:

```ts
'执行完成后，只输出最后结果总结。',
'总结中说明本步骤做了什么、是否修改了文件、主要结果、与当前代理角色是否匹配；若不匹配，说明主要偏差与风险。',
```

Do not add output-schema enforcement in this task; `claudeStepResult.ts` still accepts free-form summary text.

- [ ] **Step 5: Re-run the direct prompt-assembler test command and verify it passes**

Run: `cd backend && node --import tsx --test test/workflowPromptAssembler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the prompt assembly implementation**

```bash
git add backend/src/services/workflow/workflowPromptAssembler.ts backend/test/workflowPromptAssembler.test.ts
git commit -m "feat: inject bound agent identity into workflow prompts"
```

## Task 3: Wire the resolved agent into step execution and prove mismatch remains non-blocking

**Files:**
- Modify: `backend/src/services/workflow/workflowStepExecutor.ts`
- Modify: `backend/test/workflowStepExecutor.test.ts`
- Reference: `backend/src/repositories/agentRepository.ts`

- [ ] **Step 1: Extend the step-executor test helper agent to include role metadata**

Update `createAgent(...)` in `backend/test/workflowStepExecutor.test.ts` to include:

```ts
return {
  id: 7,
  name: 'Codex Designer',
  role: 'ARCHITECT',
  description: 'Architecture design agent',
  executorType: 'CODEX',
  commandOverride: 'codex run',
  args: ['--json'],
  env: { MODE: 'strict' },
  skills: ['design'],
  enabled: true,
  ...overrides,
};
```

- [ ] **Step 2: Add a prompt assertion proving the executor sees the bound agent identity**

Inside the `registry.getExecutor(...).execute(...)` assertion block, add checks such as:

```ts
assert.match(prompt, /当前执行代理：/);
assert.match(prompt, /代理名称：\\nCodex Designer/);
assert.match(prompt, /代理角色：\\nARCHITECT/);
assert.match(prompt, /代理技能：\\n- design/);
```

- [ ] **Step 3: Add a mismatch scenario that still reaches executor invocation**

Create a second success-path test that intentionally mismatches the role and step, for example by using:
- step name/instruction for `测试`
- agent role `ARCHITECT`

In that test, assert all of the following:

```ts
assert.match(prompt, /角色与步骤不完全匹配时，仍然继续完成当前步骤/);
assert.match(prompt, /总结中说明与当前代理角色是否匹配/);
```

and still return a successful executor result to prove the workflow path remains non-blocking.

- [ ] **Step 4: Run the direct step-executor test command and verify it fails before wiring**

Run: `cd backend && node --import tsx --test test/workflowStepExecutor.test.ts`
Expected: FAIL because the generated prompt still lacks the agent identity section.

- [ ] **Step 5: Pass the resolved agent into `assembleWorkflowPrompt(...)`**

Update the existing call in `backend/src/services/workflow/workflowStepExecutor.ts` from:

```ts
const prompt = assembleWorkflowPrompt({
  step,
  state,
  inputData,
  upstreamStepIds,
});
```

to:

```ts
const prompt = assembleWorkflowPrompt({
  step,
  agent,
  state,
  inputData,
  upstreamStepIds,
});
```

Do not change executor config construction in this task.

- [ ] **Step 6: Re-run the direct step-executor test command and verify it passes**

Run: `cd backend && node --import tsx --test test/workflowStepExecutor.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the step wiring change**

```bash
git add backend/src/services/workflow/workflowStepExecutor.ts backend/test/workflowStepExecutor.test.ts
git commit -m "test: enforce agent identity wiring in workflow steps"
```

## Task 4: Run focused verification and prepare handoff

**Files:**
- Verify: `backend/src/services/workflow/workflowPromptAssembler.ts`
- Verify: `backend/src/services/workflow/workflowStepExecutor.ts`
- Verify: `backend/test/workflowPromptAssembler.test.ts`
- Verify: `backend/test/workflowStepExecutor.test.ts`

- [ ] **Step 1: Run the focused workflow prompt/step tests together**

Run: `cd backend && node --import tsx --test test/workflowPromptAssembler.test.ts test/workflowStepExecutor.test.ts`
Expected: PASS with both test files green.

- [ ] **Step 2: Run backend typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS with no TypeScript errors from the new prompt signature.

- [ ] **Step 3: Inspect the final diff for prompt wording and scope**

Confirm the diff only changes:
- prompt assembly content
- step executor prompt wiring
- focused backend tests

and does not alter executor launch flags, agent persistence, unrelated workflow behavior, or output-schema parsing.

- [ ] **Step 4: Commit the verification-ready state**

```bash
git add backend/src/services/workflow/workflowPromptAssembler.ts backend/src/services/workflow/workflowStepExecutor.ts backend/test/workflowPromptAssembler.test.ts backend/test/workflowStepExecutor.test.ts
git commit -m "feat: enforce workflow agent identity in step prompts"
```
