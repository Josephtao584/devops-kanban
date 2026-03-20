# Global Workflow Template Executors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single global workflow template config for the fixed four-step workflow so each step can choose its executor, and route step execution through a unified executor layer instead of hard-coded Claude-only logic.

**Architecture:** Keep the existing four-step workflow structure in `backend/src/workflows/index.js`, but replace the Claude-specific step entrypoint with a generic workflow step facade. Store one global template in JSON, resolve the current step's executor from that template, dispatch through an executor registry, and adapt executor-native output back into the existing `{ changedFiles, summary }` contract.

**Tech Stack:** Node.js, Fastify, Zod, JSON file repositories, node:test, child_process

---

## File Structure

### Create
- `backend/src/repositories/workflowTemplateRepository.js` - reads/writes the global workflow template JSON document
- `backend/src/services/workflowTemplateService.js` - validates template shape, applies defaults, exposes read/update operations
- `backend/src/routes/workflowTemplate.js` - `GET /api/workflow-template` and `PUT /api/workflow-template`
- `backend/src/services/agentExecutorRegistry.js` - maps executor type to concrete executor implementation
- `backend/src/services/executors/claudeCodeExecutor.js` - Claude Code executor implementation migrated from current Claude runner logic
- `backend/src/services/executors/codexExecutor.js` - first-pass Codex executor skeleton returning normalized native output shape
- `backend/src/services/executors/opencodeExecutor.js` - first-pass OpenCode executor skeleton returning normalized native output shape
- `backend/src/services/executors/commandResolver.js` - resolves default command, command overrides, args, and env into final spawn inputs
- `backend/src/services/stepResultAdapter.js` - converts executor-native output to `{ changedFiles, summary }`
- `backend/test/workflowTemplateService.test.js` - unit tests for template defaults and validation
- `backend/test/workflowTemplateRoutes.test.js` - route-level tests for template GET/PUT API
- `backend/test/agentExecutorRegistry.test.js` - registry resolution tests
- `backend/test/stepResultAdapter.test.js` - adapter tests for Claude/Codex/OpenCode native outputs
- `backend/test/commandResolver.test.js` - command/env/arg merge tests

### Modify
- `backend/src/workflows/index.js` - switch fixed steps from Claude-only entrypoint to generic workflow step execution
- `backend/src/services/workflowStepExecutor.js` - replace Claude wrapper with generic executor facade
- `backend/src/services/claudeStepRunner.js` - either reduce to Claude-specific helper internals or keep temporarily as migrated logic target for `claudeCodeExecutor`
- `backend/src/services/WorkflowService.js` - include template-derived executor snapshot in created run steps if needed, and ensure fixed step metadata stays aligned with template ids
- `backend/src/routes/workflows.js` - optionally expose executor snapshot in workflow responses if the implementation stores it on runs
- `backend/src/main.js` - register the new workflow template routes
- `backend/test/claudeStepRunner.test.js` - update tests to reflect new Claude executor command strategy if this file remains in use
- `backend/test/workflowStepExecutor.test.js` - change tests from Claude-only pass-through to generic template-driven dispatch

### Data
- Create: `data/workflow_template.json` - single global template document with default executor bindings for the four fixed steps

---

### Task 1: Add global workflow template persistence

**Files:**
- Create: `backend/src/repositories/workflowTemplateRepository.js`
- Test: `backend/test/workflowTemplateService.test.js`
- Data: `data/workflow_template.json`

- [ ] **Step 1: Write the failing repository/service test for default template loading**

```js
test('WorkflowTemplateService returns default fixed four-step template when no data exists', async () => {
  const repo = new WorkflowTemplateRepository({ filePath: tempFile });
  const service = new WorkflowTemplateService({ workflowTemplateRepo: repo });

  const template = await service.getTemplate();

  assert.equal(template.template_id, 'dev-workflow-v1');
  assert.deepEqual(template.steps.map((step) => step.id), [
    'requirement-design',
    'code-development',
    'testing',
    'code-review',
  ]);
  assert.deepEqual(template.steps.map((step) => step.executor.type), [
    'CLAUDE_CODE',
    'CLAUDE_CODE',
    'CLAUDE_CODE',
    'CLAUDE_CODE',
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateService.test.js`
Expected: FAIL because repository/service files do not exist yet.

