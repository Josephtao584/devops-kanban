# Backend TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire backend to strict TypeScript in one change set while preserving approved startup-route compatibility, normalizing `/api/**` response helpers, replacing source auto-discovery with a typed source registry, and keeping startup/testing workflows working.

**Architecture:** The migration introduces a typed app builder, a shared `src/types/` layer, strict repository/service/route contracts, and a typed source registry that replaces suffix-based runtime discovery. Implementation proceeds in the spec-approved order: toolchain/bootstrap, shared contracts, repositories, workflow/executors, remaining services plus source integration, routes/WebSocket contracts, full test migration, then final end-to-end verification.

**Tech Stack:** TypeScript, Node.js 22 ESM, Fastify 4, `tsx`, Node test runner, Zod, Mastra, JSON-file repositories

---

## File Structure Map

### New files to create
- `backend/tsconfig.json` — strict TypeScript compiler configuration for backend source/tests
- `backend/src/app.ts` — typed app builder (`buildApp`) that constructs/configures Fastify without starting the process
- `backend/src/types/api.ts` — API envelopes, `/` and `/health` exception types, WebSocket protocol types
- `backend/src/types/entities.ts` — persisted entity contracts derived from current runtime/on-disk behavior
- `backend/src/types/repositories.ts` — repository generics and create/update payload contracts
- `backend/src/types/workflow.ts` — workflow state/run/step/context contracts
- `backend/src/types/executors.ts` — executor config/result/registry contracts
- `backend/src/types/fastify.ts` — Fastify instance augmentation and route/plugin helpers
- `backend/src/types/sources.ts` — source registry/source descriptor/YAML-config contracts
- `backend/src/sources/registry.ts` — explicit typed source registry
- `backend/src/routes/sessionWebSocketStore.ts` — typed module boundary for session subscription state and protocol helpers
- `backend/test/helpers/buildApp.ts` — optional shared app-builder test helper if route/startup tests need one
- `backend/test/contracts/bootstrap.test.ts` — app-builder/bootstrap verification
- `backend/test/contracts/apiEnvelope.test.ts` — `/api/**` response envelope verification
- `backend/test/contracts/websocketProtocol.test.ts` — `/ws` contract verification
- `backend/test/contracts/configPaths.test.ts` — backend-root path default verification
- `backend/test/contracts/sourceRegistry.test.ts` — source registry init/failure verification

### Existing files to convert/modify

#### Entry / bootstrap
- `backend/src/main.js` → `backend/src/main.ts`
- `backend/package.json`
- `start.sh`
- `CLAUDE.md`

#### Config / middleware / utils
- `backend/src/config/index.js` → `backend/src/config/index.ts`
- `backend/src/config/taskSources.js` → `backend/src/config/taskSources.ts`
- `backend/src/middleware/cors.js` → `backend/src/middleware/cors.ts`
- `backend/src/middleware/errorHandler.js` → `backend/src/middleware/errorHandler.ts`
- `backend/src/utils/response.js` → `backend/src/utils/response.ts`
- `backend/src/utils/git.js` → `backend/src/utils/git.ts`

#### Repositories
- `backend/src/repositories/base.js` → `backend/src/repositories/base.ts`
- `backend/src/repositories/agentRepository.js` → `backend/src/repositories/agentRepository.ts`
- `backend/src/repositories/executionRepository.js` → `backend/src/repositories/executionRepository.ts`
- `backend/src/repositories/iterationRepository.js` → `backend/src/repositories/iterationRepository.ts`
- `backend/src/repositories/projectRepository.js` → `backend/src/repositories/projectRepository.ts`
- `backend/src/repositories/sessionRepository.js` → `backend/src/repositories/sessionRepository.ts`
- `backend/src/repositories/taskRepository.js` → `backend/src/repositories/taskRepository.ts`
- `backend/src/repositories/taskSourceRepository.js` → `backend/src/repositories/taskSourceRepository.ts`
- `backend/src/repositories/workflowRunRepository.js` → `backend/src/repositories/workflowRunRepository.ts`
- `backend/src/repositories/workflowTemplateRepository.js` → `backend/src/repositories/workflowTemplateRepository.ts`

