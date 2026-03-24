# Workflow Step Agent Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace workflow step-level executor config with per-step `agentId` bindings, and make agent records the single source of executor launch configuration.

**Architecture:** This is a one-shot development-stage schema change with no migration layer. Backend DTO/entity/template shapes move directly from `step.executor` and `agent.type` to `step.agentId` and `agent.executorType`, workflow startup adds strict preflight validation, and step execution resolves executor settings from the bound agent. Frontend updates the agent editor and workflow template editor in the same change set so API/UI contracts stay aligned.

**Tech Stack:** Fastify 4, TypeScript, Node test runner, Vue 3, Pinia, Element Plus

---

## File Map

### Backend files to modify
- `backend/src/types/dto/agents.ts` — change agent request DTOs to runtime-config shape
- `backend/src/repositories/agentRepository.ts` — align persisted agent entity fields with new DTO shape
- `backend/src/routes/agents.ts` — validate bad agent payloads as 4xx instead of storing invalid runtime config
- `backend/src/types/dto/workflowTemplates.ts` — replace step `executor` input with `agentId`
- `backend/src/types/entities.ts` — update `WorkflowTemplateEntity` shape from `executor` to `agentId`
- `backend/src/services/workflow/workflowTemplateService.ts` — remove executor defaults, validate `agentId`, emit new template shape
- `backend/src/services/workflow/workflowStepExecutor.ts` — resolve step agent and build executor config from agent
- `backend/src/services/workflow/workflowService.ts` — add startup preflight validation for step-agent bindings
- `backend/src/types/executors.ts` — tighten executor config typing around agent-derived config if needed
- `data-sample/workflow_template.json` — update sample template to `agentId`

### Backend tests to modify/add
- `backend/test/workflowTemplateService.test.ts` — update template tests to `agentId`
- `backend/test/workflowTemplateRoutes.test.ts` — update route payload assertions to `agentId`
- `backend/test/contracts/workflowTemplateDtoTypes.test.ts` — update DTO contract test to new shape
- `backend/test/contracts/managementRouteInputTypes.test.ts` — update existing agent DTO contract assertions from `type` to `executorType`
- `backend/test/workflowStepExecutor.test.ts` — update step execution test to resolve from bound agent, include step-time invalid-agent failure coverage
- `backend/test/workflowService.test.ts` — add startup validation coverage for missing/disabled/invalid agents and the all-valid success case
- `backend/test/contracts/agentDtoTypes.test.ts` — create if needed to lock new agent DTO shape
- `backend/test/agentRoutes.test.ts` — create focused route tests for 400 validation errors on invalid create/update payloads

### Frontend files to modify
- `frontend/src/views/WorkflowTemplateConfig.vue` — replace executor selector with agent selector per step
- `frontend/src/views/AgentConfig.vue` — replace `type` editing/display with `executorType` plus runtime config editors
- `frontend/src/components/AgentSelector.vue` — switch display/icon logic from `type` to `executorType`
- `frontend/src/components/TaskDetail.vue` — switch task dialog agent labels from `type` to `executorType`
- `frontend/src/stores/agentStore.js` — rename grouping logic from `type` to `executorType`
- `frontend/src/api/agent.js` — keep endpoints, but update payload expectations through consumers
- `frontend/src/api/workflowTemplate.js` — keep endpoints, but update payload expectations through consumers
- any other frontend component reading `agent.type` — switch to `agent.executorType`

### Frontend tests to add
- `frontend/tests/WorkflowTemplateConfig.spec.js` — verify step agent selection payload shape and missing/disabled binding rendering
- `frontend/tests/AgentConfig.spec.js` — verify agent form submission with `executorType`, `commandOverride`, `args`, and `env`

### Sample data to modify
- `data-sample/agents.json` — update sample agent records to `executorType`, `commandOverride`, `args`, and `env`

### Task 1: Convert workflow template contracts from `executor` to `agentId`

