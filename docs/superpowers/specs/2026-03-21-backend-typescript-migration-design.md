# Backend TypeScript Migration Design

## Goal
Perform a one-shot migration of the backend from JavaScript to TypeScript with `strict` type checking enabled, while preserving current backend behavior and making workflow, repository, and route boundaries explicitly typed.

## Scope
This migration covers the full backend codebase under `backend/`:
- `src/main`
- `src/routes`
- `src/services`
- `src/repositories`
- `src/adapters`
- `src/utils`
- `src/config`
- `src/middleware`
- backend tests under `backend/test`

This migration does **not** include frontend TypeScript work or unrelated feature refactors.

## Constraints
- One-shot migration: backend source and test files move to TypeScript in the same change set.
- Type quality target is high: enable strict TypeScript mode rather than allowing broad `any` usage.
- Keep runtime behavior stable; avoid feature work during migration.
- Only make boundary/structure cleanups that are necessary to support strict typing.
- Continue using the current Node ESM style rather than introducing a separate module system.

## Recommended Approach
Use a strict TypeScript migration with explicit shared types and typed boundaries, while selectively leveraging existing schema-driven structures where they already exist.

### Why this approach
Compared with a loose migration, this avoids leaving a large pile of `any` debt that would make the conversion mostly cosmetic. Compared with a schema-only approach, it gives stronger control over repository entities, workflow runtime types, and Fastify route contracts.

## Alternatives Considered

### Option A — Strict TypeScript with explicit shared types (recommended)
Convert the backend fully to TypeScript, add a shared type layer, and tighten the main runtime boundaries: repositories, workflows, executors, API handlers, and response helpers.

**Pros**
- Highest long-term maintainability
- Makes cross-layer contracts explicit
- Best fit for a workflow-heavy backend with shared runtime objects

**Cons**
- Largest up-front migration cost
- Forces cleanup of dynamic/implicit data flows during migration

### Option B — Strict TypeScript, primarily inferred from schemas
Lean more heavily on existing schema inference for parts of the system and use DTOs/interfaces where inference is insufficient.

**Pros**
- Slightly faster in some areas
- Good fit where schema definitions already exist

**Cons**
- Less uniform than Option A
- Repository and service contracts can still end up fragmented

### Option C — One-shot suffix migration with relaxed typing
Convert files to TypeScript quickly, but allow broad escape hatches and tighten later.

**Pros**
- Fastest first conversion

**Cons**
- Conflicts with the strictness goal
- Leaves hidden type debt across the backend

## Final Decision
Adopt **Option A**, with selective use of schema-derived typing where it helps. The backend will be migrated in one shot, but the implementation order will still move from shared types and data boundaries outward to routes and tests.

## Target Backend Structure
Keep the current backend layout mostly intact to reduce migration risk, while adding an explicit shared type layer.

```txt
backend/
  src/
    adapters/
    config/
    middleware/
    repositories/
    routes/
    services/
      workflow/
        executors/
    types/
    utils/
    main.ts
  test/
  tsconfig.json
```

## Tooling and Runtime Design

### Package and compiler setup
Add TypeScript tooling for a Node ESM backend:
- `typescript`
- `tsx`
- `@types/node`

### Runtime model
- **Development:** `tsx watch src/main.ts`
- **Build:** `tsc`
- **Production/start:** `node dist/main.js`
- **Tests:** `tsx --test`

### Compiler model
Use a TypeScript configuration compatible with the existing ESM project layout.

Recommended settings direction:
- `strict: true`
- `module` / `moduleResolution` aligned to Node ESM (`NodeNext`)
- emit build output into `dist/`
- no path aliases in the first migration pass

### Why this runtime model
`tsx` keeps the dev/test experience simple during migration, while `tsc` provides an explicit production artifact and a reliable strict type gate.

## File Conversion Rules
- Backend source files move from `.js` to `.ts`
- Backend test files move from `.js` / `.test.js` to `.ts` / `.test.ts`
- Avoid mixed JS/TS state after migration is complete
- Preserve the current ESM import style consistently

## Shared Type Layer Design
Add `backend/src/types/` as the central place for reusable backend contracts.

Recommended files:
```txt
src/types/
  api.ts
  entities.ts
  repositories.ts
  workflow.ts
  executors.ts
  fastify.ts
```

