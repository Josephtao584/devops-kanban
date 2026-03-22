# Backend Route Module Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `backend/src/routes/index.ts` into focused per-resource TypeScript route modules without changing API behavior, startup wiring, or service lifecycle.

**Architecture:** Keep `backend/src/app.ts` as the single registration point and keep `backend/src/routes/index.ts` as a thin aggregation layer only. Move each route plugin into its own `backend/src/routes/*.ts` file, preserving current handler logic, local helper usage, and exported plugin names so tests and app bootstrap continue to work with minimal churn.

**Tech Stack:** TypeScript, Node.js 22 ESM, Fastify 4, Node test runner, tsx

---

## File Structure Map

### New files to create
- `backend/src/routes/projects.ts` — new dedicated project route plugin extracted from `routes/index.ts`
- `backend/src/routes/tasks.ts` — new dedicated task route plugin extracted from `routes/index.ts`
- `backend/src/routes/sessions.ts` — new dedicated session route plugin extracted from `routes/index.ts`
- `backend/src/routes/taskSources.ts` — new dedicated task source route plugin extracted from `routes/index.ts`
- `backend/src/routes/executions.ts` — new dedicated execution route plugin extracted from `routes/index.ts`
- `backend/src/routes/agents.ts` — new dedicated agent route plugin extracted from `routes/index.ts`
- `backend/src/routes/roles.ts` — new dedicated role route plugin extracted from `routes/index.ts`
- `backend/src/routes/members.ts` — new dedicated member route plugin extracted from `routes/index.ts`
- `backend/src/routes/workflows.ts` — new dedicated workflow route plugin extracted from `routes/index.ts`
- `backend/src/routes/workflowTemplate.ts` — new dedicated workflow template route plugin extracted from `routes/index.ts`
- `backend/src/routes/iterations.ts` — new dedicated iteration route plugin extracted from `routes/index.ts`

### Existing files to modify
- `backend/src/routes/index.ts` — reduce to aggregation exports only
- `backend/src/app.ts` — keep registration imports pointed at the aggregate module after split
- `backend/test/workflowTemplateRoutes.test.ts` — keep route-module import working against split file
- `backend/test/contracts/bootstrap.test.ts` — continue validating app bootstrap after the split

### New test files to create
- `backend/test/routes/taskSourcesRoutes.test.ts` — focused route-plugin safety test for the dedicated `taskSourceRoutes` module after extraction

### Files intentionally NOT changed
- `backend/src/services/**`
- `backend/src/repositories/**`
- `backend/src/utils/**`
- `backend/src/config/**`
- route behavior, payloads, status codes, and URL structure
- shared helper extraction beyond what is strictly necessary for file-local compilation

---

## Implementation Rules

- Preserve existing plugin names (`projectRoutes`, `taskRoutes`, etc.) so bootstrap and tests stay stable.
- Do not change route prefixes in `backend/src/app.ts`.
- Do not introduce new shared helper modules in this pass.
- If a route file needs a small duplicated helper (for example `parseNumber`), keep it local rather than expanding scope.
- Keep `backend/src/routes/index.ts` as a barrel file only.
- Prefer moving code exactly as-is first, then doing the smallest required import/type fixes.

---

### Task 1: Add split-safety tests for new route modules

**Files:**
- Create: `backend/test/routes/taskSourcesRoutes.test.ts`

- [ ] **Step 1: Write a new focused task-source route plugin test file**

Create `backend/test/routes/taskSourcesRoutes.test.ts` by reusing the existing Fastify injection pattern already used elsewhere in backend tests. The file should import the dedicated route plugin by **named export**:

```ts
import { taskSourceRoutes } from '../../src/routes/taskSources.js';
```

The test file should cover only the split safety surface:
- route module can be registered directly
- `GET /types/available` still wins over `/:id`
- read-only write endpoints still return `405`

- [ ] **Step 2: Run the new focused test to verify it fails before the route module exists**

Run:

```bash
cd backend && node --import tsx --test test/routes/taskSourcesRoutes.test.ts
```