#### Services (non-workflow)
- `backend/src/services/executionService.js` → `backend/src/services/executionService.ts`
- `backend/src/services/iterationService.js` → `backend/src/services/iterationService.ts`
- `backend/src/services/projectService.js` → `backend/src/services/projectService.ts`
- `backend/src/services/sessionService.js` → `backend/src/services/sessionService.ts`
- `backend/src/services/taskService.js` → `backend/src/services/taskService.ts`
- `backend/src/services/taskSourceService.js` → `backend/src/services/taskSourceService.ts`

#### Workflow services
- `backend/src/services/workflow/workflowService.js` → `backend/src/services/workflow/workflowService.ts`
- `backend/src/services/workflow/workflows.js` → `backend/src/services/workflow/workflows.ts`
- `backend/src/services/workflow/workflowExecutionContext.js` → `backend/src/services/workflow/workflowExecutionContext.ts`
- `backend/src/services/workflow/workflowPromptAssembler.js` → `backend/src/services/workflow/workflowPromptAssembler.ts`
- `backend/src/services/workflow/workflowStepExecutor.js` → `backend/src/services/workflow/workflowStepExecutor.ts`
- `backend/src/services/workflow/workflowTemplateService.js` → `backend/src/services/workflow/workflowTemplateService.ts`
- `backend/src/services/workflow/agentExecutorRegistry.js` → `backend/src/services/workflow/agentExecutorRegistry.ts`
- `backend/src/services/workflow/stepResultAdapter.js` → `backend/src/services/workflow/stepResultAdapter.ts`
- `backend/src/services/workflow/executors/claudeCodeExecutor.js` → `backend/src/services/workflow/executors/claudeCodeExecutor.ts`
- `backend/src/services/workflow/executors/claudeStepResult.js` → `backend/src/services/workflow/executors/claudeStepResult.ts`
- `backend/src/services/workflow/executors/claudeStepRunner.js` → `backend/src/services/workflow/executors/claudeStepRunner.ts`
- `backend/src/services/workflow/executors/codexExecutor.js` → `backend/src/services/workflow/executors/codexExecutor.ts`
- `backend/src/services/workflow/executors/commandResolver.js` → `backend/src/services/workflow/executors/commandResolver.ts`
- `backend/src/services/workflow/executors/opencodeExecutor.js` → `backend/src/services/workflow/executors/opencodeExecutor.ts`

#### Sources
- `backend/src/sources/base.js` → `backend/src/sources/base.ts`
- `backend/src/sources/github.js` → `backend/src/sources/github.ts`
- `backend/src/sources/gitlab.js` → `backend/src/sources/gitlab.ts`
- `backend/src/sources/index.js` → `backend/src/sources/index.ts`

#### Routes
- `backend/src/routes/agents.js` → `backend/src/routes/agents.ts`
- `backend/src/routes/executions.js` → `backend/src/routes/executions.ts`
- `backend/src/routes/git.js` → `backend/src/routes/git.ts`
- `backend/src/routes/iterations.js` → `backend/src/routes/iterations.ts`
- `backend/src/routes/members.js` → `backend/src/routes/members.ts`
- `backend/src/routes/projects.js` → `backend/src/routes/projects.ts`
- `backend/src/routes/roles.js` → `backend/src/routes/roles.ts`
- `backend/src/routes/sessions.js` → `backend/src/routes/sessions.ts`
- `backend/src/routes/tasks.js` → `backend/src/routes/tasks.ts`
- `backend/src/routes/taskSources.js` → `backend/src/routes/taskSources.ts`
- `backend/src/routes/taskWorktree.js` → `backend/src/routes/taskWorktree.ts`
- `backend/src/routes/workflows.js` → `backend/src/routes/workflows.ts`
- `backend/src/routes/workflowTemplate.js` → `backend/src/routes/workflowTemplate.ts`

