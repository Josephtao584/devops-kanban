# Backend Shared Type Extraction Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the next batch of cross-layer backend types into `backend/src/types/` by first centralizing shared boundary types (A1), then introducing explicit persistence input types between services and repositories (A2), without changing runtime behavior.

**Architecture:** Keep the current Fastify route → service → repository structure intact and only move shared boundary contracts out of implementation files when they are used across layers or represent stable API/service contracts. A1 consolidates HTTP/session/workflow/task-source boundary types; A2 follows by defining explicit persistence input types for project/task/iteration repository writes so services no longer rely on `as unknown as` casts.

**Tech Stack:** TypeScript, Node.js, Fastify 4, Node test runner, tsx

---

## File Structure Map

### New files to create
- `backend/src/types/http/params.ts` — shared Fastify route param contracts like `IdParams`, `TaskIdParams`, `SessionIdParams`
- `backend/src/types/http/query.ts` — shared query contracts like `ProjectIdQuery`, `TaskIdQuery`, `SessionFiltersQuery`
- `backend/src/types/dto/sessions.ts` — explicit HTTP/session DTOs such as `CreateSessionInput` and `ContinueSessionBody`
- `backend/src/types/ws/sessions.ts` — WebSocket/session event payload contracts such as `SessionChannel`, `WebSocketPayload`, `BroadcastPayload`, `BroadcastFn`
- `backend/src/types/dto/workflows.ts` — explicit workflow route DTOs like `StartWorkflowBody`
- `backend/src/types/persistence/projects.ts` — explicit repository write contracts for projects
- `backend/src/types/persistence/tasks.ts` — explicit repository write contracts for tasks
- `backend/src/types/persistence/iterations.ts` — explicit repository write contracts for iterations
- `backend/test/contracts/sessionRouteInputTypes.test.ts` — compile-time contract test for session HTTP and WS shared types
- `backend/test/contracts/workflowRouteInputTypes.test.ts` — compile-time contract test for workflow route DTOs
- `backend/test/contracts/httpRouteSharedTypes.test.ts` — compile-time contract test for shared HTTP param/query types
- `backend/test/contracts/persistenceInputTypes.test.ts` — compile-time contract test for project/task/iteration persistence input types

### Existing files to modify for A1
- `backend/src/routes/sessions.ts` — replace local HTTP/WS boundary types with imports from `src/types`
- `backend/src/services/sessionService.ts` — replace exported/local boundary types with imports from `src/types`
- `backend/src/routes/workflows.ts` — replace local workflow request types with imports from `src/types`
- `backend/src/routes/projects.ts` — replace local param types with shared HTTP param imports and remove body casts where possible
- `backend/src/routes/tasks.ts` — replace local param/query/body helper types with shared HTTP and DTO imports where appropriate
- `backend/src/routes/iterations.ts` — replace local param/query/body helper types with shared HTTP and DTO imports where appropriate
- `backend/src/routes/executions.ts` — replace local param helper types with shared HTTP param imports and import execution DTOs from `src/types/dto/executions.ts`
- `backend/src/routes/taskSources.ts` — replace local param/query helper types with shared HTTP imports
- `backend/src/routes/agents.ts` — replace local param helper type with shared HTTP import
- `backend/src/types/fastify.ts` — tighten `TaskSourceServiceContract.sync()` return type to an explicit shared type
- `backend/src/types/sources.ts` — add or reuse a named sync result item type instead of `Record<string, unknown>[]`
- `backend/src/services/taskSourceService.ts` — return a named sync result item array instead of `Array<Record<string, unknown>>`

### Existing files to modify for A2
- `backend/src/services/projectService.ts` — stop casting DTOs to inline entity projections; map to explicit persistence input types
- `backend/src/services/taskService.ts` — stop casting DTOs to inline entity projections; map to explicit persistence input types
- `backend/src/services/iterationService.ts` — stop casting DTOs to inline entity projections; map to explicit persistence input types
- `backend/src/repositories/projectRepository.ts` — use explicit persistence input types in `BaseRepository` generic parameters
- `backend/src/repositories/taskRepository.ts` — use explicit persistence input types in `BaseRepository` generic parameters
- `backend/src/repositories/iterationRepository.ts` — use explicit persistence input types in `BaseRepository` generic parameters

