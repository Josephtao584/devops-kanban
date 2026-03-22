# Backend Type Boundary Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the highest-value backend TypeScript boundary types by replacing wide `unknown` and `Record<string, unknown>` contracts with explicit workflow, executor, Fastify, and request-input types.

**Architecture:** Keep the current backend structure and behavior intact while tightening only the main boundary contracts that routes, services, and workflow execution share. The work focuses on strongly typed Fastify service decoration, executor/workflow runtime contracts, and a small set of route/service DTOs, while intentionally leaving dynamic YAML/config structures and semantically meaningful `null` fields alone.

**Tech Stack:** TypeScript, Node.js 22 ESM, Fastify 4, Node test runner, tsx

---

## File Structure Map

### Existing files to modify
- `backend/src/types/fastify.ts` — replace `Promise<unknown>` task-source service contract methods with explicit route-facing return types
- `backend/src/types/executors.ts` — introduce explicit executor process handle and execution result types
- `backend/src/types/sources.ts` — add any small shared route/service-facing source type aliases needed by Fastify/task-source contracts
- `backend/src/services/workflow/workflowStepExecutor.ts` — stop using ad hoc `unknown` executor casts and consume the executor types directly
- `backend/src/services/workflow/workflowService.ts` — tighten workflow stream/result/process context types where they are now broad or cast-heavy
- `backend/src/services/workflow/agentExecutorRegistry.ts` — replace `Record<string, unknown>` executor registry storage with a typed executor map
- `backend/src/services/workflow/executors/claudeCodeExecutor.ts` — align executor input/output surface to the shared executor contract
- `backend/src/services/workflow/executors/codexExecutor.ts` — align executor input/output surface to the shared executor contract
- `backend/src/services/workflow/executors/opencodeExecutor.ts` — align executor input/output surface to the shared executor contract
- `backend/src/routes/executions.ts` — replace broad request-body casts with explicit execution route DTOs
- `backend/src/services/executionService.ts` — replace broad execution input/update types with explicit service DTOs
- `backend/src/services/sessionService.ts` — tighten session create inputs and task/session lookup casts where practical

### Existing tests to modify or extend
- `backend/test/agentExecutorRegistry.test.ts` — verify typed registry behavior still works after contract tightening
- `backend/test/workflowStepExecutor.test.ts` — verify typed executor integration still selects/executes correctly
- `backend/test/workflowService.test.ts` — verify workflow run/cancel path still works with tightened context/result types
- `backend/test/routes/taskSourcesRoutes.test.ts` — use as a type-sensitive consumer of the Fastify taskSourceService contract if needed
- `backend/test/contracts/apiEnvelope.test.ts` — verify response helpers remain unchanged if helper return typing is touched indirectly

### New test files to create
- `backend/test/contracts/taskSourceFastifyContract.test.ts` — focused contract test proving the Fastify-decorated taskSourceService surface matches the route expectations without `unknown`
- `backend/test/contracts/executionRouteInputTypes.test.ts` — focused route/service input contract test for explicit execution create/update DTOs

### Files intentionally NOT changed
- `backend/src/config/taskSources.ts` and the broader YAML config normalization engine
- `backend/src/types/entities.ts` nullable persistence fields and index signatures that reflect on-disk reality
- `backend/src/utils/response.ts` null-based API envelope semantics
- broad repository/entity schema redesign

---

## Implementation Rules

- Do not replace semantically meaningful `null` fields with `undefined` just for style.
- Tighten only boundary types that are already effectively known at runtime.
- Do not redesign the YAML-driven source config model in this pass.
- Prefer introducing small DTO/type aliases over widening existing entity types.
- Keep runtime behavior and response shapes unchanged.
- If a type cannot be made precise without architecture churn, keep it as-is and document why in the code review summary rather than forcing a fake type.

---

### Task 1: Tighten Fastify task-source contract types

**Files:**
- Modify: `backend/src/types/fastify.ts`
- Modify: `backend/src/types/sources.ts`
- Create: `backend/test/contracts/taskSourceFastifyContract.test.ts`
- Verify: `backend/test/routes/taskSourcesRoutes.test.ts`

- [ ] **Step 1: Write a type-focused Fastify task-source contract test**

Create `backend/test/contracts/taskSourceFastifyContract.test.ts` that imports the shared task-source-facing types and asserts a stub Fastify `taskSourceService` object can satisfy the declared contract with explicit source return types.

Example target shape:

```ts
const contract: TaskSourceServiceContract = {
  async getByProject() { return [{ id: 'a', type: 'REQUIREMENT', name: 'x', project_id: 1, config: {} }]; },
  async getById() { return null; },
  async getAvailableSourceTypes() { return { REQUIREMENT: { key: 'REQUIREMENT', name: '需求池', description: 'x' } }; },
  // ...
};
```

- [ ] **Step 2: Run typecheck to verify the contract gap exists**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- FAIL, or require broad `unknown`-based contract declarations that the new shared types will replace