- [ ] **Step 3: Implement repository for single-document template storage**

Write `workflowTemplateRepository.js` with a focused API:

```js
class WorkflowTemplateRepository {
  async get() {}
  async save(template) {}
}
```

Implementation notes:
- Use `STORAGE_PATH` from `backend/src/config/index.js`
- Store a single JSON object, not an array
- If file is missing, allow service layer to initialize defaults

- [ ] **Step 4: Implement service default-template builder**

Write minimal service logic that:
- returns a default four-step template when repository has no file
- persists the default on first read
- keeps fixed ids and names aligned with current workflow step definitions

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateService.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/repositories/workflowTemplateRepository.js backend/src/services/workflowTemplateService.js backend/test/workflowTemplateService.test.js data/workflow_template.json
git commit -m "feat: add global workflow template storage"
```

---

### Task 2: Validate template updates and reject invalid step/executor data

**Files:**
- Modify: `backend/src/services/workflowTemplateService.js`
- Test: `backend/test/workflowTemplateService.test.js`

- [ ] **Step 1: Write the failing validation tests**

```js
test('WorkflowTemplateService rejects templates with non-fixed step ids', async () => {
  await assert.rejects(() => service.updateTemplate({
    template_id: 'dev-workflow-v1',
    name: 'x',
    steps: [{ id: 'custom-step', name: '自定义', executor: { type: 'CLAUDE_CODE', args: [], env: {} } }],
  }), /Invalid workflow template step ids/);
});