### Existing tests to run as focused regression checks
- `backend/test/contracts/bootstrap.test.ts`
- `backend/test/contracts/rootRoutes.test.ts`
- `backend/test/contracts/taskSourceFastifyContract.test.ts`
- `backend/test/routes/taskSourcesRoutes.test.ts`
- `backend/test/routes/sessionsRoutes.test.ts` (if present; if missing, rely on compile-time contract tests plus bootstrap/root verification)

### Files intentionally NOT changed
- `backend/src/repositories/base.ts`
- `backend/src/types/entities.ts`
- repository-private stored record types like `StoredTaskSourceEntity`
- service-private minimum-shape helper types like `SessionLike` / `TaskLike` unless they become unnecessary during the refactor
- workflow implementation internals under `backend/src/services/workflow/**`

---

## Implementation Rules

- Do not change route paths, response payloads, status codes, or runtime business behavior.
- Only extract types that are genuinely shared across route/service/repository boundaries or represent stable service contracts.
- Keep repository-private storage detail types local unless they become cross-file dependencies.
- For A1, prefer `backend/src/types/dto/**`, `backend/src/types/http/**`, and `backend/src/types/ws/**` over adding more local route aliases.
- For A2, prefer `backend/src/types/persistence/**` over reusing DTOs directly as repository write contracts.
- Eliminate `as unknown as` casts from `projectService`, `taskService`, and `iterationService`.
- When a route body already has a stable DTO in `src/types/dto`, use the Fastify generic body type instead of `request.body as ...`.
- Use compile-time contract tests plus focused runtime tests as evidence; finish with `npm run typecheck` and `npm run build`.

---

### Task 1: Extract shared HTTP route contracts

**Files:**
- Create: `backend/src/types/http/params.ts`
- Create: `backend/src/types/http/query.ts`
- Modify: `backend/src/routes/projects.ts`
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/routes/iterations.ts`
- Modify: `backend/src/routes/executions.ts`
- Modify: `backend/src/routes/taskSources.ts`
- Modify: `backend/src/routes/agents.ts`
- Modify: `backend/src/routes/workflows.ts`
- Modify: `backend/src/routes/sessions.ts`
- Create: `backend/test/contracts/httpRouteSharedTypes.test.ts`

- [ ] **Step 1: Write the failing shared HTTP contract test**

Create `backend/test/contracts/httpRouteSharedTypes.test.ts` with imports like:

```ts
import type { IdParams, TaskIdParams, SessionIdParams } from '../../src/types/http/params.ts';
import type { ProjectIdQuery, TaskIdQuery, SessionFiltersQuery } from '../../src/types/http/query.ts';
```

Assert example assignments compile:

```ts
const idParams: IdParams = { id: '1' };
const taskIdParams: TaskIdParams = { taskId: '42' };
const projectQuery: ProjectIdQuery = { project_id: '7' };
const sessionFilters: SessionFiltersQuery = { taskId: '9', activeOnly: 'true' };
```

- [ ] **Step 2: Run the targeted contract test to verify the gap**

Run:

```bash
cd backend && node --import tsx --test test/contracts/httpRouteSharedTypes.test.ts
```

Expected:
- FAIL because the shared HTTP type modules do not exist yet

- [ ] **Step 3: Add shared HTTP type modules**

Create `backend/src/types/http/params.ts` with explicit exports:

```ts
export interface IdParams {
  id: string;
}

export interface TaskIdParams {
  taskId: string;
}

export interface SessionIdParams {
  sessionId: string;
}
```

Create `backend/src/types/http/query.ts` with explicit exports such as:

```ts
export interface ProjectIdQuery {
  project_id?: string;
}

export interface TaskIdQuery {
  task_id?: string;
}

