# Workflow Step Prompt Assembler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-step configurable prompt instructions, move prompt assembly out of the Claude runner, and use Mastra workflow state for shared task context while keeping step summaries flowing through Mastra step outputs.

**Architecture:** Workflow template steps gain an `instructionPrompt` field editable from the frontend. The workflow initializes Mastra `state` with shared task context (`taskTitle`, `taskDescription`, `worktreePath`), and a new backend prompt assembler combines that state with each step’s `instructionPrompt` and upstream step summaries from `inputData` to produce the final prompt before execution. Claude runner/executor become execution-only and accept a prebuilt `prompt` string.

**Tech Stack:** Node.js, Fastify, Zod, Mastra workflows/state, Vue 3, Element Plus, node:test, cross-spawn.

---

## File Structure

**Create:**
- `backend/src/services/workflowPromptAssembler.js` — Builds the final prompt from template step config, workflow state, and upstream step outputs.
- `backend/test/workflowPromptAssembler.test.js` — Unit tests for prompt assembly across first step, sequential steps, and multi-upstream inputs.

**Modify:**
- `backend/src/services/workflowTemplateService.js` — Add default `instructionPrompt` values, normalize old templates, validate new field.
- `backend/src/services/workflowStepExecutor.js` — Build final prompt before calling executor; stop passing prompt-building business fields to executor.
- `backend/src/services/executors/claudeCodeExecutor.js` — Accept final `prompt` directly and pass it through to runner.
- `backend/src/services/claudeStepRunner.js` — Remove business prompt assembly; only run provided prompt.
- `backend/src/workflows/index.js` — Add Mastra `stateSchema`, initialize shared state, and read `state` inside steps instead of threading task context through each step output.
- `backend/src/routes/workflowTemplate.js` — Keep route surface the same, but ensure updated template shape returns correctly.
- `backend/test/workflowTemplateService.test.js` — Cover default `instructionPrompt`, template normalization, and validation.
- `backend/test/workflowTemplateRoutes.test.js` — Verify route returns and updates `instructionPrompt`.
- `backend/test/workflowStepExecutor.test.js` — Verify executor receives assembled prompt and shared context is handled at executor layer.
- `backend/test/claudeStepRunner.test.js` — Remove old prompt-builder coupling and verify runner accepts direct prompt input.
- `frontend/src/views/WorkflowTemplateConfig.vue` — Add editable prompt textarea per step.
- `frontend/src/locales/zh.js` — Add labels/help text for prompt configuration.
- `frontend/src/locales/en.js` — Add matching English labels/help text.

**Check (read-only during implementation):**
- `backend/src/services/claudeStepResult.js` — Summary contract remains unchanged.
- `frontend/src/api/workflowTemplate.js` — Likely unchanged; confirm current PUT payload already sends full template.

---

### Task 1: Add template-level step prompt configuration

**Files:**
- Modify: `backend/src/services/workflowTemplateService.js`
- Test: `backend/test/workflowTemplateService.test.js`
- Test: `backend/test/workflowTemplateRoutes.test.js`

- [ ] **Step 1: Write the failing backend template tests**

Add assertions that:
- default template includes non-empty `instructionPrompt` for all four fixed steps
- updating a valid template preserves `instructionPrompt`
- missing/blank `instructionPrompt` is rejected (or normalized only when loading legacy stored templates, not when saving invalid payloads)
- route GET/PUT returns the new field

Suggested concrete coverage:
```js
test('WorkflowTemplateService default template includes instructionPrompt for each step', async () => {
  // assert every step has non-empty instructionPrompt
})

test('WorkflowTemplateService rejects blank instructionPrompt', async () => {
  // mutate one step to instructionPrompt: '   '
})

test('PUT /api/workflow-template updates instructionPrompt', async () => {
  // send payload with changed instructionPrompt and assert response + savedTemplate
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowTemplateService.test.js test/workflowTemplateRoutes.test.js
```
Expected:
- FAIL because current template shape has no `instructionPrompt`

- [ ] **Step 3: Implement minimal template support**

In `backend/src/services/workflowTemplateService.js`:
- Add fixed default prompt text for:
  - `requirement-design`
  - `code-development`
  - `testing`
  - `code-review`
