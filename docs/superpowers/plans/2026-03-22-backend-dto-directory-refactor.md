# Backend DTO Directory Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move public route/service DTOs into a dedicated `backend/src/types/dto/` directory and replace projected/inferred public input types with hand-written explicit field declarations.

**Architecture:** Add one DTO module per backend resource under `backend/src/types/dto/`, then update routes and services to import those DTOs instead of declaring `Parameters`, `Omit`, `Partial`, or `Record<string, unknown>`-based public request types inline. Keep runtime behavior unchanged: this is a type-boundary cleanup, not a repository or validation redesign.

**Tech Stack:** TypeScript, Fastify 4, Node test runner with `tsx`, existing JSON repositories/services.

---

## File Map

### New DTO modules
- Create: `backend/src/types/dto/projects.ts` — explicit `CreateProjectInput` / `UpdateProjectInput` derived from accepted route payload fields, not from `ProjectEntity` helpers
- Create: `backend/src/types/dto/tasks.ts` — explicit `CreateTaskInput` / `UpdateTaskInput` with hand-written task fields
- Create: `backend/src/types/dto/iterations.ts` — explicit `CreateIterationInput` / `UpdateIterationInput` with hand-written iteration fields
- Create: `backend/src/types/dto/executions.ts` — explicit `ExecutionMutableFields`, `CreateExecutionInput`, `UpdateExecutionInput`
- Create: `backend/src/types/dto/agents.ts` — explicit `CreateAgentBody` / `UpdateAgentBody`
- Create: `backend/src/types/dto/roles.ts` — explicit `CreateRoleBody` / `UpdateRoleBody` based on currently exercised role fields
- Create: `backend/src/types/dto/members.ts` — explicit `CreateMemberBody` / `UpdateMemberBody` based on currently exercised member fields
- Create: `backend/src/types/dto/taskSources.ts` — explicit `CreateTaskSourceInput`, `UpdateTaskSourceInput`, `TaskSourceImportBody`
- Create: `backend/src/types/dto/workflowTemplates.ts` — explicit `UpdateWorkflowTemplateInput` matching the current tested route/service contract
- Create: `backend/src/types/dto/management.ts` — optional shared file only if roles/members field sets stay tiny and clearly related; otherwise keep separate files

### Service files to modify
- Modify: `backend/src/services/projectService.ts` — import DTOs instead of local `Omit/Partial` aliases
- Modify: `backend/src/services/taskService.ts` — import DTOs instead of local `Omit/Partial` aliases; keep runtime defaults/validation unchanged
- Modify: `backend/src/services/iterationService.ts` — import DTOs instead of local `Omit/Partial` aliases
- Modify: `backend/src/services/executionService.ts` — import DTOs from the shared directory
- Modify: `backend/src/services/taskSourceService.ts` — replace `Record<string, unknown>` public input signatures with explicit DTOs from shared directory
- Modify: `backend/src/types/fastify.ts` — update `TaskSourceServiceContract` to use explicit task-source DTOs for `create` and `update`

### Route files to modify
- Modify: `backend/src/routes/agents.ts` — replace local `AgentBody` aliases with shared DTOs
- Modify: `backend/src/routes/roles.ts` — replace `StoredBaseRecord`/`RouteBody` aliases with shared hand-written DTOs
- Modify: `backend/src/routes/members.ts` — replace `StoredBaseRecord`/`RouteBody` aliases with shared hand-written DTOs
- Modify: `backend/src/routes/taskSources.ts` — replace route-local `TaskSourceImportBody` and `Record<string, unknown>` casts with shared DTOs
- Modify: `backend/src/routes/workflowTemplate.ts` — replace `Parameters<WorkflowTemplateService['updateTemplate']>[0]` with shared DTOs in both fallback builder and route body typing
- Modify: `backend/src/routes/projects.ts` — import project DTOs from shared directory if the route currently imports from service-local aliases
- Modify: `backend/src/routes/tasks.ts` — import task DTOs from shared directory if the route currently imports from service-local aliases
- Modify: `backend/src/routes/iterations.ts` — import iteration DTOs from shared directory if the route currently imports from service-local aliases