export interface SessionFiltersQuery {
  taskId?: string;
  activeOnly?: string;
}
```

- [ ] **Step 4: Update routes to import the shared HTTP types**

Replace duplicated local aliases in:
- `backend/src/routes/projects.ts`
- `backend/src/routes/tasks.ts`
- `backend/src/routes/iterations.ts`
- `backend/src/routes/executions.ts`
- `backend/src/routes/taskSources.ts`
- `backend/src/routes/agents.ts`
- `backend/src/routes/workflows.ts`
- `backend/src/routes/sessions.ts`

Use the exact shared imports instead of per-file `type ParamsWithId = ...` / `type QueryWithProjectId = ...` declarations.

- [ ] **Step 5: Re-run the shared HTTP contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/httpRouteSharedTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Run focused typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 7: Commit the shared HTTP type extraction**

```bash
git add backend/src/types/http/params.ts backend/src/types/http/query.ts backend/src/routes/projects.ts backend/src/routes/tasks.ts backend/src/routes/iterations.ts backend/src/routes/executions.ts backend/src/routes/taskSources.ts backend/src/routes/agents.ts backend/src/routes/workflows.ts backend/src/routes/sessions.ts backend/test/contracts/httpRouteSharedTypes.test.ts
git commit -m "refactor: extract shared http route types"
```

---

### Task 2: Extract session HTTP and WebSocket boundary types

**Files:**
- Create: `backend/src/types/dto/sessions.ts`
- Create: `backend/src/types/ws/sessions.ts`
- Modify: `backend/src/routes/sessions.ts`
- Modify: `backend/src/services/sessionService.ts`
- Create: `backend/test/contracts/sessionRouteInputTypes.test.ts`

- [ ] **Step 1: Write the failing session contract test**

Create `backend/test/contracts/sessionRouteInputTypes.test.ts` with imports like:

```ts
import type { CreateSessionInput, ContinueSessionBody } from '../../src/types/dto/sessions.ts';
import type { BroadcastPayload, SessionChannel, WebSocketPayload } from '../../src/types/ws/sessions.ts';
```

Assert example assignments compile:

```ts
const createInput: CreateSessionInput = { task_id: 1, initial_prompt: 'continue' };
const continueBody: ContinueSessionBody = { input: 'fix tests' };
const payload: WebSocketPayload = { type: 'subscribe', session_id: 1, channel: 'output' };
const event: BroadcastPayload = { type: 'chunk', content: 'hello', stream: 'stdout' };
const channel: SessionChannel = 'status';
```

- [ ] **Step 2: Run the session contract test to verify the gap**

Run:

```bash
cd backend && node --import tsx --test test/contracts/sessionRouteInputTypes.test.ts
```

Expected:
- FAIL because the extracted session type modules do not exist yet

- [ ] **Step 3: Add explicit session DTO and WS type modules**

Create `backend/src/types/dto/sessions.ts` with explicit request/body contracts used by routes and services.

Create `backend/src/types/ws/sessions.ts` with explicit WebSocket/broadcast contracts used by routes and services, including a shared `SessionChannel` union and `BroadcastFn` type.

- [ ] **Step 4: Update session route and service to import the new types**

In `backend/src/routes/sessions.ts`:
- replace local `ContinueSessionBody`, `WebSocketPayload`, and `SessionFiltersQuery`
- reuse shared param/query imports from Task 1
- use Fastify body generics for session create/continue/input endpoints where possible

In `backend/src/services/sessionService.ts`:
- replace local `CreateSessionInput`, `BroadcastPayload`, and `BroadcastFn`
- keep `SessionLike`, `TaskLike`, and `SessionSubscriber` local unless one becomes unused and removable

- [ ] **Step 5: Re-run the session contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/sessionRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 6: Run focused verification for session bootstrapping**

Run:

```bash
cd backend && node --import tsx --test test/contracts/bootstrap.test.ts test/contracts/rootRoutes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit the session boundary type extraction**

```bash
git add backend/src/types/dto/sessions.ts backend/src/types/ws/sessions.ts backend/src/routes/sessions.ts backend/src/services/sessionService.ts backend/test/contracts/sessionRouteInputTypes.test.ts
git commit -m "refactor: extract session boundary types"
```