**Files:**
- Modify: `backend/src/types/dto/workflowTemplates.ts`
- Modify: `backend/src/types/entities.ts`
- Modify: `backend/src/services/workflow/workflowTemplateService.ts`
- Modify: `data-sample/workflow_template.json`
- Test: `backend/test/contracts/workflowTemplateDtoTypes.test.ts`
- Test: `backend/test/workflowTemplateService.test.ts`
- Test: `backend/test/workflowTemplateRoutes.test.ts`

- [ ] **Step 1: Rewrite the workflow template DTO contract test to use `agentId`**

```ts
const payload: UpdateWorkflowTemplateInput = {
  template_id: 'dev-workflow-v1',
  name: '默认研发工作流',
  steps: [
    {
      id: 'requirement-design',
      name: '需求设计',
      instructionPrompt: '先完成需求分析。',
      agentId: 1,
    },
  ],
};
```

- [ ] **Step 2: Run the DTO contract test and verify it fails on the old shape**

Run: `cd backend && npm test -- test/contracts/workflowTemplateDtoTypes.test.ts`
Expected: FAIL because `executor` is still required and `agentId` is not part of the DTO yet.

- [ ] **Step 3: Update workflow template DTO/entity types to the new shape**

Implement minimal contract changes:

```ts
export interface WorkflowTemplateStepInput {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
}
```

And in `entities.ts`:

```ts
steps: Array<{
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number | null;
}>;
```

- [ ] **Step 4: Update `WorkflowTemplateService` defaults and validation**

Make the default template produce:

```ts
{
  id: fixedStep.id,
  name: fixedStep.name,
  instructionPrompt: fixedStep.instructionPrompt,
  agentId: null,
}
```

Validation should reject non-number/non-null `agentId` and stop validating `executor.*` entirely.

- [ ] **Step 5: Update the sample template file to the new schema**

Use this shape per step:

```json
{
  "id": "requirement-design",
  "name": "需求设计",
  "instructionPrompt": "先完成需求分析，整理实现思路、关键约束和交付方案。将需求设计实现文档写入到docs文件夹中",
  "agentId": null
}
```

- [ ] **Step 6: Update template service and route tests to the new shape**

Replace old assertions such as:

```ts
assert.equal(updated.steps[1]!.executor.type, 'CODEX');
```

with:

```ts
assert.equal(updated.steps[1]!.agentId, 2);
```

Also add a service-level invalid case:

```ts
await assert.rejects(
  () => service.updateTemplate({ ...template, steps: [{ ...template.steps[0]!, agentId: 'x' as never }] }),
  /agentId must be a number or null/
);
```

- [ ] **Step 7: Run the focused template test suite and verify it passes**

Run: `cd backend && npm test -- test/contracts/workflowTemplateDtoTypes.test.ts test/workflowTemplateService.test.ts test/workflowTemplateRoutes.test.ts`
Expected: PASS

- [ ] **Step 8: Commit the template contract change**

```bash
git add backend/src/types/dto/workflowTemplates.ts backend/src/types/entities.ts backend/src/services/workflow/workflowTemplateService.ts data-sample/workflow_template.json backend/test/contracts/workflowTemplateDtoTypes.test.ts backend/test/workflowTemplateService.test.ts backend/test/workflowTemplateRoutes.test.ts
git commit -m "refactor: bind workflow template steps to agents"
```

### Task 2: Convert agent contracts to executor-owned runtime config

**Files:**
- Modify: `backend/src/types/dto/agents.ts`
- Modify: `backend/src/repositories/agentRepository.ts`
- Modify: `backend/src/routes/agents.ts`
- Modify: `data-sample/agents.json`
- Test: `backend/test/contracts/agentDtoTypes.test.ts`
- Test: `backend/test/contracts/managementRouteInputTypes.test.ts`
- Test: `backend/test/agentRoutes.test.ts`

- [ ] **Step 1: Add a failing agent DTO contract test for the new shape**