### Existing tests to modify
- Modify: `backend/test/contracts/projectRouteInputTypes.test.ts`
- Modify: `backend/test/contracts/taskRouteInputTypes.test.ts`
- Modify: `backend/test/contracts/iterationRouteInputTypes.test.ts`
- Modify: `backend/test/contracts/executionRouteInputTypes.test.ts`
- Create: `backend/test/contracts/managementRouteInputTypes.test.ts` — dedicated compile-time coverage for agents/roles/members DTOs
- Create: `backend/test/contracts/taskSourceRouteInputTypes.test.ts` — compile-time coverage for shared task-source DTOs
- Create: `backend/test/contracts/workflowTemplateDtoTypes.test.ts` — compile-time coverage for shared workflow-template DTOs
- Modify: `backend/test/contracts/taskSourceFastifyContract.test.ts`
- Modify: `backend/test/workflowTemplateRoutes.test.ts`
- Modify: `backend/test/workflowTemplateService.test.ts`
- Modify: `backend/test/services/taskSourceService.test.ts`
- Modify: `backend/test/routes/taskSourcesRoutes.test.ts`

---

### Task 1: Create shared DTO modules for projects, tasks, and iterations

**Files:**
- Create: `backend/src/types/dto/projects.ts`
- Create: `backend/src/types/dto/tasks.ts`
- Create: `backend/src/types/dto/iterations.ts`
- Modify: `backend/src/services/projectService.ts`
- Modify: `backend/src/services/taskService.ts`
- Modify: `backend/src/services/iterationService.ts`
- Modify: `backend/src/routes/projects.ts`
- Modify: `backend/src/routes/tasks.ts`
- Modify: `backend/src/routes/iterations.ts`
- Test: `backend/test/contracts/projectRouteInputTypes.test.ts`
- Test: `backend/test/contracts/taskRouteInputTypes.test.ts`
- Test: `backend/test/contracts/iterationRouteInputTypes.test.ts`

- [ ] **Step 1: Update the focused contract tests to import the new shared DTO modules**

```ts
import type { CreateProjectInput, UpdateProjectInput } from '../../src/types/dto/projects.ts';
import type { CreateTaskInput, UpdateTaskInput } from '../../src/types/dto/tasks.ts';
import type { CreateIterationInput, UpdateIterationInput } from '../../src/types/dto/iterations.ts';
```

- [ ] **Step 2: Run the focused contract tests to verify they fail before DTO module creation**

Run: `cd backend && node --import tsx --test test/contracts/projectRouteInputTypes.test.ts test/contracts/taskRouteInputTypes.test.ts test/contracts/iterationRouteInputTypes.test.ts`
Expected: FAIL with module-not-found or missing export errors for the new DTO files.

- [ ] **Step 3: Create hand-written DTO modules with explicit fields**

```ts
// backend/src/types/dto/projects.ts
export interface CreateProjectInput {
  name: string;
  description?: string;
  git_url?: string | null;
  local_path?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  git_url?: string | null;
  local_path?: string | null;
}
```

Repeat the same style for tasks and iterations: list fields directly; do not use `Omit`, `Partial`, `Parameters`, or `Record<string, unknown>` for these public DTOs.

- [ ] **Step 4: Update services and routes to import the shared DTOs**

```ts
import type { CreateProjectInput, UpdateProjectInput } from '../types/dto/projects.js';
```

Do the equivalent in task/iteration routes and services, removing local public DTO declarations entirely.

- [ ] **Step 5: Run the focused contract tests to verify they pass**

Run: `cd backend && node --import tsx --test test/contracts/projectRouteInputTypes.test.ts test/contracts/taskRouteInputTypes.test.ts test/contracts/iterationRouteInputTypes.test.ts`
Expected: PASS

### Task 2: Centralize execution DTOs in the shared directory

**Files:**
- Create: `backend/src/types/dto/executions.ts`
- Modify: `backend/src/services/executionService.ts`
- Modify: `backend/test/contracts/executionRouteInputTypes.test.ts`