Expected:
- FAIL with a module resolution error for `src/routes/taskSources.js`

- [ ] **Step 3: Do not commit in the red state**

Leave the failing new test uncommitted and move directly into implementation.

---

### Task 2: Extract straightforward CRUD route modules

**Files:**
- Create: `backend/src/routes/projects.ts`
- Create: `backend/src/routes/executions.ts`
- Create: `backend/src/routes/agents.ts`
- Create: `backend/src/routes/roles.ts`
- Create: `backend/src/routes/members.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Copy the project route plugin into its own file**

Move the existing `projectRoutes` plugin and only the imports/types/helpers it needs into `backend/src/routes/projects.ts`.

- [ ] **Step 2: Copy the execution route plugin into its own file**

Move `executionRoutes` into `backend/src/routes/executions.ts` with only its required dependencies.

- [ ] **Step 3: Copy the agent route plugin into its own file**

Move `agentRoutes` into `backend/src/routes/agents.ts`.

- [ ] **Step 4: Copy the role route plugin into its own file**

Move `roleRoutes` into `backend/src/routes/roles.ts`.

- [ ] **Step 5: Copy the member route plugin into its own file**

Move `memberRoutes` into `backend/src/routes/members.ts`.

- [ ] **Step 6: Replace moved code in `routes/index.ts` with re-exports only**

After extraction, `backend/src/routes/index.ts` should re-export from dedicated files instead of carrying implementation bodies for these plugins.

Example target shape:

```ts
export { projectRoutes } from './projects.js';
export { executionRoutes } from './executions.js';
export { agentRoutes } from './agents.js';
export { roleRoutes } from './roles.js';
export { memberRoutes } from './members.js';
```

- [ ] **Step 7: Run typecheck after this extraction batch**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS, or only errors from still-unextracted route plugins in `routes/index.ts`

- [ ] **Step 8: Commit the CRUD extraction batch**

```bash
git add backend/src/routes/projects.ts backend/src/routes/executions.ts backend/src/routes/agents.ts backend/src/routes/roles.ts backend/src/routes/members.ts backend/src/routes/index.ts
git commit -m "refactor: split core CRUD route modules"
```

---

### Task 3: Extract task, iteration, and task-source route modules

**Files:**
- Create: `backend/src/routes/tasks.ts`
- Create: `backend/src/routes/iterations.ts`
- Create: `backend/src/routes/taskSources.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/test/routes/taskSourcesRoutes.test.ts`

- [ ] **Step 1: Move `taskRoutes` into `backend/src/routes/tasks.ts`**

Keep local parsing/types inside the file unless moving them is strictly required for compilation.

- [ ] **Step 2: Move `iterationRoutes` into `backend/src/routes/iterations.ts`**

Preserve status/update endpoints exactly.

- [ ] **Step 3: Move `taskSourceRoutes` into `backend/src/routes/taskSources.ts`**

Preserve read-only behavior and path ordering exactly so `/types/available` is not shadowed.

- [ ] **Step 4: Replace the moved implementations in `routes/index.ts` with named re-exports**

```ts
export { taskRoutes } from './tasks.js';
export { iterationRoutes } from './iterations.js';
export { taskSourceRoutes } from './taskSources.js';
```

- [ ] **Step 5: Run the dedicated task-source route test**

Run:

```bash
cd backend && node --import tsx --test test/routes/taskSourcesRoutes.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Run typecheck for the extraction batch**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS, or only errors from still-unextracted workflow/session route code