#### Tests
- `backend/test/agentExecutorRegistry.test.js` → `backend/test/agentExecutorRegistry.test.ts`
- `backend/test/claudeStepResult.test.js` → `backend/test/claudeStepResult.test.ts`
- `backend/test/claudeStepRunner.test.js` → `backend/test/claudeStepRunner.test.ts`
- `backend/test/commandResolver.test.js` → `backend/test/commandResolver.test.ts`
- `backend/test/stepResultAdapter.test.js` → `backend/test/stepResultAdapter.test.ts`
- `backend/test/taskFixture.test.js` → `backend/test/taskFixture.test.ts`
- `backend/test/workflowPromptAssembler.test.js` → `backend/test/workflowPromptAssembler.test.ts`
- `backend/test/workflowService.test.js` → `backend/test/workflowService.test.ts`
- `backend/test/workflowStepExecutor.test.js` → `backend/test/workflowStepExecutor.test.ts`
- `backend/test/workflowTemplateRoutes.test.js` → `backend/test/workflowTemplateRoutes.test.ts`
- `backend/test/workflowTemplateService.test.js` → `backend/test/workflowTemplateService.test.ts`
- `backend/test/adapters/github.test.js` → `backend/test/sources/github.test.ts`
- `backend/test/adapters/registry.test.js` → `backend/test/sources/registry.test.ts`
- `backend/test/config/taskSources.test.js` → `backend/test/config/taskSources.test.ts`
- `backend/test/routes/taskSources.test.js` → `backend/test/routes/taskSources.test.ts`
- `backend/test/services/taskSourceService.test.js` → `backend/test/services/taskSourceService.test.ts`

---

## Inventory-to-Task Mapping

### Task ownership matrix
- **Task 1:** `backend/package.json`, `backend/tsconfig.json`, `backend/src/app.ts`, `backend/src/main.ts`, `start.sh`, `CLAUDE.md`, `backend/test/contracts/bootstrap.test.ts`
- **Task 2:** `backend/src/types/**`, `backend/test/contracts/rootRoutes.test.ts`, `backend/test/contracts/apiEnvelope.test.ts`, `backend/test/contracts/websocketProtocol.test.ts`, `backend/test/contracts/configPaths.test.ts`, `backend/test/contracts/sourceRegistry.test.ts`; contract inventory is captured directly in these test files plus the corresponding `src/types/**` modules
- **Task 3:** `backend/src/repositories/**`
- **Task 4:** `backend/src/services/workflow/**`
- **Task 5:** `backend/src/config/**`, `backend/src/middleware/**`, `backend/src/utils/response.ts`, `backend/src/utils/git.ts`, `backend/src/sources/**`, `backend/src/services/taskSourceService.ts`
- **Task 6:** `backend/src/services/projectService.ts`, `backend/src/services/executionService.ts`, `backend/src/services/iterationService.ts`, `backend/src/services/taskService.ts`, `backend/src/services/sessionService.ts`
- **Task 7:** `backend/src/routes/**`, `backend/src/routes/sessionWebSocketStore.ts`, `backend/src/app.ts` integration updates
- **Task 8:** `backend/test/**/*.ts`, test path renames, app-builder test helper alignment
- **Task 9:** final repo-wide verification only

### Preflight rule
Before implementation begins, verify every listed JS source/test file exists in the repo and record the exact conversion list. If a listed file is missing or renamed, stop and resolve the discrepancy before touching implementation.

---

## Required contract inventories before implementation expands

### API contract inventory to produce in Task 2
Implementation must create a concrete route contract matrix covering:
- `/`
- `/health`
- `/ws`
- all `/api/**` routes