- [ ] **Step 1: Extend the execution contract test to import shared execution DTOs**

```ts
import type {
  ExecutionMutableFields,
  CreateExecutionInput,
  UpdateExecutionInput,
} from '../../src/types/dto/executions.ts';
```

- [ ] **Step 2: Run the focused execution contract test to verify it fails**

Run: `cd backend && node --import tsx --test test/contracts/executionRouteInputTypes.test.ts`
Expected: FAIL because the new DTO module does not exist yet.

- [ ] **Step 3: Create the shared execution DTO module with explicit fields**

```ts
export interface ExecutionMutableFields {
  task_id?: number;
  status?: string;
  command?: string;
  output?: string;
  branch?: string;
  worktree_path?: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  agent_id?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateExecutionInput extends ExecutionMutableFields {
  session_id: number;
}

export interface UpdateExecutionInput extends ExecutionMutableFields {}
```

Only keep `Record<string, unknown>` where the field itself is truly dynamic data (`metadata`).

- [ ] **Step 4: Update `executionService.ts` to import DTOs from the new shared module**

- [ ] **Step 5: Run the focused execution contract test**

Run: `cd backend && node --import tsx --test test/contracts/executionRouteInputTypes.test.ts`
Expected: PASS

### Task 3: Discover and centralize agent, role, and member route DTOs

**Files:**
- Create: `backend/src/types/dto/agents.ts`
- Create: `backend/src/types/dto/roles.ts`
- Create: `backend/src/types/dto/members.ts`
- Modify: `backend/src/routes/agents.ts`
- Modify: `backend/src/routes/roles.ts`
- Modify: `backend/src/routes/members.ts`
- Create: `backend/test/contracts/managementRouteInputTypes.test.ts`
- Optional discovery reads during implementation: existing role/member usage in route tests, frontend API calls, and persisted sample data under `data/`

- [ ] **Step 1: Add a dedicated management DTO contract test that imports the new shared DTOs**

```ts
import type { CreateAgentBody, UpdateAgentBody } from '../../src/types/dto/agents.ts';
import type { CreateRoleBody, UpdateRoleBody } from '../../src/types/dto/roles.ts';
import type { CreateMemberBody, UpdateMemberBody } from '../../src/types/dto/members.ts';
```

- [ ] **Step 2: Run the management DTO contract test to verify it fails before DTO creation**

Run: `cd backend && node --import tsx --test test/contracts/managementRouteInputTypes.test.ts`
Expected: FAIL because the shared DTO files do not exist yet.

- [ ] **Step 3: Perform a discovery pass for role/member fields before freezing DTOs**

Check these sources of truth in order:
1. current route tests and contract tests
2. frontend API payload construction for roles/members
3. persisted sample data in `data/roles.json` and `data/members.json` if needed

Document the exact exercised fields, then write hand-written DTOs using only those fields. Do not invent new role/member fields from examples.

- [ ] **Step 4: Create explicit DTO files and update the route modules**

For agents, list the real fields directly instead of deriving from `AgentEntity`.

For roles and members, create `Create*Body` / `Update*Body` interfaces from the discovery step. If a field is not exercised anywhere authoritative, leave it out rather than speculating.

- [ ] **Step 5: Run the dedicated management DTO contract test**

Run: `cd backend && node --import tsx --test test/contracts/managementRouteInputTypes.test.ts`
Expected: PASS

### Task 4: Centralize workflow-template and task-source DTOs plus Fastify contract typing

**Files:**
- Create: `backend/src/types/dto/workflowTemplates.ts`
- Create: `backend/src/types/dto/taskSources.ts`
- Modify: `backend/src/routes/workflowTemplate.ts`
- Modify: `backend/src/routes/taskSources.ts`
- Modify: `backend/src/services/taskSourceService.ts`
- Modify: `backend/src/types/fastify.ts`
- Create: `backend/test/contracts/workflowTemplateDtoTypes.test.ts`
- Create: `backend/test/contracts/taskSourceRouteInputTypes.test.ts`
- Modify: `backend/test/contracts/taskSourceFastifyContract.test.ts`
- Modify: `backend/test/workflowTemplateRoutes.test.ts`
- Modify: `backend/test/workflowTemplateService.test.ts`
- Modify: `backend/test/services/taskSourceService.test.ts`
- Modify: `backend/test/routes/taskSourcesRoutes.test.ts`