- Include `instructionPrompt` in `buildDefaultTemplate()`
- Add a normalization path in `getTemplate()` so legacy persisted templates missing `instructionPrompt` are filled from defaults before returning/saving
- Extend validation to require non-empty `instructionPrompt` on every step during updates

Keep scope tight:
- no extra prompt fields
- no refactor of executor config model

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowTemplateService.test.js test/workflowTemplateRoutes.test.js
```
Expected:
- PASS
- route/service tests confirm `instructionPrompt` round-trips correctly

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowTemplateService.js backend/test/workflowTemplateService.test.js backend/test/workflowTemplateRoutes.test.js
git commit -m "feat: add workflow step instruction prompts"
```

---

### Task 2: Add prompt assembler service with upstream summary support

**Files:**
- Create: `backend/src/services/workflowPromptAssembler.js`
- Test: `backend/test/workflowPromptAssembler.test.js`

- [ ] **Step 1: Write the failing prompt assembler tests**

Cover three cases:
1. first step: prompt includes task title/description + step instruction, no upstream summary block
2. sequential step: prompt includes one upstream summary from `inputData.summary`
3. multi-upstream step: prompt includes summaries keyed by upstream step IDs from aggregated `inputData`

Suggested test shape:
```js
test('assembleWorkflowPrompt builds first-step prompt without upstream summaries', () => {
  const prompt = assembleWorkflowPrompt({ ... })
  assert.match(prompt, /当前步骤：需求设计/)
  assert.doesNotMatch(prompt, /上游步骤摘要/)
})

test('assembleWorkflowPrompt includes sequential upstream summary', () => {
  const prompt = assembleWorkflowPrompt({ inputData: { summary: '设计完成' }, upstreamStepIds: ['requirement-design'], ... })
})

test('assembleWorkflowPrompt includes all upstream summaries for merged inputs', () => {
  const prompt = assembleWorkflowPrompt({ inputData: { 'code-development': { summary: '实现完成' }, testing: { summary: '测试完成' } }, upstreamStepIds: ['code-development', 'testing'], ... })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowPromptAssembler.test.js
```
Expected:
- FAIL because assembler file does not exist yet

- [ ] **Step 3: Implement minimal assembler**

Create `backend/src/services/workflowPromptAssembler.js` with a single exported function, e.g. `assembleWorkflowPrompt(...)`, that:
- accepts `step`, `state`, `inputData`, and `upstreamStepIds`
- builds a consistent prompt with sections:
  - current step name
  - original task title
  - original task description
  - upstream summaries (only when present)
  - current step instructionPrompt
  - common summary-only output constraint
- extracts upstream summaries as:
  - sequential: `inputData.summary`
  - merged/parallel: `inputData[stepId].summary` for each upstream step id

Keep it string-based and deterministic. No markdown tables, no extra formatting abstractions.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowPromptAssembler.test.js
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowPromptAssembler.js backend/test/workflowPromptAssembler.test.js
git commit -m "feat: add workflow prompt assembler"
```

---

### Task 3: Move prompt assembly above the Claude runner

**Files:**
- Modify: `backend/src/services/workflowStepExecutor.js`
- Modify: `backend/src/services/executors/claudeCodeExecutor.js`
- Modify: `backend/src/services/claudeStepRunner.js`
- Test: `backend/test/workflowStepExecutor.test.js`
- Test: `backend/test/claudeStepRunner.test.js`

- [ ] **Step 1: Write the failing executor/runner tests**

Add tests that assert:
- `executeWorkflowStep()` assembles a prompt from template/state/inputData and passes that final `prompt` to executor
- `ClaudeStepRunner` no longer depends on `buildStepPrompt` business inputs and can run from a provided prompt directly

Suggested coverage:
```js
test('executeWorkflowStep passes assembled prompt to executor', async () => {
  // stub template with instructionPrompt
  // stub executor.execute({ prompt })
  // assert prompt contains task description + upstream summary + instructionPrompt
})