For each route record:
- params
- query
- body
- success response shape
- error response shape
- envelope exception or normalization rule

### Entity/repository source-of-truth rule
Persisted entity types must be derived from current on-disk JSON shape and current runtime behavior first. If any normalization is desired later, it must be listed as a separate intentional contract change rather than folded silently into the migration.

### Source registry contract to produce in Task 2
Implementation must define:
- registry registration API
- source descriptor shape
- YAML-backed source integration path
- startup initialization order
- fail-fast conditions when source registration/config loading fails

### WebSocket protocol inventory to produce in Task 2
Implementation must define a protocol table for `/ws` covering:
- supported client messages
- subscribe/destination variants
- stdin/input variants
- server push event types
- payload fields for output/status messages
- error/disconnect behavior

---

### Task 1: Establish TypeScript toolchain and typed bootstrap skeleton

**Files:**
- Create: `backend/tsconfig.json`
- Create: `backend/src/app.ts`
- Modify: `backend/package.json`
- Modify: `backend/src/main.js` → `backend/src/main.ts`
- Modify: `start.sh`
- Modify: `CLAUDE.md`
- Test: `backend/test/contracts/bootstrap.test.ts`

- [ ] **Step 1: Write the failing startup/bootstrap contract test**

Create a bootstrap-specific test that imports the planned app builder and asserts the app can be constructed without starting the server.

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../../src/app.js'