- [ ] **Step 1: Add focused compile-time tests for shared workflow-template and task-source DTO imports**

Create two small contract tests:
- `test/contracts/workflowTemplateDtoTypes.test.ts`
- `test/contracts/taskSourceRouteInputTypes.test.ts`

Each should import the new shared DTOs and construct representative valid payloads.

- [ ] **Step 2: Run the new focused tests to verify they fail before DTO module creation**

Run: `cd backend && node --import tsx --test test/contracts/workflowTemplateDtoTypes.test.ts test/contracts/taskSourceRouteInputTypes.test.ts`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Create explicit DTO modules with hand-written fields**

For workflow templates, match the current `WorkflowTemplateService.updateTemplate` contract as exercised by `workflowTemplateRoutes.test.ts` and `workflowTemplateService.test.ts`, not just the route fallback helper. The shared DTO must mirror the existing full-template PUT payload exactly; do not narrow or expand accepted fields in this refactor.

For task sources, define explicit public create/update/import shapes based only on currently accepted inputs. `UpdateTaskSourceInput` should stay limited to the actually accepted transient update shape (`last_sync_at`) unless existing tests prove more. `CreateTaskSourceInput` should stay minimal and aligned with the current read-only behavior rather than assuming a full writable source-create schema. Keep only truly dynamic nested data dynamic (for example, source `config` if it is intentionally open-ended).

- [ ] **Step 4: Update route/service/Fastify contract files to use shared DTOs**

- Replace `Parameters<WorkflowTemplateService['updateTemplate']>[0]` in `workflowTemplate.ts`
- Replace `request.body as Record<string, unknown>` in `taskSources.ts`
- Replace `TaskSourceService.create/update` public signatures in `taskSourceService.ts`
- Update `TaskSourceServiceContract` in `src/types/fastify.ts` so the public decorated-service contract uses the same DTOs

- [ ] **Step 5: Run the focused workflow/task-source tests**

Run: `cd backend && node --import tsx --test test/contracts/workflowTemplateDtoTypes.test.ts test/contracts/taskSourceRouteInputTypes.test.ts test/contracts/taskSourceFastifyContract.test.ts test/routes/taskSourcesRoutes.test.ts test/workflowTemplateRoutes.test.ts test/workflowTemplateService.test.ts test/services/taskSourceService.test.ts`
Expected: PASS

### Task 5: Final verification of the DTO directory refactor

**Files:**
- Verify-only: all files touched above

- [ ] **Step 1: Run targeted contract tests**

Run: `cd backend && node --import tsx --test test/contracts/projectRouteInputTypes.test.ts test/contracts/taskRouteInputTypes.test.ts test/contracts/iterationRouteInputTypes.test.ts test/contracts/executionRouteInputTypes.test.ts test/contracts/managementRouteInputTypes.test.ts test/contracts/workflowTemplateDtoTypes.test.ts test/contracts/taskSourceRouteInputTypes.test.ts test/contracts/taskSourceFastifyContract.test.ts`
Expected: PASS

- [ ] **Step 2: Run route/service regressions that cover the touched boundaries**

Run: `cd backend && node --import tsx --test test/routes/taskSourcesRoutes.test.ts test/workflowTemplateRoutes.test.ts test/workflowTemplateService.test.ts test/services/taskSourceService.test.ts`
Expected: PASS

- [ ] **Step 3: Run typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `cd backend && npm run build`
Expected: PASS

- [ ] **Step 5: Audit for banned public DTO patterns only in the refactored boundaries**

Run: `cd backend && rg "Parameters<|Omit<|Partial<|Record<string, unknown>" src/routes src/services src/types/dto`
Expected: remaining matches, if any, are limited to internal helpers or genuinely dynamic nested value fields such as execution metadata; no remaining projected/inferred public request DTO declarations in the refactored route/service boundaries.