---

### Task 3: Extract workflow route DTOs and tighten route body types

**Files:**
- Create: `backend/src/types/dto/workflows.ts`
- Modify: `backend/src/routes/workflows.ts`
- Modify: `backend/src/routes/sessions.ts`
- Modify: `backend/src/routes/executions.ts`
- Create: `backend/test/contracts/workflowRouteInputTypes.test.ts`

- [ ] **Step 1: Write the failing workflow DTO contract test**

Create `backend/test/contracts/workflowRouteInputTypes.test.ts` with imports like:

```ts
import type { StartWorkflowBody } from '../../src/types/dto/workflows.ts';
import type { CreateSessionInput } from '../../src/types/dto/sessions.ts';
import type { CreateExecutionInput, UpdateExecutionInput } from '../../src/types/dto/executions.ts';
```

Assert example assignments compile:

```ts
const workflowBody: StartWorkflowBody = { task_id: 1 };
const sessionBody: CreateSessionInput = { task_id: 2 };
const executionCreate: CreateExecutionInput = { session_id: 3 };
const executionUpdate: UpdateExecutionInput = { status: 'RUNNING' };
```

- [ ] **Step 2: Run the workflow contract test to verify the gap**

Run:

```bash
cd backend && node --import tsx --test test/contracts/workflowRouteInputTypes.test.ts
```

Expected:
- FAIL because `StartWorkflowBody` does not exist yet and/or route boundary types are not fully centralized

- [ ] **Step 3: Add explicit workflow DTOs and remove route body casts**

Create `backend/src/types/dto/workflows.ts` with explicit route input types.

Update:
- `backend/src/routes/workflows.ts` to import `StartWorkflowBody` and shared HTTP types
- `backend/src/routes/sessions.ts` to type the create body with `CreateSessionInput`
- `backend/src/routes/executions.ts` to import execution DTOs directly from `src/types/dto/executions.ts` and type the create/update bodies with Fastify generics instead of body casts/fallback object coercion

- [ ] **Step 4: Re-run the workflow DTO contract test**

Run:

```bash
cd backend && node --import tsx --test test/contracts/workflowRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Run focused typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Commit the workflow and route body tightening**

```bash
git add backend/src/types/dto/workflows.ts backend/src/routes/workflows.ts backend/src/routes/sessions.ts backend/src/routes/executions.ts backend/test/contracts/workflowRouteInputTypes.test.ts
git commit -m "refactor: extract workflow and route body types"
```

---

### Task 4: Tighten task-source shared service contract outputs

**Files:**
- Modify: `backend/src/types/sources.ts`
- Modify: `backend/src/types/fastify.ts`
- Modify: `backend/src/services/taskSourceService.ts`
- Create: `backend/test/contracts/taskSourceSharedTypes.test.ts`
- Test: `backend/test/contracts/taskSourceFastifyContract.test.ts`
- Test: `backend/test/routes/taskSourcesRoutes.test.ts`

- [ ] **Step 1: Write the failing task-source shared type test**

Create `backend/test/contracts/taskSourceSharedTypes.test.ts` with imports like:

```ts
import type { TaskSourceSyncResultItem } from '../../src/types/sources.ts';
```

Assert example assignments compile:

```ts
const resultItem: TaskSourceSyncResultItem = {
  id: 1,
  project_id: 2,
  title: 'Imported issue',
  status: 'TODO',
};
```

The exact shape should match what `taskSourceService.sync()` actually returns today.

- [ ] **Step 2: Run the task-source shared type test to verify the gap**

Run:

```bash
cd backend && node --import tsx --test test/contracts/taskSourceSharedTypes.test.ts
```

Expected:
- FAIL because the named sync result item type does not exist yet

- [ ] **Step 3: Add a named task-source sync result type**

Update `backend/src/types/sources.ts` to export a specific sync result item type that matches the current service behavior.

Update `backend/src/services/taskSourceService.ts` to use that named type instead of `Array<Record<string, unknown>>`.

Update `backend/src/types/fastify.ts` so `TaskSourceServiceContract.sync()` returns `Promise<TaskSourceSyncResultItem[]>`.

- [ ] **Step 4: Re-run compile-time and runtime task-source checks**

Run:

```bash
cd backend && node --import tsx --test test/contracts/taskSourceSharedTypes.test.ts test/contracts/taskSourceFastifyContract.test.ts test/routes/taskSourcesRoutes.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Run focused typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected:
- PASS