test('buildApp constructs a Fastify instance without listening', async () => {
  const app = await buildApp()
  assert.equal(typeof app.listen, 'function')
  await app.close()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --import tsx --test test/contracts/bootstrap.test.ts`
Expected: FAIL because `buildApp` and TypeScript bootstrap files do not exist

- [ ] **Step 3: Add TypeScript tooling and strict compiler config**

Implement:
- `typescript`, `tsx`, `@types/node`
- `engines.node` for Node 22
- scripts: `dev`, `build`, `start`, `test`, `typecheck`
- `backend/tsconfig.json` with the spec settings

- [ ] **Step 4: Split app construction from process startup**

Implement:
- `buildApp` in `backend/src/app.ts`
- `backend/src/main.ts` startup wrapper
- explicit workflow initialization path before `listen`

- [ ] **Step 5: Update collateral startup instructions**

Implement:
- `start.sh` TypeScript-based backend flow + Node 22 check
- backend command references in `CLAUDE.md`

- [ ] **Step 6: Run focused verification**

Run:
- `cd backend && node --import tsx --test test/contracts/bootstrap.test.ts`
- `cd backend && npm run typecheck || true`
- `cd backend && npm run build || true`

Expected:
- bootstrap test PASS
- `typecheck` / `build` may still fail at this stage because broader backend modules are not yet converted

---

### Task 2: Add shared type system and produce executable inventories

**Files:**
- Create: `backend/src/types/api.ts`
- Create: `backend/src/types/entities.ts`
- Create: `backend/src/types/repositories.ts`
- Create: `backend/src/types/workflow.ts`
- Create: `backend/src/types/executors.ts`
- Create: `backend/src/types/fastify.ts`
- Create: `backend/src/types/sources.ts`
- Create: `backend/test/contracts/apiEnvelope.test.ts`
- Create: `backend/test/contracts/websocketProtocol.test.ts`
- Create: `backend/test/contracts/configPaths.test.ts`
- Create: `backend/test/contracts/sourceRegistry.test.ts`

- [ ] **Step 1: Write failing contract tests for route/config/source boundaries**

Add tests for:
- `/` exact response shape
- `/health` exact response shape
- `/api/**` envelope shape with `error`
- backend-root path defaults
- source registry startup behavior
- `/ws` protocol parsing/serialization helper boundaries

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend
node --import tsx --test test/contracts/rootRoutes.test.ts test/contracts/apiEnvelope.test.ts test/contracts/configPaths.test.ts test/contracts/sourceRegistry.test.ts test/contracts/websocketProtocol.test.ts
```
Expected: FAIL because shared contracts/types do not yet exist

- [ ] **Step 3: Build the authoritative preflight inventory**

Record the exact file-by-file conversion list for:
- routes
- repositories
- services
- workflow files
- source files
- tests

Stop if repo contents drift from the spec inventory.

- [ ] **Step 4: Implement shared type modules**

Define:
- API envelope + `/` + `/health` + `/ws` protocol types
- entity/repository contracts
- workflow/executor contracts
- Fastify augmentations
- source registry contracts

- [ ] **Step 5: Run focused verification**

Run:
- `cd backend && node --import tsx --test test/contracts/rootRoutes.test.ts test/contracts/apiEnvelope.test.ts test/contracts/configPaths.test.ts test/contracts/sourceRegistry.test.ts test/contracts/websocketProtocol.test.ts`
- `cd backend && npm run typecheck || true`

Expected:
- contract tests compile against the new shared type surface
- `typecheck` may still fail at this stage because repositories, services, and routes are not yet fully converted

---

### Task 3: Type the repository foundation and persistent entities

**Files:**
- Modify+rename: all files under `backend/src/repositories/*.js`
- Test: representative repository tests added or updated under `backend/test/`

- [ ] **Step 1: Write a failing representative repository behavior test**

Choose one CRUD-heavy repository and verify create/find/update behavior against the typed base repository contract.

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
cd backend
node --import tsx --test test/taskFixture.test.ts test/workflowService.test.ts
```
Expected: FAIL due to JS/typing mismatch or missing typed contracts in the repository/service chain

- [ ] **Step 3: Implement typed `BaseRepository`**

Implement:
- generic entity shape
- typed create/update payloads
- typed CRUD results
- persisted entity types derived from current data/runtime shape first

- [ ] **Step 4: Convert all concrete repositories**

Apply the entity contracts to every repository in `backend/src/repositories/**`.

- [ ] **Step 5: Run focused verification**

Run:
```bash
cd backend
node --import tsx --test test/taskFixture.test.ts test/workflowService.test.ts
npm run typecheck || true
```
Expected:
- repository behavior tests PASS
- any remaining `typecheck` failures should be limited to still-unconverted downstream modules

---

### Task 4: Convert workflow and executor stack to strict TypeScript

**Files:**
- Modify+rename: all files under `backend/src/services/workflow/**`
- Test: workflow/executor tests under `backend/test/*.test.ts`

- [ ] **Step 1: Write or tighten failing workflow contract tests**

Ensure tests cover:
- workflow state
- step input/output
- executor config/result shapes
- template contracts
- prompt assembly contracts

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
cd backend
node --import tsx --test test/workflowService.test.ts test/workflowStepExecutor.test.ts test/workflowTemplateService.test.ts test/workflowTemplateRoutes.test.ts test/agentExecutorRegistry.test.ts test/claudeStepRunner.test.ts test/claudeStepResult.test.ts test/commandResolver.test.ts test/stepResultAdapter.test.ts test/workflowPromptAssembler.test.ts
```
Expected: FAIL because workflow files are not yet TypeScript/strictly typed

- [ ] **Step 3: Convert workflow shared contracts first**

Wire `src/types/workflow.ts` + `src/types/executors.ts` into the subtree.

- [ ] **Step 4: Convert workflow services and executors minimally**

Do not redesign behavior beyond what strict typing requires.

- [ ] **Step 5: Run focused verification**

Run the workflow/executor test suite + `cd backend && npm run typecheck`
Expected: PASS

---

### Task 5: Convert config, middleware, utils, and source integration prerequisites

**Files:**
- Modify+rename: `backend/src/config/index.js` → `backend/src/config/index.ts`
- Modify+rename: `backend/src/config/taskSources.js` → `backend/src/config/taskSources.ts`
- Modify+rename: `backend/src/middleware/cors.js` → `backend/src/middleware/cors.ts`
- Modify+rename: `backend/src/middleware/errorHandler.js` → `backend/src/middleware/errorHandler.ts`
- Modify+rename: `backend/src/utils/response.js` → `backend/src/utils/response.ts`
- Modify+rename: `backend/src/utils/git.js` → `backend/src/utils/git.ts`
- Create: `backend/src/sources/registry.ts`
- Modify+rename: all files under `backend/src/sources/**`
- Modify: `backend/src/services/taskSourceService.ts`
- Test: `backend/test/config/taskSources.test.ts`
- Test: `backend/test/sources/registry.test.ts`
- Test: `backend/test/sources/github.test.ts`
- Test: `backend/test/services/taskSourceService.test.ts`
- Test: `backend/test/contracts/configPaths.test.ts`
- Test: `backend/test/contracts/sourceRegistry.test.ts`

- [ ] **Step 1: Write failing config/source/worktree behavior tests**

Cover:
- backend-root-relative path defaults
- typed source registry registration and fail-fast init
- YAML-backed universal-source path still supported
- `utils/git` worktree path/branch behavior remains intact

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
cd backend
node --import tsx --test test/config/taskSources.test.ts test/sources/registry.test.ts test/sources/github.test.ts test/services/taskSourceService.test.ts test/contracts/configPaths.test.ts test/contracts/sourceRegistry.test.ts
```
Expected: FAIL because config/helpers/source registry are not yet converted

- [ ] **Step 3: Implement backend-root path helpers and typed response helpers**

Implement:
- backend-root resolution
- `<backend-root>/../data`
- `<backend-root>/../task-sources/config.yaml`
- normalized `/api/**` response helper types in `utils/response.ts`

- [ ] **Step 4: Convert `utils/git.ts` and verify worktree behavior contracts**

Keep existing worktree behavior while adding strict types.

- [ ] **Step 5: Replace source auto-discovery with explicit typed registry**

Implement only the approved migration surface:
- code-defined source registration in code
- YAML-driven universal-source path in registry model
- fail-fast initialization behavior
- no filesystem suffix discovery

Non-goals for this task:
- no redesign of source fetching semantics
- no change to source-specific business behavior beyond what strict typing and explicit registry wiring require
- no change to YAML contract semantics beyond the typed registry integration needed by the spec

- [ ] **Step 6: Integrate source registry with task source service**

Update task source service/config access to the explicit registry path.

- [ ] **Step 7: Run focused verification**

Run the source/config/service test suite + `cd backend && npm run typecheck`
Expected: PASS

---

### Task 6: Convert remaining core services to TypeScript

**Files:**
- Modify+rename: `backend/src/services/projectService.js` → `backend/src/services/projectService.ts`
- Modify+rename: `backend/src/services/executionService.js` → `backend/src/services/executionService.ts`
- Modify+rename: `backend/src/services/iterationService.js` → `backend/src/services/iterationService.ts`
- Modify+rename: `backend/src/services/taskService.js` → `backend/src/services/taskService.ts`
- Modify+rename: `backend/src/services/sessionService.js` → `backend/src/services/sessionService.ts`
- Tests: related service/route contract tests

- [ ] **Step 1: Write failing service behavior tests where coverage is weak**

Focus on:
- `taskService`
- `sessionService`
- `iterationService`
- any behavior tied to typed worktree/session boundaries

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
cd backend
node --import tsx --test test/services/taskSourceService.test.ts test/workflowService.test.ts test/workflowTemplateService.test.ts
```
Expected: FAIL due to JS/typing mismatch or missing typed contracts in the service layer

- [ ] **Step 3: Convert lower-risk services first**

Convert `projectService`, `executionService`, `iterationService`.

- [ ] **Step 4: Convert mixed-responsibility services**

Convert `taskService` and `sessionService` with only targeted cleanup required by strict typing.

- [ ] **Step 5: Run focused verification**

Run:
```bash
cd backend
node --import tsx --test test/services/taskSourceService.test.ts test/workflowService.test.ts test/workflowTemplateService.test.ts
npm run typecheck || true
```
Expected:
- converted service behavior tests PASS
- any remaining `typecheck` failures should be limited to still-unconverted route/test modules

---

### Task 7: Convert routes, normalize `/api/**`, and type `/ws`

**Files:**
- Modify+rename: all files under `backend/src/routes/*.js`
- Modify: `backend/src/app.ts`
- Create: `backend/src/routes/sessionWebSocketStore.ts`
- Test: `backend/test/contracts/rootRoutes.test.ts`
- Test: `backend/test/contracts/apiEnvelope.test.ts`
- Test: `backend/test/contracts/websocketProtocol.test.ts`
- Test: existing route tests under `backend/test/routes/**`

- [ ] **Step 1: Write failing route contract tests**

Required coverage:
- `/` exact preserved shape
- `/health` exact preserved shape
- `/api/**` normalized envelope shape including `error`
- `/ws` subscribe/input/server-push protocol behavior

- [ ] **Step 2: Run tests to verify failure**

Run:
```bash
cd backend
node --import tsx --test test/contracts/rootRoutes.test.ts test/contracts/apiEnvelope.test.ts test/contracts/websocketProtocol.test.ts test/routes/taskSources.test.ts
```
Expected: FAIL because routes are still JS and helper shapes are inconsistent

- [ ] **Step 3: Convert routes with explicit Fastify generics**

Apply shared DTOs + explicit params/query/body/response contracts.

- [ ] **Step 4: Normalize `/api/**` response helpers only**

Remove route-local helper variants and use shared typed response helpers for `/api/**`.
Do not change `/` or `/health`.

- [ ] **Step 5: Extract and type WebSocket state boundary**

Implement `sessionWebSocketStore.ts` (or equivalent) to hold:
- subscription state
- typed subscribe/input handlers
- server push payload helpers

- [ ] **Step 6: Wire `/ws` route to typed protocol contract**

Preserve:
- endpoint `/ws`
- session/channel protocol behavior
- server push fields built around `sessionId`, `channel`, and stream/status data

- [ ] **Step 7: Run focused verification**

Run:
```bash
cd backend
node --import tsx --test test/contracts/rootRoutes.test.ts test/contracts/apiEnvelope.test.ts test/contracts/websocketProtocol.test.ts test/routes/taskSources.test.ts
npm run typecheck
```
Expected: PASS

---

### Task 8: Convert all backend tests to TypeScript and align naming

**Files:**
- Modify+rename: all remaining `backend/test/**/*.js` files to `.ts`
- Rename: `backend/test/adapters/**` → `backend/test/sources/**`
- Modify imports/helpers for `node --import tsx --test`

- [ ] **Step 1: Run the final test command before conversion**

Run: `cd backend && npm test`
Expected: FAIL until all test files/imports are aligned

- [ ] **Step 2: Convert and rename every remaining test file**

Make test imports follow NodeNext `.js` specifier rules.

- [ ] **Step 3: Update terminology from adapters → sources in tests**

Preserve behavior; just align naming with the approved canonical term.

- [ ] **Step 4: Run focused verification**

Run: `cd backend && npm test`
Expected: PASS

---

### Task 9: Final end-to-end verification

**Files:**
- Verify: `backend/package.json`, `backend/tsconfig.json`, `backend/src/**`, `backend/test/**`, `start.sh`, `CLAUDE.md`

- [ ] **Step 1: Re-run preflight inventory reconciliation**

Verify every original JS source/test file has been converted or intentionally removed.

- [ ] **Step 2: Run typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `cd backend && npm run build`
Expected: PASS and emit `dist/src/main.js`

- [ ] **Step 4: Run full test suite**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 5: Verify root route and health route**

Run the contract suite:
```bash
cd backend
node --import tsx --test test/contracts/rootRoutes.test.ts
```
Expected:
- `/` returns the exact preserved shape with `success`, `message`, `version`, `data.endpoints`
- `/health` returns `{ status: 'ok' }`

- [ ] **Step 6: Verify normalized `/api/**` envelope and `/ws` protocol**

Run:
```bash
cd backend
node --import tsx --test test/contracts/apiEnvelope.test.ts test/contracts/websocketProtocol.test.ts
```
Expected:
- `/api/**` responses use `{ success, message, data, error }`
- `/ws` endpoint and protocol remain functional

- [ ] **Step 7: Verify backend-root path defaults and source registry fail-fast behavior**

Run:
```bash
cd backend
node --import tsx --test test/contracts/configPaths.test.ts test/contracts/sourceRegistry.test.ts
```
Expected:
- backend-root-relative path defaults resolve correctly
- source registry startup behavior matches the spec

- [ ] **Step 8: Run compiled startup smoke test**

Run:
```bash
cd backend
npm run build
node dist/src/main.js &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
for i in {1..30}; do
  curl -sf http://localhost:8000/health && break
  sleep 1
done
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null || true
```
Expected: compiled server starts, `/health` responds successfully, and the process is terminated cleanly

- [ ] **Step 9: Run startup helper verification**

Run:
```bash
./start.sh &
START_PID=$!
trap "kill $START_PID 2>/dev/null" EXIT
for i in {1..30}; do
  curl -sf http://localhost:8000/health && break
  sleep 1
done
kill $START_PID
wait $START_PID 2>/dev/null || true
```
Expected: frontend/backend startup flow succeeds, backend responds on `/health`, and the helper can be stopped cleanly

---

## Final Verification Checklist

Run these commands in order before calling the migration complete:

```bash
cd backend
npm run typecheck
npm run build
npm test
node --import tsx --test test/contracts/rootRoutes.test.ts
node --import tsx --test test/contracts/apiEnvelope.test.ts test/contracts/websocketProtocol.test.ts
node --import tsx --test test/contracts/configPaths.test.ts test/contracts/sourceRegistry.test.ts
```

Then run the bounded smoke checks from repo root:

```bash
cd backend
npm run build
node dist/src/main.js &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT
for i in {1..30}; do
  curl -sf http://localhost:8000/health && break
  sleep 1
done
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null || true

cd ..
./start.sh &
START_PID=$!
trap "kill $START_PID 2>/dev/null" EXIT
for i in {1..30}; do
  curl -sf http://localhost:8000/health && break
  sleep 1
done
kill $START_PID
wait $START_PID 2>/dev/null || true
```

Expected acceptance evidence:
- Node 22 requirement is enforced via `engines.node` and startup helper check
- every originally inventoried backend JS source/test file is converted or intentionally removed
- `npm run typecheck` exits 0
- `npm run build` exits 0
- `npm test` exits 0
- compiled backend starts from `dist/src/main.js`
- `start.sh` still launches frontend + backend correctly
- `/` preserves the exact approved compatibility shape
- `/health` preserves `{ status: 'ok' }`
- `/api/**` normalized response helpers are active
- `/ws` endpoint and protocol remain functional
- backend-root-relative path defaults resolve correctly
- source registry replaces suffix-based discovery and fails fast on invalid startup state

---

## Notes for the implementing agent
- Use @superpowers:test-driven-development before implementing each task.
- Do not modify the approved spec during implementation; if a contradiction is discovered, stop and escalate for review.
- Derive persisted entity types from current runtime/on-disk behavior first; do not silently redesign stored shapes.
- Do not reintroduce filesystem suffix-based source discovery.
- Keep startup routes `/` and `/health` as approved compatibility exceptions.
- Normalize only `/api/**` response helpers.
- If an external library type blocks progress, isolate the compromise at the dependency boundary and document it in the diff.
