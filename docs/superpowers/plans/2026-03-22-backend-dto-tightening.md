# Backend Route-Service DTO Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broad `Record<string, unknown>` route and service inputs in the project, task, and iteration flows with explicit DTOs while keeping runtime behavior unchanged.

**Architecture:** Keep the current route/service/repository layering intact and tighten only the request-body and service-input boundaries where the data shape is already known today. Each resource pair (`projects`, `tasks`, `iterations`) gets explicit create/update DTOs shared between its route and service, while repositories and entity persistence contracts remain untouched.

**Tech Stack:** TypeScript, Node.js 22 ESM, Fastify 4, Node test runner, tsx

---

## File Structure Map

### Existing files to modify
- `backend/src/routes/projects.ts` — replace `request.body as Record<string, unknown>` with explicit project DTOs
- `backend/src/services/projectService.ts` — introduce `CreateProjectInput` and `UpdateProjectInput`
- `backend/src/routes/tasks.ts` — replace broad task request-body casts with explicit task DTOs
- `backend/src/services/taskService.ts` — introduce explicit `CreateTaskInput` and `UpdateTaskInput`
- `backend/src/routes/iterations.ts` — replace broad iteration request-body casts with explicit iteration DTOs
- `backend/src/services/iterationService.ts` — introduce explicit `CreateIterationInput` and `UpdateIterationInput`

### New test files to create
- `backend/test/contracts/projectRouteInputTypes.test.ts` — compile-time DTO contract test for project route/service inputs
- `backend/test/contracts/taskRouteInputTypes.test.ts` — compile-time DTO contract test for task route/service inputs
- `backend/test/contracts/iterationRouteInputTypes.test.ts` — compile-time DTO contract test for iteration route/service inputs

### Existing tests to use for focused runtime regression
- `backend/test/contracts/rootRoutes.test.ts` — keep top-level app contract stable
- `backend/test/contracts/bootstrap.test.ts` — verify app still builds after route typing changes

### Files intentionally NOT changed
- `backend/src/repositories/**`
- `backend/src/types/entities.ts`
- `backend/src/config/**`
- `backend/src/sources/**`
- workflow/executor typing from the previous round

---

## Implementation Rules

- Do not widen scope into repository/entity redesign.
- Do not change runtime behavior, status codes, or route paths.
- DTOs should describe only the known request/service input shape for each resource.
- If a field is truly optional today, keep it optional in the DTO.
- Prefer colocated exported DTO types in the service file when the route is the only consumer.
- Use `npm run typecheck` as the primary proof for these DTO tightenings; the focused contract tests are compile-time-oriented.

---

### Task 1: Tighten project route-service DTOs

**Files:**
- Modify: `backend/src/routes/projects.ts`
- Modify: `backend/src/services/projectService.ts`
- Create: `backend/test/contracts/projectRouteInputTypes.test.ts`

- [ ] **Step 1: Write a compile-time project DTO contract test**

Create `backend/test/contracts/projectRouteInputTypes.test.ts` that imports the project DTOs and asserts the expected create/update shapes compile cleanly.

Example target shape:

```ts
const createInput: CreateProjectInput = {
  name: 'Platform',
  description: 'Platform rewrite',
  git_url: 'https://example.com/repo.git',
};

const updateInput: UpdateProjectInput = {
  name: 'Platform v2',
  local_path: '/repos/platform',
};
```

- [ ] **Step 2: Run typecheck to verify the current project DTO gap**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- FAIL, or still require `Record<string, unknown>` project route/service input declarations that the new DTOs will replace

- [ ] **Step 3: Add explicit project DTOs**

Update `backend/src/services/projectService.ts` to export:
- `CreateProjectInput`
- `UpdateProjectInput`

- [ ] **Step 4: Update the project route to use the DTOs**

Update `backend/src/routes/projects.ts` so request-body casts target the explicit project DTOs instead of `Record<string, unknown>`.

- [ ] **Step 5: Re-run typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Run the compile-time project DTO contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/projectRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the project DTO tightening**

```bash
git add backend/src/routes/projects.ts backend/src/services/projectService.ts backend/test/contracts/projectRouteInputTypes.test.ts
git commit -m "refactor: tighten project route input types"
```