test('ClaudeStepRunner runStep uses provided prompt', async () => {
  // invoke runStep with prompt and assert spawnImpl receives same prompt
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowStepExecutor.test.js test/claudeStepRunner.test.js
```
Expected:
- FAIL because executor still passes business fields and runner still builds prompt internally

- [ ] **Step 3: Implement minimal orchestration change**

In `backend/src/services/workflowStepExecutor.js`:
- read current step from template
- build prompt using the new assembler
- pass `prompt` into `executor.execute(...)`

In `backend/src/services/executors/claudeCodeExecutor.js`:
- accept `prompt` in `execute(...)`
- pass it through to runner

In `backend/src/services/claudeStepRunner.js`:
- remove `buildStepPrompt` import and business prompt-building call
- change `runStep(...)` to require `prompt`
- keep command resolution, cross-spawn launch, and result parsing intact

Do not redesign non-Claude executors unless needed for prompt passthrough symmetry.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowStepExecutor.test.js test/claudeStepRunner.test.js
```
Expected:
- PASS
- prompt assembly now happens before executor/runner

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflowStepExecutor.js backend/src/services/executors/claudeCodeExecutor.js backend/src/services/claudeStepRunner.js backend/test/workflowStepExecutor.test.js backend/test/claudeStepRunner.test.js
git commit -m "refactor: assemble workflow prompts before execution"
```

---

### Task 4: Introduce Mastra workflow state for shared task context

**Files:**
- Modify: `backend/src/workflows/index.js`
- Test: `backend/test/workflowService.test.js`
- Test: `backend/test/workflowStepExecutor.test.js`

- [ ] **Step 1: Write the failing workflow state tests**

Add tests that verify:
- workflow shared state contains `taskTitle`, `taskDescription`, and `worktreePath`
- step execution can read shared task context from state instead of threading those fields through every downstream step input/output schema
- later steps still receive upstream step summaries through `inputData`

If current tests do not cover Mastra step execute callbacks directly, add focused unit coverage for any helper exported from `index.js` that computes step state/init values.

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowService.test.js test/workflowStepExecutor.test.js
```
Expected:
- FAIL because workflow currently does not define/use shared state for task context

- [ ] **Step 3: Implement minimal state-based workflow context**

In `backend/src/workflows/index.js`:
- define workflow `stateSchema` with:
  - `taskTitle`
  - `taskDescription`
  - `worktreePath`
- initialize shared state at workflow start using initial input
- in each step `execute`, read shared context from `state`
- keep step output focused on `{ summary }` (plus existing `worktreePath` only if still needed for first-step handoff, but prefer removing that if state makes it unnecessary)
- derive upstream summaries from `inputData`, not state

Keep the fixed 4-step topology unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowService.test.js test/workflowStepExecutor.test.js
```
Expected:
- PASS
- shared task context comes from Mastra state

- [ ] **Step 5: Commit**

```bash
git add backend/src/workflows/index.js backend/test/workflowService.test.js backend/test/workflowStepExecutor.test.js
git commit -m "refactor: store workflow task context in mastra state"
```

---

### Task 5: Expose editable step prompts in the frontend

**Files:**
- Modify: `frontend/src/views/WorkflowTemplateConfig.vue`
- Modify: `frontend/src/locales/zh.js`
- Modify: `frontend/src/locales/en.js`
- Check: `frontend/src/api/workflowTemplate.js`

- [ ] **Step 1: Write the failing frontend-facing expectations**

Because this frontend currently appears to rely on direct component logic without existing component tests, add the smallest viable automated coverage if a test harness exists. If no frontend test harness is present for this area, document the exact manual verification steps in this task and keep code changes minimal.

At minimum, define expected UI behavior before editing:
- each workflow step shows an editable multiline `instructionPrompt`
- save sends the updated template unchanged through existing API layer
- labels/help text render for the new field

If a lightweight test file already exists for this view, extend it; otherwise prefer implementation + manual verification notes over scaffolding a new frontend test framework.

- [ ] **Step 2: Run the relevant frontend check (or confirm no local harness exists)**

If there is an existing frontend single-run test command covering this area, run it. Otherwise note that this task will use manual verification only.

Preferred command if available:
```bash
cd "D:/workspace/devops-kanban/frontend" && npm run test:run
```
Expected:
- Either existing tests fail for missing UI or no applicable harness exists

- [ ] **Step 3: Implement minimal frontend editing support**

In `frontend/src/views/WorkflowTemplateConfig.vue`:
- add a new column or expandable section with `el-input` textarea bound to `scope.row.instructionPrompt`
- keep layout readable; do not redesign the page
- avoid extra local state if direct `v-model` on template data is enough

In locales:
- add labels like `instructionPrompt`, `instructionPromptHint`
- update description text to mention per-step prompt configuration

Do not change API surface unless necessary.

- [ ] **Step 4: Run the frontend verification**

If automated test exists, run it. In all cases perform manual verification:
1. open `/workflow-template`
2. edit one step’s prompt text
3. save
4. reload page
5. confirm edited prompt persists

If automated command is available, run:
```bash
cd "D:/workspace/devops-kanban/frontend" && npm run test:run
```
Expected:
- automated checks pass, or manual verification succeeds if no targeted harness exists

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/WorkflowTemplateConfig.vue frontend/src/locales/zh.js frontend/src/locales/en.js
git commit -m "feat: edit workflow step prompts in template UI"
```

---

### Task 6: Remove obsolete prompt-builder coupling and verify end-to-end backend behavior

**Files:**
- Modify or Delete: `backend/src/services/claudeStepPromptBuilder.js`
- Modify: `backend/test/claudeStepPromptBuilder.test.js`
- Test: `backend/test/workflowTemplateService.test.js`
- Test: `backend/test/workflowPromptAssembler.test.js`
- Test: `backend/test/workflowStepExecutor.test.js`
- Test: `backend/test/claudeStepRunner.test.js`
- Test: `backend/test/workflowService.test.js`

- [ ] **Step 1: Write the failing cleanup test/update**

Decide the end state:
- preferred: delete `claudeStepPromptBuilder.js` entirely if nothing uses it after prompt assembly moves out
- if retained temporarily, repurpose it as a thin wrapper over the new assembler only if truly necessary

Update tests accordingly so they fail against the old leftover coupling.

- [ ] **Step 2: Run backend test suite slice to verify failures**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/claudeStepPromptBuilder.test.js test/workflowTemplateService.test.js test/workflowPromptAssembler.test.js test/workflowStepExecutor.test.js test/claudeStepRunner.test.js test/workflowService.test.js
```
Expected:
- FAIL until obsolete prompt-builder path is removed or updated consistently

- [ ] **Step 3: Implement minimal cleanup**

- remove dead prompt-builder code if unused
- update tests/imports to point at assembler where appropriate
- ensure no remaining business prompt assembly exists in the runner layer

Keep cleanup strictly related to prompt-system redesign.

- [ ] **Step 4: Run full targeted backend verification**

Run:
```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowTemplateService.test.js test/workflowTemplateRoutes.test.js test/workflowPromptAssembler.test.js test/workflowStepExecutor.test.js test/claudeStepRunner.test.js test/workflowService.test.js
```
Expected:
- PASS
- template prompt config, assembler, workflow state, and runner separation all verified together

- [ ] **Step 5: Commit**

```bash
git add backend/src/services backend/src/workflows backend/test
git commit -m "refactor: separate workflow prompt assembly from claude runner"
```

---

## Final Verification

After all tasks, run these checks before declaring the work complete:

- [ ] **Backend targeted verification**

```bash
cd "D:/workspace/devops-kanban/backend" && node --test test/workflowTemplateService.test.js test/workflowTemplateRoutes.test.js test/workflowPromptAssembler.test.js test/workflowStepExecutor.test.js test/claudeStepRunner.test.js test/workflowService.test.js
```
Expected: all pass

- [ ] **Frontend verification**

```bash
cd "D:/workspace/devops-kanban/frontend" && npm run test:run
```
Expected: pass if harness exists; otherwise complete the manual `/workflow-template` edit/save/reload check

- [ ] **Manual workflow smoke check**

1. Open workflow template page and edit one step prompt
2. Save and reload
3. Start a workflow for a task
4. Confirm first step prompt contains original task info + step instruction
5. Confirm second step prompt contains original task info + first-step summary + second-step instruction
6. Confirm workflow still returns summary-only step results

---