- [ ] **Step 3: Add shared source-facing aliases**

Update `backend/src/types/sources.ts` with small explicit aliases for route-facing source type definitions if needed, such as:
- `SourceTypeDefinition`
- `TaskSourceImportResult`

- [ ] **Step 4: Tighten `TaskSourceServiceContract`**

Update `backend/src/types/fastify.ts` so methods return explicit types such as:
- `Promise<SourceRecord[]>`
- `Promise<SourceRecord | null>`
- `Promise<Record<string, SourceTypeDefinition>>`
- `Promise<{ created: number; skipped: number; total: number }>` where appropriate

- [ ] **Step 5: Re-run typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Run the consuming route test as a safety check**

Run:

```bash
cd backend && node --import tsx --test test/routes/taskSourcesRoutes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the Fastify contract tightening**

```bash
git add backend/src/types/fastify.ts backend/src/types/sources.ts backend/test/contracts/taskSourceFastifyContract.test.ts backend/test/routes/taskSourcesRoutes.test.ts
git commit -m "refactor: tighten task source fastify contract types"
```

---

### Task 2: Tighten executor and workflow runtime boundary types

**Files:**
- Modify: `backend/src/types/executors.ts`
- Modify: `backend/src/services/workflow/agentExecutorRegistry.ts`
- Modify: `backend/src/services/workflow/workflowStepExecutor.ts`
- Modify: `backend/src/services/workflow/workflowService.ts`
- Modify: `backend/src/services/workflow/executors/claudeCodeExecutor.ts`
- Modify: `backend/src/services/workflow/executors/codexExecutor.ts`
- Modify: `backend/src/services/workflow/executors/opencodeExecutor.ts`
- Test: `backend/test/agentExecutorRegistry.test.ts`
- Test: `backend/test/workflowStepExecutor.test.ts`
- Test: `backend/test/workflowService.test.ts`

- [ ] **Step 1: Identify the current cast-heavy executor/workflow boundaries**

Use the existing focused tests plus `npm run typecheck` to identify the exact `unknown` and cast-heavy hotspots that will be tightened in this batch.

- [ ] **Step 2: Run the focused workflow/executor tests as a baseline**

Run:

```bash
cd backend && node --import tsx --test test/agentExecutorRegistry.test.ts test/workflowStepExecutor.test.ts test/workflowService.test.ts
```

Expected:
- PASS, establishing a runtime baseline before type tightening

- [ ] **Step 3: Define explicit executor process and result types**

Update `backend/src/types/executors.ts` with small explicit interfaces such as:
- `ExecutorProcessHandle`
- `ExecutorExecutionInput`
- `ExecutorExecutionResult`
- `Executor`

- [ ] **Step 4: Type the registry storage explicitly**

Update `backend/src/services/workflow/agentExecutorRegistry.ts` to use a typed executor map instead of `Record<string, unknown>`.

- [ ] **Step 5: Tighten workflow step execution**

Update `backend/src/services/workflow/workflowStepExecutor.ts` so:
- `context.proc` uses the shared process-handle type
- executor execution results use the shared result type
- ad hoc `as { proc?: unknown; rawResult?: ... }` casts are removed or minimized

- [ ] **Step 6: Tighten workflow service runtime types only where fields are already known**

Update `backend/src/services/workflow/workflowService.ts` so the active-run context, stream payload handling, and workflow result usage consume the shared executor/workflow types only for the fields already relied upon today. Do not invent precision for third-party runtime shapes that are still effectively opaque.

- [ ] **Step 7: Align executor implementations to the shared contract**

Update the executor implementations so they satisfy the shared `Executor` interface directly.

- [ ] **Step 8: Re-run typecheck for this batch**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 9: Re-run the focused workflow/executor tests**

Run:

```bash
cd backend && node --import tsx --test test/agentExecutorRegistry.test.ts test/workflowStepExecutor.test.ts test/workflowService.test.ts
```

Expected:
- PASS

- [ ] **Step 10: Commit the workflow boundary tightening**

```bash
git add backend/src/types/executors.ts backend/src/services/workflow/agentExecutorRegistry.ts backend/src/services/workflow/workflowStepExecutor.ts backend/src/services/workflow/workflowService.ts backend/src/services/workflow/executors/claudeCodeExecutor.ts backend/src/services/workflow/executors/codexExecutor.ts backend/src/services/workflow/executors/opencodeExecutor.ts backend/test/agentExecutorRegistry.test.ts backend/test/workflowStepExecutor.test.ts backend/test/workflowService.test.ts
git commit -m "refactor: tighten workflow executor boundary types"
```

---

### Task 3: Introduce explicit execution route/service DTOs

**Files:**
- Modify: `backend/src/routes/executions.ts`
- Modify: `backend/src/services/executionService.ts`
- Create: `backend/test/contracts/executionRouteInputTypes.test.ts`

- [ ] **Step 1: Write a compile-time execution input contract test**

Create `backend/test/contracts/executionRouteInputTypes.test.ts` as a type-focused test file that imports the execution route/service DTOs and verifies the intended create/update input shapes compile cleanly.

- [ ] **Step 2: Run typecheck to verify the current execution DTO gap**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- FAIL, or still require broad `Record<string, unknown>` route/service input declarations that the new DTOs will replace

- [ ] **Step 3: Add explicit execution DTOs in the service**

Update `backend/src/services/executionService.ts` to introduce explicit input types such as:
- `CreateExecutionInput`
- `UpdateExecutionInput`

- [ ] **Step 4: Update the route to use the explicit DTOs**

Update `backend/src/routes/executions.ts` so request-body casts target the explicit DTOs instead of `Record<string, unknown>`.

- [ ] **Step 5: Re-run typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Run a small runtime regression for execution routes only if a behavior-sensitive test already exists**

If an existing focused runtime test for execution routes exists, run it. Otherwise skip this step and rely on the final focused runtime sweep.

- [ ] **Step 7: Commit the execution DTO tightening**

```bash
git add backend/src/routes/executions.ts backend/src/services/executionService.ts backend/test/contracts/executionRouteInputTypes.test.ts
git commit -m "refactor: tighten execution route input types"
```

---

### Task 4: Introduce explicit session service input DTOs

**Files:**
- Modify: `backend/src/services/sessionService.ts`
- Possibly modify: `backend/src/routes/sessions.ts` if explicit session-create input imports are needed
- Test: an existing focused session-related suite that already exercises `SessionService`

- [ ] **Step 1: Define the concrete DTO scope up front**

Limit this task to:
- explicit `SessionService` create input type
- the most obvious session/task lookup cast reductions already local to `SessionService`

Do not expand this task into `ProjectService` work or broader repository/entity redesign.

- [ ] **Step 2: Run the existing focused session-related baseline test**

Use one concrete existing suite that already exercises `SessionService` behavior.

- [ ] **Step 3: Add an explicit session create DTO**

Update `backend/src/services/sessionService.ts` so the create path consumes a named input type rather than `Record<string, unknown> & { ... }`.

- [ ] **Step 4: Minimize lookup casts only where the shape is already known**

In `backend/src/services/sessionService.ts`, replace the most obvious `as TaskLike | null` / `as SessionLike | null` hotspots with typed helper returns where practical, but stop short of broader repository/entity redesign.

- [ ] **Step 5: Update `backend/src/routes/sessions.ts` only if needed to align with the new create DTO**

If the route already aligns naturally, leave it unchanged.

- [ ] **Step 6: Re-run typecheck for this batch**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 7: Re-run the same focused session-related baseline test from Step 2**

Expected:
- PASS

- [ ] **Step 8: Commit the session DTO tightening**

```bash
git add backend/src/services/sessionService.ts backend/src/routes/sessions.ts
git commit -m "refactor: tighten session input types"
```

---

### Task 5: Final verification

**Files:**
- Verify only: the explicitly touched files above

- [ ] **Step 1: Run focused boundary checks**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 2: Run focused workflow/runtime regression checks**

Run:

```bash
cd backend && node --import tsx --test test/agentExecutorRegistry.test.ts test/workflowStepExecutor.test.ts test/workflowService.test.ts test/routes/taskSourcesRoutes.test.ts test/workflowTemplateRoutes.test.ts test/contracts/bootstrap.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Run full build**