Create `backend/test/contracts/agentDtoTypes.test.ts` with:

```ts
const payload: CreateAgentBody = {
  name: 'Claude Dev',
  executorType: 'CLAUDE_CODE',
  role: 'BACKEND_DEV',
  description: 'Backend coding agent',
  enabled: true,
  skills: ['api', 'fastify'],
  commandOverride: null,
  args: ['--dangerously-skip-permissions'],
  env: { CI: 'true' },
};
```

- [ ] **Step 2: Add failing route tests for invalid agent create/update payloads**

Create `backend/test/agentRoutes.test.ts` with focused invalid cases such as:

```ts
await assert.equal(createResponse.statusCode, 400);
await assert.match(createResponse.json().message, /Unsupported executor type/);
await assert.equal(updateResponse.statusCode, 400);
await assert.match(updateResponse.json().message, /args must be an array of strings/);
```

Also assert the repository create/update stub is not called for invalid payloads.

- [ ] **Step 3: Update existing management-route DTO assertions and sample agent data**

Rewrite `backend/test/contracts/managementRouteInputTypes.test.ts` from:

```ts
const createAgentBody: CreateAgentBody = {
  name: 'Backend Developer - Alice',
  type: 'CLAUDE',
  role: 'BACKEND_DEV',
  description: 'Backend implementation specialist',
  enabled: true,
  skills: ['TypeScript', 'Fastify'],
};
```

to:

```ts
const createAgentBody: CreateAgentBody = {
  name: 'Backend Developer - Alice',
  executorType: 'CLAUDE_CODE',
  role: 'BACKEND_DEV',
  description: 'Backend implementation specialist',
  enabled: true,
  skills: ['TypeScript', 'Fastify'],
  commandOverride: null,
  args: [],
  env: {},
};
```

Also update `data-sample/agents.json` to store `executorType`, `commandOverride`, `args`, and `env` instead of legacy `type`-only records.
- [ ] **Step 4: Run the focused agent contract tests and verify they fail**

Run: `cd backend && npm test -- test/contracts/agentDtoTypes.test.ts test/contracts/managementRouteInputTypes.test.ts test/agentRoutes.test.ts`
Expected: FAIL because the DTO still expects `type` and the route still returns 500 or persists invalid payloads.

- [ ] **Step 5: Update agent DTOs and repository entity**

Use the minimal target shape:

```ts
export interface CreateAgentBody {
  name: string;
  executorType: 'CLAUDE_CODE' | 'CODEX' | 'OPENCODE';
  role: string;
  description?: string;
  enabled: boolean;
  skills: string[];
  commandOverride?: string | null;
  args: string[];
  env: Record<string, string>;
}
```

And in `AgentEntity`:

```ts
executorType: string;
commandOverride?: string | null;
args: string[];
env: Record<string, string>;
```

- [ ] **Step 6: Add request validation in `routes/agents.ts`**

Implement a minimal validator helper that rejects:
- unsupported `executorType`
- blank `commandOverride`
- non-array `args`
- non-string env values

And return 400 with the thrown message instead of 500 for validation failures.

- [ ] **Step 7: Run the focused agent contract tests and verify they pass**

Run: `cd backend && npm test -- test/contracts/agentDtoTypes.test.ts test/contracts/managementRouteInputTypes.test.ts test/agentRoutes.test.ts`
Expected: PASS

- [ ] **Step 8: Commit the agent contract change**

```bash
git add backend/src/types/dto/agents.ts backend/src/repositories/agentRepository.ts backend/src/routes/agents.ts backend/test/contracts/agentDtoTypes.test.ts backend/test/contracts/managementRouteInputTypes.test.ts backend/test/agentRoutes.test.ts data-sample/agents.json
git commit -m "refactor: move executor config onto agents"
```

### Task 3: Resolve workflow step execution from bound agents