---

### Task 2: Tighten task route-service DTOs

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/services/taskService.ts`
- Create: `backend/test/contracts/taskRouteInputTypes.test.ts`

- [ ] **Step 1: Write a compile-time task DTO contract test**

Create `backend/test/contracts/taskRouteInputTypes.test.ts` that imports the task DTOs and asserts the expected create/update shapes compile cleanly.

Example target shape:

```ts
const createInput: CreateTaskInput = {
  title: 'Split route module',
  project_id: 1,
  priority: 'HIGH',
};

const updateInput: UpdateTaskInput = {
  title: 'Split route module safely',
  order: 3,
};
```

- [ ] **Step 2: Run typecheck to verify the current task DTO gap**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- FAIL, or still require broad task input declarations that the new DTOs will replace

- [ ] **Step 3: Add explicit task DTOs**

Update `backend/src/services/taskService.ts` to export:
- `CreateTaskInput`
- `UpdateTaskInput`

- [ ] **Step 4: Update the task route to use the DTOs**

Update `backend/src/routes/tasks.ts` so create/update request-body casts target the explicit DTOs.

- [ ] **Step 5: Re-run typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Run the compile-time task DTO contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/taskRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the task DTO tightening**

```bash
git add backend/src/routes/tasks.ts backend/src/services/taskService.ts backend/test/contracts/taskRouteInputTypes.test.ts
git commit -m "refactor: tighten task route input types"
```

---

### Task 3: Tighten iteration route-service DTOs

**Files:**
- Modify: `backend/src/routes/iterations.ts`
- Modify: `backend/src/services/iterationService.ts`
- Create: `backend/test/contracts/iterationRouteInputTypes.test.ts`

- [ ] **Step 1: Write a compile-time iteration DTO contract test**

Create `backend/test/contracts/iterationRouteInputTypes.test.ts` that imports the iteration DTOs and asserts the expected create/update shapes compile cleanly.

Example target shape:

```ts
const createInput: CreateIterationInput = {
  name: 'Sprint 12',
  project_id: 1,
  status: 'PLANNED',
};

const updateInput: UpdateIterationInput = {
  name: 'Sprint 12A',
  status: 'ACTIVE',
};
```

- [ ] **Step 2: Run typecheck to verify the current iteration DTO gap**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- FAIL, or still require broad iteration input declarations that the new DTOs will replace

- [ ] **Step 3: Add explicit iteration DTOs**

Update `backend/src/services/iterationService.ts` to export:
- `CreateIterationInput`
- `UpdateIterationInput`

- [ ] **Step 4: Update the iteration route to use the DTOs**

Update `backend/src/routes/iterations.ts` so create/update request-body casts target the explicit DTOs.

- [ ] **Step 5: Re-run typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Run the compile-time iteration DTO contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/iterationRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the iteration DTO tightening**

```bash
git add backend/src/routes/iterations.ts backend/src/services/iterationService.ts backend/test/contracts/iterationRouteInputTypes.test.ts
git commit -m "refactor: tighten iteration route input types"
```

---

### Task 4: Final verification

**Files:**
- Verify only: all files above

- [ ] **Step 1: Run all DTO contract tests**

Run:

```bash
cd backend && node --import tsx --test test/contracts/projectRouteInputTypes.test.ts test/contracts/taskRouteInputTypes.test.ts test/contracts/iterationRouteInputTypes.test.ts
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

- [ ] **Step 3: Run a small runtime regression sweep**

Run:

```bash
cd backend && node --import tsx --test test/contracts/rootRoutes.test.ts test/contracts/bootstrap.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Run full build**

Run:

```bash
cd backend && npm run build
```

Expected:
- PASS

- [ ] **Step 5: Commit the verified DTO tightening**

```bash
git add backend/src/routes/projects.ts backend/src/services/projectService.ts backend/src/routes/tasks.ts backend/src/services/taskService.ts backend/src/routes/iterations.ts backend/src/services/iterationService.ts backend/test/contracts/projectRouteInputTypes.test.ts backend/test/contracts/taskRouteInputTypes.test.ts backend/test/contracts/iterationRouteInputTypes.test.ts
git commit -m "refactor: tighten project task iteration DTOs"
```