- [ ] **Step 6: Commit the task-source service contract tightening**

```bash
git add backend/src/types/sources.ts backend/src/types/fastify.ts backend/src/services/taskSourceService.ts backend/test/contracts/taskSourceSharedTypes.test.ts backend/test/contracts/taskSourceFastifyContract.test.ts backend/test/routes/taskSourcesRoutes.test.ts
git commit -m "refactor: tighten task source service types"
```

---

### Task 5: Add explicit persistence input types for projects, tasks, and iterations

**Files:**
- Create: `backend/src/types/persistence/projects.ts`
- Create: `backend/src/types/persistence/tasks.ts`
- Create: `backend/src/types/persistence/iterations.ts`
- Modify: `backend/src/repositories/projectRepository.ts`
- Modify: `backend/src/repositories/taskRepository.ts`
- Modify: `backend/src/repositories/iterationRepository.ts`
- Modify: `backend/src/services/projectService.ts`
- Modify: `backend/src/services/taskService.ts`
- Modify: `backend/src/services/iterationService.ts`
- Create: `backend/test/contracts/persistenceInputTypes.test.ts`

- [ ] **Step 1: Write the failing persistence contract test**

Create `backend/test/contracts/persistenceInputTypes.test.ts` with imports like:

```ts
import type { ProjectCreateRecord, ProjectUpdateRecord } from '../../src/types/persistence/projects.ts';
import type { TaskCreateRecord, TaskUpdateRecord } from '../../src/types/persistence/tasks.ts';
import type { IterationCreateRecord, IterationUpdateRecord } from '../../src/types/persistence/iterations.ts';
```

Assert example assignments compile:

```ts
const projectCreate: ProjectCreateRecord = { name: 'Platform' };
const projectUpdate: ProjectUpdateRecord = { local_path: '/repo' };
const taskCreate: TaskCreateRecord = { project_id: 1, title: 'Fix typing', status: 'TODO' };
const taskUpdate: TaskUpdateRecord = { order: 2 };
const iterationCreate: IterationCreateRecord = { project_id: 1, name: 'Sprint 1' };
const iterationUpdate: IterationUpdateRecord = { status: 'ACTIVE' };
```

- [ ] **Step 2: Run the persistence contract test to verify the gap**

Run:

```bash
cd backend && node --import tsx --test test/contracts/persistenceInputTypes.test.ts
```

Expected:
- FAIL because the persistence type modules do not exist yet

- [ ] **Step 3: Add explicit persistence input type modules**

Create the three persistence modules with explicit write contracts matching the repositories’ current behavior.

Example shape direction:

```ts
export interface ProjectCreateRecord {
  name: string;
  description?: string;
  git_url?: string;
  local_path?: string;
}
```

Do the same for task and iteration create/update write shapes.

- [ ] **Step 4: Update repositories to consume persistence types**

Update:
- `backend/src/repositories/projectRepository.ts`
- `backend/src/repositories/taskRepository.ts`
- `backend/src/repositories/iterationRepository.ts`

Use the explicit persistence input types in the `BaseRepository<...>` generic parameters instead of inline `Omit<...>` / `Partial<...>`.

- [ ] **Step 5: Update services to map DTOs to persistence types without `as unknown as`**

Update:
- `backend/src/services/projectService.ts`
- `backend/src/services/taskService.ts`
- `backend/src/services/iterationService.ts`

Replace each `as unknown as ...` cast with an explicit object assignment or typed variable matching the new persistence input contracts.

- [ ] **Step 6: Re-run persistence and focused regression tests**

Run:

```bash
cd backend && node --import tsx --test test/contracts/persistenceInputTypes.test.ts test/contracts/projectRouteInputTypes.test.ts test/contracts/taskRouteInputTypes.test.ts test/contracts/iterationRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 7: Run typecheck and build**

Run:

```bash
cd backend && npm run typecheck && npm run build
```

Expected:
- PASS

- [ ] **Step 8: Commit the persistence contract extraction**

```bash
git add backend/src/types/persistence/projects.ts backend/src/types/persistence/tasks.ts backend/src/types/persistence/iterations.ts backend/src/repositories/projectRepository.ts backend/src/repositories/taskRepository.ts backend/src/repositories/iterationRepository.ts backend/src/services/projectService.ts backend/src/services/taskService.ts backend/src/services/iterationService.ts backend/test/contracts/persistenceInputTypes.test.ts
git commit -m "refactor: extract repository persistence input types"
```

---

### Task 6: Final verification for the whole extraction wave

**Files:**
- Verify only: all files above

- [ ] **Step 1: Run all new and touched compile-time contract tests**

Run:

```bash
cd backend && node --import tsx --test test/contracts/httpRouteSharedTypes.test.ts test/contracts/sessionRouteInputTypes.test.ts test/contracts/workflowRouteInputTypes.test.ts test/contracts/taskSourceSharedTypes.test.ts test/contracts/taskSourceFastifyContract.test.ts test/contracts/persistenceInputTypes.test.ts test/contracts/projectRouteInputTypes.test.ts test/contracts/taskRouteInputTypes.test.ts test/contracts/iterationRouteInputTypes.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run focused runtime regressions**

Run:

```bash
cd backend && node --import tsx --test test/contracts/bootstrap.test.ts test/contracts/rootRoutes.test.ts test/routes/taskSourcesRoutes.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Run full typecheck**

Run:

```bash
cd backend && npm run typecheck
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

- [ ] **Step 5: Audit for leftover target patterns**

Run:

```bash
git -C "/d/workspace/devops-kanban" grep -nE "type ParamsWithId =|type ParamsWithTaskId =|type ParamsWithSessionId =|type QueryWithProjectId =|type QueryWithTaskId =|type ContinueSessionBody =|type WebSocketPayload =|type BroadcastPayload =|type CreateSessionInput =|as unknown as Omit<ProjectEntity|as unknown as Omit<TaskEntity|as unknown as Omit<IterationEntity|as unknown as Partial<ProjectEntity|as unknown as Partial<TaskEntity|as unknown as Partial<IterationEntity|Promise<Record<string, unknown>\[\]>|Array<Record<string, unknown>>" -- backend || true
```

Expected:
- empty output, or only intentional non-target matches outside the scoped files

- [ ] **Step 6: Commit the verified extraction wave**

```bash
git add backend/src/types/http/params.ts backend/src/types/http/query.ts backend/src/types/dto/sessions.ts backend/src/types/ws/sessions.ts backend/src/types/dto/workflows.ts backend/src/types/persistence/projects.ts backend/src/types/persistence/tasks.ts backend/src/types/persistence/iterations.ts backend/src/types/sources.ts backend/src/types/fastify.ts backend/src/routes/projects.ts backend/src/routes/tasks.ts backend/src/routes/iterations.ts backend/src/routes/executions.ts backend/src/routes/taskSources.ts backend/src/routes/agents.ts backend/src/routes/workflows.ts backend/src/routes/sessions.ts backend/src/services/projectService.ts backend/src/services/taskService.ts backend/src/services/iterationService.ts backend/src/services/sessionService.ts backend/src/services/taskSourceService.ts backend/src/repositories/projectRepository.ts backend/src/repositories/taskRepository.ts backend/src/repositories/iterationRepository.ts backend/test/contracts/httpRouteSharedTypes.test.ts backend/test/contracts/sessionRouteInputTypes.test.ts backend/test/contracts/workflowRouteInputTypes.test.ts backend/test/contracts/taskSourceSharedTypes.test.ts backend/test/contracts/persistenceInputTypes.test.ts
git commit -m "refactor: extract shared backend boundary types"
```