**Files:**
- Modify: `backend/src/services/workflow/workflowStepExecutor.ts`
- Modify: `backend/src/types/executors.ts`
- Test: `backend/test/workflowStepExecutor.test.ts`

- [ ] **Step 1: Rewrite the step executor test to require agent lookup**

Replace the old template-driven executor assertion with a success-path test like:

```ts
const templateService = {
  async getTemplate() {
    return {
      template_id: 'dev-workflow-v1',
      steps: [{ id: 'requirement-design', name: '需求设计', instructionPrompt: '先完成需求分析。', agentId: 7 }],
    };
  },
};

const agentRepo = {
  async findById(id: number) {
    assert.equal(id, 7);
    return {
      id: 7,
      executorType: 'CODEX',
      commandOverride: 'codex run',
      args: ['--json'],
      env: { MODE: 'strict' },
      skills: ['design'],
      enabled: true,
    };
  },
};
```

- [ ] **Step 2: Add a failing step-time invalid-agent test**

Add a second test that proves non-frozen runs still fail correctly if a step resolves an invalid agent at execution time:

```ts
await assert.rejects(
  () => executeWorkflowStep({ ...input, agentRepo: { async findById() { return { id: 7, enabled: false, executorType: 'CODEX', args: [], env: {}, skills: [] }; } } as never }),
  /is disabled/
);
```

Use one invalid case at step time: disabled, missing, or invalid config.

- [ ] **Step 3: Run the focused workflow step executor test and verify it fails**

Run: `cd backend && npm test -- test/workflowStepExecutor.test.ts`
Expected: FAIL because `executeWorkflowStep` still reads `step.executor` and has no agent repository dependency or step-time validation.

- [ ] **Step 4: Add minimal agent resolution and validation support to `executeWorkflowStep`**

Extend the input shape with `agentRepo`, then implement:

```ts
const agent = await agentRepo.findById(step.agentId);
if (!agent || !agent.enabled) throw new Error(...);
const executor = registry.getExecutor(agent.executorType as ExecutorType);
const execution = await executor.execute({
  prompt,
  worktreePath,
  executorConfig: {
    type: agent.executorType,
    commandOverride: agent.commandOverride ?? null,
    args: agent.args ?? [],
    env: agent.env ?? {},
    skills: agent.skills ?? [],
  },
  onSpawn,
});
```

- [ ] **Step 5: Extend `ExecutorConfig` so skills are explicit executor input**

```ts
export interface ExecutorConfig {
  type: ExecutorType;
  commandOverride?: string | null;
  args?: string[];
  env?: Record<string, string>;
  skills?: string[];
}
```

- [ ] **Step 6: Run the focused step executor test and verify it passes**