- [ ] **Step 7: Commit the task-oriented extraction batch**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/iterations.ts backend/src/routes/taskSources.ts backend/src/routes/index.ts backend/test/routes/taskSourcesRoutes.test.ts
git commit -m "refactor: split task-oriented route modules"
```

---

### Task 4: Extract session and workflow route modules

**Files:**
- Create: `backend/src/routes/sessions.ts`
- Create: `backend/src/routes/workflows.ts`
- Create: `backend/src/routes/workflowTemplate.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/test/workflowTemplateRoutes.test.ts`

- [ ] **Step 1: Move `sessionRoutes` into `backend/src/routes/sessions.ts`**

Keep the current WebSocket/session subscription behavior intact; do not redesign it in this pass.

- [ ] **Step 2: Move `workflowRoutes` into `backend/src/routes/workflows.ts`**

Preserve workflow run/cancel behavior and service wiring.

- [ ] **Step 3: Move `workflowTemplateRoutes` into `backend/src/routes/workflowTemplate.ts`**

Preserve the optional `service` injection contract used by `backend/test/workflowTemplateRoutes.test.ts`.

- [ ] **Step 4: Update `backend/test/workflowTemplateRoutes.test.ts` to import the dedicated named export**

Use:

```ts
import { workflowTemplateRoutes } from '../src/routes/workflowTemplate.js';
```

- [ ] **Step 5: Replace the moved implementations in `routes/index.ts` with named re-exports**

```ts
export { sessionRoutes } from './sessions.js';
export { workflowRoutes } from './workflows.js';
export { workflowTemplateRoutes } from './workflowTemplate.js';
```

- [ ] **Step 6: Run the focused workflow-template route test**

Run:

```bash
cd backend && node --import tsx --test test/workflowTemplateRoutes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Run typecheck after workflow/session extraction**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS, or only errors from any remaining route implementation still inside `routes/index.ts`

- [ ] **Step 8: Commit the session/workflow extraction batch**

```bash
git add backend/src/routes/sessions.ts backend/src/routes/workflows.ts backend/src/routes/workflowTemplate.ts backend/src/routes/index.ts backend/test/workflowTemplateRoutes.test.ts
git commit -m "refactor: split session and workflow route modules"
```

---

### Task 5: Reduce `routes/index.ts` to a pure barrel and verify bootstrap stability

**Files:**
- Modify: `backend/src/routes/index.ts`
- Verify: `backend/src/app.ts`

- [ ] **Step 1: Remove all remaining route implementation bodies from `routes/index.ts`**

The target file should only export route plugins from dedicated modules.

- [ ] **Step 2: Ensure `backend/src/routes/index.ts` continues to export every current plugin name**

The barrel must continue to export these names exactly:

```ts
export { agentRoutes } from './agents.js';
export { executionRoutes } from './executions.js';
export { iterationRoutes } from './iterations.js';
export { memberRoutes } from './members.js';
export { projectRoutes } from './projects.js';
export { roleRoutes } from './roles.js';
export { sessionRoutes } from './sessions.js';
export { taskRoutes } from './tasks.js';
export { taskSourceRoutes } from './taskSources.js';
export { workflowRoutes } from './workflows.js';
export { workflowTemplateRoutes } from './workflowTemplate.js';
```

- [ ] **Step 3: Verify `backend/src/app.ts` remains unchanged unless imports actually need edits**

Keep the existing aggregate import surface and confirm route registration prefixes are identical before and after the split.

- [ ] **Step 4: Run a focused bootstrap contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/bootstrap.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit the barrel cleanup**

```bash
git add backend/src/routes/index.ts backend/src/app.ts
if git diff --cached --quiet -- backend/src/app.ts; then git reset backend/src/app.ts; fi
git commit -m "refactor: reduce route index to barrel exports"
```

---

### Task 6: Final verification

**Files:**
- Verify only: `backend/src/routes/**`, `backend/src/app.ts`, related tests

- [ ] **Step 1: Run route-focused tests**

Run:

```bash
cd backend && node --import tsx --test test/routes/taskSourcesRoutes.test.ts test/workflowTemplateRoutes.test.ts test/contracts/bootstrap.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run full typecheck**

Run:

```bash
cd backend && npm run typecheck
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

- [ ] **Step 4: Run full backend test suite**

Run:

```bash
cd backend && npm test
```

Expected:
- PASS, no route behavior regressions

- [ ] **Step 5: Commit the verified route split**

```bash
git add backend/src/routes backend/src/app.ts backend/test/routes/taskSourcesRoutes.test.ts backend/test/workflowTemplateRoutes.test.ts
git commit -m "refactor: split backend route modules"
```