Run:

```bash
cd backend && npm run build
```

Expected:
- PASS

- [ ] **Step 4: Run full backend test suite only if the focused checks expose integration risk**

Run only if needed:

```bash
cd backend && npm test
```

Expected:
- PASS

- [ ] **Step 5: Commit the verified boundary tightening with explicit file staging**

```bash
git add backend/src/types/fastify.ts backend/src/types/executors.ts backend/src/types/sources.ts backend/src/services/workflow/agentExecutorRegistry.ts backend/src/services/workflow/workflowStepExecutor.ts backend/src/services/workflow/workflowService.ts backend/src/services/workflow/executors/claudeCodeExecutor.ts backend/src/services/workflow/executors/codexExecutor.ts backend/src/services/workflow/executors/opencodeExecutor.ts backend/src/routes/executions.ts backend/src/services/executionService.ts backend/src/services/sessionService.ts backend/src/routes/sessions.ts backend/test/contracts/taskSourceFastifyContract.test.ts backend/test/contracts/executionRouteInputTypes.test.ts backend/test/agentExecutorRegistry.test.ts backend/test/workflowStepExecutor.test.ts backend/test/workflowService.test.ts backend/test/routes/taskSourcesRoutes.test.ts backend/test/workflowTemplateRoutes.test.ts backend/test/contracts/bootstrap.test.ts
git commit -m "refactor: tighten backend type boundaries"
```