Run: `cd backend && npm test -- test/workflowStepExecutor.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the step execution refactor**

```bash
git add backend/src/services/workflow/workflowStepExecutor.ts backend/src/types/executors.ts backend/test/workflowStepExecutor.test.ts
git commit -m "refactor: resolve workflow executors from agents"
```

### Task 4: Add workflow startup preflight validation for step-agent bindings

**Files:**
- Modify: `backend/src/services/workflow/workflowService.ts`
- Test: `backend/test/workflowService.test.ts`

- [ ] **Step 1: Add a failing workflow startup success-path test for all-valid agents**

Add a test that stubs a task, project path, template, and four enabled agents, then asserts:

```ts
const run = await service.startWorkflow(1);
assert.equal(run.status, 'PENDING');
```

Also assert the workflow run repository `create` stub is reached only when every step agent is valid.

- [ ] **Step 2: Add a failing workflow startup test for a missing step agent**

Add a test like:

```ts
await assert.rejects(
  () => service.startWorkflow(1),
  /Step "需求设计" has no agent assigned/
);
```

Stub:
- task repo returns a task
- project repo returns a valid local path
- workflow template service returns first step with `agentId: null`

- [ ] **Step 3: Add failing startup tests for missing, disabled, and invalid agents**

Examples:

```ts
await assert.rejects(() => service.startWorkflow(1), /not found/);
await assert.rejects(() => service.startWorkflow(1), /is disabled/);
await assert.rejects(() => service.startWorkflow(1), /invalid executor configuration/);
```

- [ ] **Step 4: Run the focused workflow service test and verify it fails**

Run: `cd backend && npm test -- test/workflowService.test.ts`
Expected: FAIL because `startWorkflow` does not yet load or validate template-bound agents.

- [ ] **Step 5: Implement minimal preflight validation in `WorkflowService`**

Add helper methods similar to:

```ts
async _loadTemplate() { ... }
async _validateTemplateAgents(template) { ... }
```

Validation rules:
- `agentId` is present for every step
- agent exists
- agent is enabled
- `executorType` is supported
- `args` is an array
- `env` is a string map

Call validation before `workflowRunRepo.create(...)`.

- [ ] **Step 6: Run the focused workflow service test and verify it passes**

Run: `cd backend && npm test -- test/workflowService.test.ts`
Expected: PASS

- [ ] **Step 7: Commit the startup validation change**

```bash
git add backend/src/services/workflow/workflowService.ts backend/test/workflowService.test.ts
git commit -m "feat: validate workflow step agents before startup"
```

### Task 5: Update frontend workflow template editing to select agents per step

**Files:**
- Modify: `frontend/src/views/WorkflowTemplateConfig.vue`
- Modify: `frontend/src/api/workflowTemplate.js`
- Test: `frontend/tests/WorkflowTemplateConfig.spec.js`

- [ ] **Step 1: Add a failing frontend test for step agent selection payload shape**

Write a vitest component test that mounts the page, edits a step binding, triggers save, and asserts the saved payload contains:

```js
{
  steps: [{ id: 'requirement-design', agentId: 3 }]
}
```

and does not contain `executor.type`.

- [ ] **Step 2: Add a failing frontend test for disabled/missing binding rendering**

Add assertions for:
- disabled agent option is visibly marked
- current `agentId` not present in the agent list renders `Missing agent (#id)`

- [ ] **Step 3: Run the workflow template frontend test and verify it fails**

Run: `cd frontend && npm run test:run -- tests/WorkflowTemplateConfig.spec.js`
Expected: FAIL because the page still edits `executor.type` and does not render missing-agent state.

- [ ] **Step 4: Replace the executor selector UI with an agent selector**

Change the table column from:

```vue
<el-select v-model="scope.row.executor.type">
```

to something like:

```vue
<el-select v-model="scope.row.agentId" clearable>
  <el-option
    v-for="agent in agents"
    :key="agent.id"
    :label="formatAgentOption(agent)"
    :value="agent.id"
  />
</el-select>
```

- [ ] **Step 5: Load agents for the workflow template page and render missing/disabled states**

Use the existing agent API and keep it minimal:

```js
import { getAgents } from '../api/agent'
const agents = ref([])
agents.value = response.data || []
```

And render:

```vue
<el-tag type="danger">Missing agent (#{{ scope.row.agentId }})</el-tag>
```

for missing bindings.

- [ ] **Step 6: Run the workflow template frontend test and verify it passes**

Run: `cd frontend && npm run test:run -- tests/WorkflowTemplateConfig.spec.js`
Expected: PASS

- [ ] **Step 7: Commit the workflow template UI change**

```bash
git add frontend/src/views/WorkflowTemplateConfig.vue frontend/src/api/workflowTemplate.js frontend/tests/WorkflowTemplateConfig.spec.js
git commit -m "feat: bind workflow steps to agents in template UI"
```

### Task 6: Update frontend agent management to edit executor runtime config

**Files:**
- Modify: `frontend/src/views/AgentConfig.vue`
- Modify: `frontend/src/components/AgentSelector.vue`
- Modify: `frontend/src/components/TaskDetail.vue`
- Modify: `frontend/src/stores/agentStore.js`
- Modify: any other frontend component reading `agent.type`
- Test: `frontend/tests/AgentConfig.spec.js`

- [ ] **Step 1: Add a failing frontend test for the new agent form payload**

Write a vitest component test that submits the agent form and asserts the payload includes:

```js
{
  executorType: 'CLAUDE_CODE',
  commandOverride: null,
  args: ['--json'],
  env: { CI: 'true' },
}
```

and not `type`.

- [ ] **Step 2: Run the agent config frontend test and verify it fails**

Run: `cd frontend && npm run test:run -- tests/AgentConfig.spec.js`
Expected: FAIL because the form still uses `type` and has no runtime config editors.

- [ ] **Step 3: Replace `type` form fields and display fields with `executorType`**

Examples:

```vue
<select v-model="form.executorType" required>
  <option value="CLAUDE_CODE">Claude Code</option>
  <option value="CODEX">Codex</option>
  <option value="OPENCODE">OpenCode</option>
</select>
```

And display:

```vue
<span class="info-value">{{ selectedAgent.executorType }}</span>
```

- [ ] **Step 4: Add minimal editors for `commandOverride`, `args`, and `env`**

Keep them simple:
- `commandOverride`: plain text input
- `args`: comma-separated string or small repeatable list
- `env`: key/value rows

Prefer the smallest UI that preserves correctness over a large component abstraction.

- [ ] **Step 5: Update selector/store/detail logic to use `executorType`**

Examples:

```js
const type = agent.executorType || 'UNKNOWN'
```

and in selector icon logic:

```js
const icons = {
  CLAUDE_CODE: Monitor,
  CODEX: Cpu,
  OPENCODE: Connection,
}
```

Also update `frontend/src/components/TaskDetail.vue` labels from:

```vue
:label="`${agent.name} (${agent.type})`"
```

to:

```vue
:label="`${agent.name} (${agent.executorType})`"
```

- [ ] **Step 6: Run the agent config frontend test and verify it passes**

Run: `cd frontend && npm run test:run -- tests/AgentConfig.spec.js`
Expected: PASS

- [ ] **Step 7: Commit the agent UI change**

```bash
git add frontend/src/views/AgentConfig.vue frontend/src/components/AgentSelector.vue frontend/src/components/TaskDetail.vue frontend/src/stores/agentStore.js frontend/tests/AgentConfig.spec.js
git commit -m "feat: edit agent executor config in frontend"
```

### Task 7: Run end-to-end verification for the new contracts

**Files:**
- Verify all modified backend/frontend files from Tasks 1-6

- [ ] **Step 1: Run the focused backend test suite**

Run: `cd backend && npm test -- test/contracts/workflowTemplateDtoTypes.test.ts test/contracts/agentDtoTypes.test.ts test/agentRoutes.test.ts test/workflowTemplateService.test.ts test/workflowTemplateRoutes.test.ts test/workflowStepExecutor.test.ts test/workflowService.test.ts`
Expected: PASS

- [ ] **Step 2: Run backend type checking**

Run: `cd backend && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run the focused frontend test suite**

Run: `cd frontend && npm run test:run -- tests/WorkflowTemplateConfig.spec.js tests/AgentConfig.spec.js`
Expected: PASS

- [ ] **Step 4: Run frontend build verification**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Manually verify the core flow**

Manual flow:
1. create or edit agents so they have valid `executorType`, `args`, `env`, and `skills`
2. assign one agent to each workflow step in the template page
3. try saving the template
4. start a workflow
5. verify startup blocks if a step has no agent or a disabled agent

Expected:
- template save works with `agentId`
- workflow start rejects invalid step-agent bindings before the run begins
- valid bindings proceed to execution

- [ ] **Step 6: Commit verification-safe follow-up fixes if needed**

```bash
git add <relevant files>
git commit -m "fix: align workflow agent binding verification"
```

Only do this if verification exposed a real issue that needed a code fix.
