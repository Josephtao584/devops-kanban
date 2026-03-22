# Roles and Members Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused backend `roles` and `members` resources, their DTOs, route registration, tests, sample data, and stale documentation references.

**Architecture:** Treat `roles` and `members` as dead vertical slices and delete them end-to-end instead of leaving disabled shells. Keep the rest of the backend unchanged; only remove imports, registrations, tests, docs, DTO files, route files, and sample/sample-data references that exist solely for these resources. Frontend exploration found no active `/api/roles` or `/api/members` usage under `frontend/src`; the only frontend match was unrelated workflow-role wording in `frontend/src/constants/agent.js`.

**Tech Stack:** TypeScript, Fastify 4, Node test runner with `tsx`, JSON-backed repositories, markdown docs.

---

## File Map

### Source files to modify/delete
- Modify: `backend/src/app.ts` — remove route imports, root endpoint entries, and Fastify registration for roles/members
- Modify: `backend/src/routes/index.ts` — remove `roleRoutes` / `memberRoutes` exports
- Delete: `backend/src/routes/roles.ts`
- Delete: `backend/src/routes/members.ts`
- Delete: `backend/src/types/dto/roles.ts`
- Delete: `backend/src/types/dto/members.ts`

### Tests to modify/delete
- Modify: `backend/test/contracts/managementRouteInputTypes.test.ts` — keep agent DTO coverage, remove role/member coverage, and rename test wording if needed
- Modify: `backend/test/contracts/rootRoutes.test.ts` — remove expectations for `/api/roles` and `/api/members`

### Documentation/data references to modify/delete
- Modify: `CLAUDE.md` — remove `roles.json` / `members.json` and API rows for roles/members
- Modify: `README.md` — remove roles/members JSON, route-file tree entries, and endpoint documentation
- Modify: `backend/README.md` — remove roles/members route-file entries and endpoint rows
- Delete: `data/roles.json`
- Delete: `data/members.json`
- Delete: `data-sample/roles.json`
- Delete: `data-sample/members.json`

### Historical docs
- Leave historical `docs/superpowers/` plan files alone unless they are loaded by runtime/tests. They are historical artifacts.

---

### Task 1: Remove backend roles and members routes safely

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/index.ts`
- Delete: `backend/src/routes/roles.ts`
- Delete: `backend/src/routes/members.ts`
- Delete: `backend/src/types/dto/roles.ts`
- Delete: `backend/src/types/dto/members.ts`
- Modify: `backend/test/contracts/rootRoutes.test.ts`

- [ ] **Step 1: Write the failing root route expectation change**

Remove the roles/members endpoint assertions from `backend/test/contracts/rootRoutes.test.ts`.

```ts
assert.deepEqual(response.data.endpoints, {
  projects: '/api/projects',
  tasks: '/api/tasks',
  sessions: '/api/sessions',
  taskSources: '/api/task-sources',
  executions: '/api/executions',
  agents: '/api/agents',
  workflows: '/api/workflows',
  websocket: '/ws',
  health: '/health',
});
```

- [ ] **Step 2: Run the focused root route test to verify it fails**

Run: `cd backend && node --import tsx --test test/contracts/rootRoutes.test.ts`
Expected: FAIL because `backend/src/app.ts` still exposes roles/members endpoints.

- [ ] **Step 3: Remove imports/registrations/exports first**

In `backend/src/app.ts`, remove:

```ts
memberRoutes,
roleRoutes,
```

and remove:

```ts
roles: '/api/roles',
members: '/api/members',
```

and remove:

```ts
fastify.register(roleRoutes, { prefix: '/api/roles' });
fastify.register(memberRoutes, { prefix: '/api/members' });
```

Then update `backend/src/routes/index.ts` to stop exporting those route modules.

- [ ] **Step 4: Delete the now-unreferenced route files**

Delete:
- `backend/src/routes/roles.ts`
- `backend/src/routes/members.ts`

- [ ] **Step 5: Only after Task 2 rewrites `managementRouteInputTypes.test.ts`, delete the role/member DTO files**

Delete:
- `backend/src/types/dto/roles.ts`
- `backend/src/types/dto/members.ts`

- [ ] **Step 6: Run the focused root route test again**

Run: `cd backend && node --import tsx --test test/contracts/rootRoutes.test.ts`
Expected: PASS

### Task 2: Remove roles/members-only tests and data while preserving agent coverage

**Files:**
- Modify: `backend/test/contracts/managementRouteInputTypes.test.ts`
- Delete: `data/roles.json`
- Delete: `data/members.json`
- Delete: `data-sample/roles.json`
- Delete: `data-sample/members.json`

- [ ] **Step 1: Rewrite the management contract test so it becomes agent-only**

Keep the file if that is the least disruptive path, but remove:
- role DTO imports/assertions
- member DTO imports/assertions

Leave agent DTO coverage intact. If renaming the test description improves clarity, do that.

- [ ] **Step 2: Verify no remaining code/tests import role/member DTOs**

Run: `git grep -nE "CreateRoleBody|UpdateRoleBody|CreateMemberBody|UpdateMemberBody" -- backend frontend`
Expected: no matches after the agent-only test edit.

- [ ] **Step 3: Delete dead data files**

Delete:
- `data/roles.json`
- `data/members.json`
- `data-sample/roles.json`
- `data-sample/members.json`

- [ ] **Step 4: Run the agent DTO contract test**

Run: `cd backend && node --import tsx --test test/contracts/managementRouteInputTypes.test.ts`
Expected: PASS

### Task 3: Remove stale docs and file-tree references

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `backend/README.md`

- [ ] **Step 1: Remove roles/members data file and route-file tree references**

Delete documentation mentions of:
- `roles.json`
- `members.json`
- route tree/file-list entries for `roles.ts` / `members.ts` (or `.js` if the README still uses the old extension in examples)

including tree/file-list entries in both READMEs.

- [ ] **Step 2: Remove roles/members endpoint rows**

Delete documentation rows for:
- `GET/POST/PUT/DELETE /api/roles`
- `GET/POST/PUT/DELETE /api/members`

- [ ] **Step 3: Re-read the docs snippets to ensure they are still coherent**

Make sure surrounding tables/lists still read cleanly after row removal.

### Task 4: Final verification for roles/members removal

**Files:**
- Verify-only: all touched files above

- [ ] **Step 1: Run focused contract/regression tests**

Run: `cd backend && node --import tsx --test test/contracts/rootRoutes.test.ts test/contracts/bootstrap.test.ts test/contracts/managementRouteInputTypes.test.ts`
Expected: PASS

- [ ] **Step 2: Run repo-wide live-code/reference audit**

Run: `git grep -nE "/api/roles|/api/members|roleRoutes|memberRoutes|CreateRoleBody|UpdateRoleBody|CreateMemberBody|UpdateMemberBody|roles\.json|members\.json|roles\.ts|members\.ts" -- backend frontend CLAUDE.md README.md backend/README.md data data-sample`
Expected: no matches in live code, active tests, active docs, or active data/sample-data. Ignore historical references under `docs/superpowers/` and any mirrored worktree files under `.claude/worktrees/`.

- [ ] **Step 3: Run focused no-import audit for deleted modules**

Run: `git grep -nE "from './roles\\.js'|from './members\\.js'|from '../../src/types/dto/roles\\.ts'|from '../../src/types/dto/members\\.ts'" -- backend`
Expected: no matches.

- [ ] **Step 4: Run typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Run build**

Run: `cd backend && npm run build`
Expected: PASS