### Responsibilities
- `api.ts`: standard response envelope and common API payload wrappers
- `entities.ts`: persistent JSON-backed entities like tasks, projects, workflow runs, sessions, members, roles, etc.
- `repositories.ts`: repository-level generic contracts and persistence helper types
- `workflow.ts`: workflow state, step input/output, template, summaries, context, and run-time event shapes
- `executors.ts`: executor config, registry interfaces, process result shapes, and step result contracts
- `fastify.ts`: common request/response typing helpers used by route modules

## Boundary Typing Strategy
The migration should type the system from the boundaries inward rather than inferring everything ad hoc from implementations.

### Rule
Define the contract first, then make each layer implement that contract.

This avoids ending up with anonymous local object types repeated across:
- route handlers
- services
- repositories
- workflow helpers
- test doubles

## High-Risk Areas and Their Design

### 1. Repository layer
The repository layer is the foundation for the rest of the migration because the backend is JSON-storage based.

Design requirements:
- Type all persisted entity shapes explicitly
- Type `BaseRepository` with generics for entity and create/update payloads
- Make repository return types consistent (`T`, `T | null`, arrays, grouped results)
- Remove ambiguity around nullable fields and optional persistence fields

Why this matters:
Most service typing quality depends on repository contracts being stable and explicit.

### 2. Workflow and executor layer
This is the hardest dynamic area in the backend.

Design requirements:
- Explicitly type workflow shared state
- Explicitly type step input, upstream summaries, and step outputs
- Type workflow execution context and active run tracking
- Type executor registry contracts and executor result envelopes
- Keep `unknown` only at the true external boundary, then narrow immediately

Why this matters:
Current workflow code passes structured-but-dynamic data (`state`, `inputData`, `context`, `rawResult`) across several layers. Strict typing will only stay sane if those contracts are centralized.

### 3. Route layer
Route files are likely to be the most fragmented part of the migration.

Design requirements:
- Type params, query, body, and response payloads per route
- Type error handling expectations where practical
- Reuse shared API response helpers instead of recreating local response shapes

Why this matters:
Without route-level contracts, strict TypeScript quickly degrades into casts at every request boundary.

## Service Layer Expectations

### Workflow services
The workflow subtree should become one of the strongest typed parts of the backend, including:
- workflow service orchestration
- template service
- prompt assembly
- execution context
- executor registry
- executor implementations

### Task and session services
These remain higher risk because they currently mix several responsibilities.

Migration rule:
- Do not do broad behavior refactors
- Allow only targeted cleanup needed to make strict typing feasible

## Test Migration Design
Tests should migrate to TypeScript in the same change set.

Why:
- Strict type issues will surface in mocks and stubs anyway
- Leaving tests in JS creates a split-brain migration
- Typed test doubles help validate that repository/service/workflow contracts are actually coherent

Key requirements:
- Type repository stubs and service fakes
- Type workflow executor mocks
- Keep tests behavior-focused; avoid rewriting test intent unnecessarily

## Implementation Order Inside the One-Shot Migration
Although the migration ships as one backend TypeScript conversion, implementation should proceed in this order:

1. Add TypeScript tooling and compiler/runtime config
2. Introduce shared backend types
3. Migrate repositories and base repository generics
4. Migrate workflow services and executor contracts
5. Migrate remaining services
6. Migrate routes and response typing
7. Migrate backend tests
8. Resolve remaining strict type issues and final build/test verification

Why this order:
It moves from stable contracts and data shapes outward, reducing rework and keeping the hardest dynamic areas from infecting the rest of the migration.

## Error Handling and Type Safety Rules
- Enable strict TypeScript mode
- Do not use broad `any` in core repository/service/workflow code
- `unknown` is acceptable only at true external boundaries and must be narrowed quickly
- Avoid business-logic changes during migration unless they are required to correctly express existing behavior in typed form
- Avoid unrelated refactoring; only improve structure where it directly supports strict typing

## Success Criteria
The migration is complete when all of the following are true:
- All backend source files are TypeScript
- All backend test files are TypeScript
- The backend builds with `tsc`
- `tsc --noEmit` passes under strict mode
- The backend starts successfully
- Core backend tests pass
- Workflow/repository/route boundaries are explicitly typed
- The migration does not rely on broad escape hatches that undermine strictness

## Non-Goals
- Frontend TypeScript migration
- New backend features
- Broad service decomposition unrelated to typing
- Redesigning backend architecture beyond what strict typing requires

## Recommendation Summary
This should be treated as a dedicated backend migration project, not a casual cleanup. The right path is a full strict TypeScript conversion with a shared type layer, typed repository foundations, and special attention to workflow/runtime contracts.