test('WorkflowTemplateService rejects unsupported executor types', async () => {
  const template = buildValidTemplate();
  template.steps[1].executor.type = 'UNKNOWN';
  await assert.rejects(() => service.updateTemplate(template), /Unsupported executor type/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateService.test.js`
Expected: FAIL with missing validation.

- [ ] **Step 3: Implement strict validation rules**

Minimal rules only:
- `template_id` must be `dev-workflow-v1`
- `steps` must contain exactly the four fixed ids in fixed order
- each `executor.type` must be one of `CLAUDE_CODE`, `CODEX`, `OPENCODE`
- `commandOverride` if present must be non-empty string
- `args` must be string array
- `env` must be string:string object

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowTemplateService.js backend/test/workflowTemplateService.test.js
git commit -m "feat: validate global workflow template updates"
```

---

### Task 3: Expose the global template over API

**Files:**
- Create: `backend/src/routes/workflowTemplate.js`
- Modify: `backend/src/main.js:78-90`
- Test: `backend/test/workflowTemplateRoutes.test.js`

- [ ] **Step 1: Write the failing route tests**

```js
test('GET /api/workflow-template returns the global template', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/workflow-template' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().success, true);
  assert.equal(response.json().data.template_id, 'dev-workflow-v1');
});

test('PUT /api/workflow-template updates step executor bindings', async () => {
  const payload = buildValidTemplate();
  payload.steps[1].executor.type = 'CODEX';

  const response = await app.inject({ method: 'PUT', url: '/api/workflow-template', payload });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.steps[1].executor.type, 'CODEX');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateRoutes.test.js`
Expected: FAIL because route is not registered.

- [ ] **Step 3: Implement the route handlers**

Add:
- `GET /api/workflow-template`
- `PUT /api/workflow-template`

Use existing `successResponse` / `errorResponse` helpers and keep logic in the service.

- [ ] **Step 4: Register the route in main.js**

Add the import and register line next to existing API route registrations.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateRoutes.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/workflowTemplate.js backend/src/main.js backend/test/workflowTemplateRoutes.test.js
git commit -m "feat: add workflow template API"
```

---

### Task 4: Add executor registry and native-result adapter

**Files:**
- Create: `backend/src/services/agentExecutorRegistry.js`
- Create: `backend/src/services/stepResultAdapter.js`
- Create: `backend/test/agentExecutorRegistry.test.js`
- Create: `backend/test/stepResultAdapter.test.js`

- [ ] **Step 1: Write the failing registry and adapter tests**

```js
test('AgentExecutorRegistry resolves CLAUDE_CODE, CODEX, and OPENCODE executors', () => {
  const registry = new AgentExecutorRegistry();
  assert.ok(registry.getExecutor('CLAUDE_CODE'));
  assert.ok(registry.getExecutor('CODEX'));
  assert.ok(registry.getExecutor('OPENCODE'));
});

test('stepResultAdapter converts Claude native output into workflow step result', () => {
  const result = adaptStepResult('CLAUDE_CODE', {
    rawResult: { changedFiles: ['docs/design.md'], summary: 'done' },
  });
  assert.deepEqual(result, { changedFiles: ['docs/design.md'], summary: 'done' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/agentExecutorRegistry.test.js test/stepResultAdapter.test.js`
Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement the minimal registry**

Map executor types to concrete instances. Keep it simple and synchronous.

- [ ] **Step 4: Implement the minimal adapter**

Support these native input shapes:
- Claude: `rawResult` already matches `{ changedFiles, summary }`
- Codex/OpenCode: allow the same minimal raw shape in first pass

Do not over-generalize yet.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/agentExecutorRegistry.test.js test/stepResultAdapter.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/agentExecutorRegistry.js backend/src/services/stepResultAdapter.js backend/test/agentExecutorRegistry.test.js backend/test/stepResultAdapter.test.js
git commit -m "feat: add executor registry and step result adapter"
```

---

### Task 5: Add command resolution for configurable executor launching

**Files:**
- Create: `backend/src/services/executors/commandResolver.js`
- Create: `backend/test/commandResolver.test.js`

- [ ] **Step 1: Write the failing command resolver tests**

```js
test('resolveCommand uses executor default command when no override is set', () => {
  assert.deepEqual(resolveCommand({
    defaultCommand: ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'],
    executorConfig: { commandOverride: null, args: [], env: {} },
    processEnv: { PATH: 'x' },
  }), {
    command: 'npx',
    args: ['-y', '@anthropic-ai/claude-code@2.1.62'],
    env: { PATH: 'x' },
  });
});

test('resolveCommand merges command override args and env', () => {
  const resolved = resolveCommand({
    defaultCommand: ['npx', '-y', '@anthropic-ai/claude-code@2.1.62'],
    executorConfig: {
      commandOverride: 'node custom-cli.js',
      args: ['--foo'],
      env: { DEBUG: '1' },
    },
    processEnv: { PATH: 'x' },
  });

  assert.equal(resolved.command, 'node');
  assert.deepEqual(resolved.args, ['custom-cli.js', '--foo']);
  assert.equal(resolved.env.DEBUG, '1');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/commandResolver.test.js`
Expected: FAIL because resolver does not exist.

- [ ] **Step 3: Implement minimal command resolver**

Behavior:
- accept a default command array
- optionally parse `commandOverride` into command + initial args
- append `executorConfig.args`
- merge `process.env` with `executorConfig.env`
- do not use `shell: true`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/commandResolver.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/executors/commandResolver.js backend/test/commandResolver.test.js
git commit -m "feat: add executor command resolver"
```

---

### Task 6: Migrate Claude into a real executor implementation

**Files:**
- Create: `backend/src/services/executors/claudeCodeExecutor.js`
- Modify: `backend/src/services/claudeStepRunner.js`
- Modify: `backend/test/claudeStepRunner.test.js`

- [ ] **Step 1: Write the failing Claude executor test**

```js
test('ClaudeCodeExecutor builds npx-based command and returns native result shell', async () => {
  const executor = new ClaudeCodeExecutor({ spawnImpl: fakeSpawnImpl });

  const result = await executor.execute({
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '输出设计文档',
    previousSummary: '',
    executorConfig: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.rawResult, {
    changedFiles: ['docs/design.md'],
    summary: 'ok',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/claudeStepRunner.test.js`
Expected: FAIL because executor class does not exist and tests still reflect old command assumptions.

- [ ] **Step 3: Implement the Claude executor with minimal migration**

Implementation notes:
- reuse current prompt/result parsing logic where practical
- move launch concerns behind the new command resolver
- set Claude default command to `['npx', '-y', '@anthropic-ai/claude-code@2.1.62']`
- keep `-p`, `--dangerously-skip-permissions`, and existing result-file protocol for first pass
- remove reliance on `shell: true`

- [ ] **Step 4: Update tests to the new command model**

Update expectations so tests verify:
- command comes from resolver output
- Claude does not rely on bare `claude`
- spawn uses arg arrays rather than shell-joined prompt strings

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/claudeStepRunner.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/executors/claudeCodeExecutor.js backend/src/services/claudeStepRunner.js backend/test/claudeStepRunner.test.js
git commit -m "feat: move Claude launch into executor abstraction"
```

---

### Task 7: Add Codex and OpenCode executor skeletons

**Files:**
- Create: `backend/src/services/executors/codexExecutor.js`
- Create: `backend/src/services/executors/opencodeExecutor.js`
- Modify: `backend/test/agentExecutorRegistry.test.js`
- Modify: `backend/test/stepResultAdapter.test.js`

- [ ] **Step 1: Write the failing skeleton executor tests**

```js
test('CodexExecutor returns native raw result shape for adapter consumption', async () => {
  const executor = new CodexExecutor({ runImpl: async () => ({ changedFiles: ['a.js'], summary: 'done' }) });
  const result = await executor.execute(validInput);
  assert.deepEqual(result.rawResult, { changedFiles: ['a.js'], summary: 'done' });
});

test('OpenCodeExecutor returns native raw result shape for adapter consumption', async () => {
  const executor = new OpenCodeExecutor({ runImpl: async () => ({ changedFiles: ['b.js'], summary: 'done' }) });
  const result = await executor.execute(validInput);
  assert.deepEqual(result.rawResult, { changedFiles: ['b.js'], summary: 'done' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/agentExecutorRegistry.test.js test/stepResultAdapter.test.js`
Expected: FAIL because skeleton executors do not exist.

- [ ] **Step 3: Implement minimal skeleton executors**

Do not overbuild. First pass only needs:
- a constructor with injectable execution function for tests
- `execute(...)` returning the native result shell expected by the adapter
- clear `not implemented` fallback when not injected

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/agentExecutorRegistry.test.js test/stepResultAdapter.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/executors/codexExecutor.js backend/src/services/executors/opencodeExecutor.js backend/test/agentExecutorRegistry.test.js backend/test/stepResultAdapter.test.js
git commit -m "feat: add Codex and OpenCode executor skeletons"
```

---

### Task 8: Route workflow steps through the global template and executor registry

**Files:**
- Modify: `backend/src/services/workflowStepExecutor.js`
- Modify: `backend/src/workflows/index.js`
- Test: `backend/test/workflowStepExecutor.test.js`

- [ ] **Step 1: Write the failing workflow step dispatch tests**

```js
test('executeWorkflowStep selects executor from global template for the current step', async () => {
  const templateService = {
    getTemplate: async () => ({
      template_id: 'dev-workflow-v1',
      steps: [
        { id: 'requirement-design', executor: { type: 'CODEX', args: [], env: {} } },
        { id: 'code-development', executor: { type: 'CLAUDE_CODE', args: [], env: {} } },
        { id: 'testing', executor: { type: 'CLAUDE_CODE', args: [], env: {} } },
        { id: 'code-review', executor: { type: 'CLAUDE_CODE', args: [], env: {} } },
      ],
    }),
  };

  const registry = {
    getExecutor(type) {
      assert.equal(type, 'CODEX');
      return { execute: async () => ({ rawResult: { changedFiles: ['x'], summary: 'ok' } }) };
    },
  };

  const result = await executeWorkflowStep({
    templateService,
    registry,
    stepId: 'requirement-design',
    worktreePath: '/tmp/worktree',
    taskTitle: '测试任务',
    taskDescription: '测试描述',
  });

  assert.deepEqual(result, { changedFiles: ['x'], summary: 'ok' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowStepExecutor.test.js`
Expected: FAIL because the executor facade is still Claude-only.

- [ ] **Step 3: Rewrite workflowStepExecutor as a generic facade**

Minimal behavior:
- load template
- find current step config by `stepId`
- resolve executor from registry
- call executor `execute(...)`
- adapt result through `stepResultAdapter`
- continue exposing `context.proc` when executor provides a spawned process

- [ ] **Step 4: Update workflow steps to call the new generic facade**

Replace `executeClaudeWorkflowStep(...)` in `backend/src/workflows/index.js` with the generic entrypoint while preserving the fixed step definitions and current worktree-path behavior.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowStepExecutor.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/workflowStepExecutor.js backend/src/workflows/index.js backend/test/workflowStepExecutor.test.js
git commit -m "feat: route workflow steps through template executors"
```

---

### Task 9: Verify run-time integration with workflow runs and template API

**Files:**
- Modify: `backend/src/services/WorkflowService.js`
- Modify: `backend/src/routes/workflows.js` (only if response shape needs to surface executor metadata)
- Test: `backend/test/workflowService.test.js`
- Test: `backend/test/workflowTemplateRoutes.test.js`

- [ ] **Step 1: Write the failing integration tests**

```js
test('WorkflowService creates run steps aligned with the fixed template step ids', async () => {
  const run = await service.startWorkflow(1);
  assert.deepEqual(run.steps.map((step) => step.step_id), [
    'requirement-design',
    'code-development',
    'testing',
    'code-review',
  ]);
});

test('updated workflow template is returned on subsequent GET requests', async () => {
  await app.inject({ method: 'PUT', url: '/api/workflow-template', payload: updatedTemplate });
  const response = await app.inject({ method: 'GET', url: '/api/workflow-template' });
  assert.equal(response.json().data.steps[1].executor.type, 'CODEX');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowService.test.js test/workflowTemplateRoutes.test.js`
Expected: FAIL if service assumptions or route persistence are incomplete.

- [ ] **Step 3: Implement the minimal service adjustments**

Only add what is necessary:
- ensure `WorkflowService` fixed step ids remain the source of created run steps
- if useful, snapshot the resolved executor type into each run step's metadata without changing workflow semantics
- do not broaden scope beyond executor visibility and consistency

- [ ] **Step 4: Run targeted integration tests**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowService.test.js test/workflowTemplateRoutes.test.js`
Expected: PASS

- [ ] **Step 5: Run the relevant full backend test set**

Run: `cd "D:/workspace/devops-kanban/backend" && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/WorkflowService.js backend/src/routes/workflows.js backend/test/workflowService.test.js backend/test/workflowTemplateRoutes.test.js
git commit -m "feat: integrate workflow template executors into runs"
```

---

### Task 10: Final verification and cleanup

**Files:**
- Review only: all files touched above

- [ ] **Step 1: Run focused tests for the new feature set**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && npm test -- test/workflowTemplateService.test.js test/workflowTemplateRoutes.test.js test/agentExecutorRegistry.test.js test/stepResultAdapter.test.js test/commandResolver.test.js test/workflowStepExecutor.test.js test/workflowService.test.js test/claudeStepRunner.test.js
```
Expected: PASS

- [ ] **Step 2: Run full backend tests**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && npm test
```
Expected: PASS

- [ ] **Step 3: Manually exercise the template API**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node src/main.js
```
Then verify:
- `GET /api/workflow-template` returns the default template
- `PUT /api/workflow-template` can switch `code-development` to `CODEX`
- starting a workflow still creates a run successfully

- [ ] **Step 4: Inspect stored JSON output**

Verify `data/workflow_template.json` matches the updated template and keeps the fixed four-step shape.

- [ ] **Step 5: Commit final cleanup if needed**

```bash
git add <specific files>
git commit -m "test: verify workflow template executor integration"
```

---

## Notes for the Implementer

- Keep the workflow template fixed. Do not add configurable step ordering or custom step creation in this plan.
- Keep the step result contract unchanged: `{ changedFiles, summary }`.
- Do not build a full profile/variant/discovery system yet.
- Prefer the smallest working abstraction: registry + executor implementations + adapter.
- Preserve current worktree-path resolution behavior from `backend/src/services/WorkflowService.js` and `backend/src/workflows/index.js`.
- When migrating Claude command launching, prioritize arg-array spawning and avoid `shell: true`.
- For Codex/OpenCode in this plan, skeleton executors are enough as long as the workflow layer can select them and adapt their native output.
