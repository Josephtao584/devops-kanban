# Worktree Uncommitted Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make worktree diff endpoints show the current worktree branch's uncommitted changes relative to `HEAD`, including untracked files.

**Architecture:** Move diff generation away from branch-vs-branch comparison and onto worktree-local inspection. Extract the uncommitted diff assembly into backend helpers that enumerate changed paths from NUL-delimited porcelain status, generate tracked diffs with `git diff HEAD -- <file>`, synthesize untracked diffs, and return the existing `{ files, diffs }` payload. Keep both backend diff routes aligned to the same semantics, then update frontend consumers so task-level diff views read the shared payload shape correctly.

**Tech Stack:** Fastify 4, TypeScript, Node.js test runner, Vue 3, Element Plus

---

## File Map

### Backend files to modify
- `backend/src/routes/git.ts` — replace branch diff logic on `/api/git/worktrees/:taskId/diff` with uncommitted worktree diff logic
- `backend/src/routes/tasks.ts` — align duplicate `/api/tasks/:id/worktree/diff` route with the same uncommitted diff semantics
- `backend/src/utils/git.ts` — add small focused helpers for NUL-safe porcelain parsing, tracked diff generation, untracked diff synthesis, and diff stat extraction

### Backend tests to add
- `backend/test/gitRoutes.test.ts` — focused route tests for `/api/git/worktrees/:taskId/diff`
- `backend/test/taskWorktreeDiffRoutes.test.ts` — focused route tests for `/api/tasks/:id/worktree/diff`
- `backend/test/utils/gitDiff.test.ts` — helper-level tests for synthesized untracked diffs, NUL-safe path parsing, and diff stat parsing

### Frontend files to modify
- `frontend/src/components/CommitDialog.vue` — stop passing `source` / `target` when loading uncommitted diff
- `frontend/src/components/TaskDetail.vue` — switch task diff dialog from raw `content` string rendering to `{ files, diffs }` payload usage

### Frontend files to modify only if verification proves they are needed
- `frontend/src/api/git.js` — optional cleanup to remove unused `source` / `target` params from the helper signature after the core behavior works
- `frontend/src/components/DiffViewer.vue` — only if status label rendering needs an explicit `untracked` branch during verification

### Files likely unchanged but relevant for reference
- `frontend/src/components/GitWorktreePanel.vue` — already stores `response.data` directly for the git diff route
- `backend/src/app.ts` — shows route registration and testable app entrypoint
- `backend/src/repositories/base.ts` — storage path behavior for test isolation if repository stubs are not used

---

## Verification Commands

- Backend single-file tests:
  - `cd backend && node --import tsx --test test/gitRoutes.test.ts`
  - `cd backend && node --import tsx --test test/taskWorktreeDiffRoutes.test.ts`
  - `cd backend && node --import tsx --test test/utils/gitDiff.test.ts`
- Backend multi-file verification:
  - `cd backend && node --import tsx --test test/utils/gitDiff.test.ts test/gitRoutes.test.ts test/taskWorktreeDiffRoutes.test.ts`
- Backend typecheck:
  - `cd backend && npm run typecheck`
- Frontend verification:
  - `cd frontend && npm run build`

Use these commands instead of `npm test -- <file>` because `backend/package.json` wires `npm test` to a fixed glob.

---

## Implementation Notes

- Do not add git commit steps unless the user explicitly asks for commits.
- For git child-process calls that include file paths, prefer non-shell argument passing such as `execFileSync('git', ['diff', 'HEAD', '--', filePath], ...)` instead of interpolating the file path into a shell command string.
- Keep the change focused on uncommitted worktree diff semantics. Do not add unrelated git API cleanup.

---

### Task 1: Add failing backend coverage for `/api/git/worktrees/:taskId/diff`

**Files:**
- Create: `backend/test/gitRoutes.test.ts`
- Modify: `backend/src/routes/git.ts`
- Test: `backend/test/gitRoutes.test.ts`

- [ ] **Step 1: Write a failing test for tracked modified file diff on `/api/git/worktrees/:taskId/diff`**

Use a Fastify app with the real `gitRoutes` plugin and test-only data files under a temporary storage directory. Create a temporary git repository plus a linked worktree, seed `projects.json` and `tasks.json`, then modify one tracked file inside the worktree.

Example assertion target:

```ts
test.test('GET /api/git/worktrees/:taskId/diff returns tracked uncommitted diff against HEAD', async () => {
  assert.equal(response.statusCode, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.files[0]?.path, 'tracked.txt');
  assert.equal(payload.data.files[0]?.status, 'modified');
  assert.match(payload.data.diffs['tracked.txt'], /^diff --git /m);
});
```

- [ ] **Step 2: Run the focused route test and verify it fails for the current branch-diff behavior**

Run: `cd backend && node --import tsx --test test/gitRoutes.test.ts`
Expected: FAIL because the route still diffs branch refs from the parent repo and will not return the worktree-only modification.

- [ ] **Step 3: Add failing tests for staged new file, tracked deletion, mixed staged+unstaged tracked changes, and payload-shape compatibility**

Extend the same test file with separate cases for:
- staged added file returns `added`
- deleted tracked file returns `deleted`
- same tracked file with staged and unstaged edits returns one combined `git diff HEAD -- <file>` patch
- route still returns `data.files` as an array and `data.diffs` as an object

- [ ] **Step 4: Add failing tests for untracked text file, untracked empty file, untracked binary file, and per-file failure fallback**

Use assertions like:

```ts
assert.equal(file.status, 'untracked');
assert.match(payload.data.diffs['notes.txt'], /^--- \/dev\/null$/m);
assert.equal(emptyFile.additions, 0);
assert.equal(emptyFile.deletions, 0);
assert.match(binaryFileDiff, /Binary files \/dev\/null and b\/image.png differ/);
assert.equal(payload.data.diffs['broken.txt'], '');
```

Also assert the file with failed diff generation still remains in `payload.data.files`.

- [ ] **Step 5: Add failing tests for query parameter compatibility, unusual valid path names, invalid worktree paths, and no-worktree / no-changes**

Cover all of the following:
- caller sends `source` and `target`, but route still returns uncommitted worktree diff
- filename with spaces or another unusual valid name survives NUL-delimited parsing and `-- <file>` handling
- task without worktree returns 400
- invalid or non-git `worktree_path` preserves the route's existing wrapped error behavior
- clean worktree returns empty `files` and empty `diffs`

- [ ] **Step 6: Implement the minimal backend behavior in `backend/src/routes/git.ts` to pass only the first tracked-file test**

Replace the parent-repo branch diff path with the smallest worktree-local path needed for the first case.

Target direction:

```ts
const statusOutput = execSync('git status --porcelain -z', {
  cwd: task.worktree_path,
  encoding: 'utf-8',
});

const fileDiff = execFileSync('git', ['diff', 'HEAD', '--', filePath], {
  cwd: task.worktree_path,
  encoding: 'utf-8',
});
```

- [ ] **Step 7: Run the focused route test again and verify the first case passes while the remaining failing tests still drive the next work**

Run: `cd backend && node --import tsx --test test/gitRoutes.test.ts`
Expected: the first tracked-file case passes; the remaining new cases may still fail until the helper work is implemented.

---

### Task 2: Extract shared backend helpers and complete uncommitted diff behavior

**Files:**
- Modify: `backend/src/utils/git.ts`
- Modify: `backend/src/routes/git.ts`
- Create: `backend/test/utils/gitDiff.test.ts`
- Test: `backend/test/gitRoutes.test.ts`
- Test: `backend/test/utils/gitDiff.test.ts`

- [ ] **Step 1: Write a failing helper test for untracked text diff synthesis**

Create `backend/test/utils/gitDiff.test.ts` with a focused test like:

```ts
const diff = buildUntrackedFileDiff('notes.txt', Buffer.from('hello\nworld\n'));
assert.match(diff, /^diff --git a\/notes.txt b\/notes.txt$/m);
assert.match(diff, /^--- \/dev\/null$/m);
assert.match(diff, /^\+hello$/m);
```

- [ ] **Step 2: Run the helper test and verify it fails because the helper does not exist yet**

Run: `cd backend && node --import tsx --test test/utils/gitDiff.test.ts`
Expected: FAIL with missing export or missing function.

- [ ] **Step 3: Implement minimal helpers in `backend/src/utils/git.ts`**

Add focused helpers only:

```ts
export type UncommittedDiffFile = {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
};

export function parsePorcelainStatus(output: string): UncommittedDiffFile[] { /* ... */ }
export function buildUntrackedFileDiff(filePath: string, content: Buffer): string { /* ... */ }
export function countDiffLines(diff: string): { additions: number; deletions: number } { /* ... */ }
```

- [ ] **Step 4: Add failing helper tests for empty untracked file, binary untracked file marker, NUL-safe unusual path parsing, unsupported rename/copy entry safety, and diff stat counting**

Use assertions like:

```ts
assert.equal(countDiffLines(diff).additions, 0);
assert.match(binaryDiff, /Binary files \/dev\/null and b\/image.png differ/);
assert.equal(parsed[0]?.path, 'dir with spaces/file.txt');
assert.equal(parsed.at(-1)?.path, 'later-file.txt');
```

The rename/copy safety case should prove an unsupported porcelain entry does not corrupt parsing of later entries.

- [ ] **Step 5: Run helper tests to verify they fail for the new missing behavior**

Run: `cd backend && node --import tsx --test test/utils/gitDiff.test.ts`
Expected: FAIL on the empty, binary, unusual-path, or stat cases.

- [ ] **Step 6: Implement the remaining helper behavior with NUL-safe parsing and shell-safe path handling**

Requirements to satisfy in code:
- parse `git status --porcelain -z`
- consume unsupported rename/copy entries safely without corrupting later parsing
- always invoke git with path args after `--`
- distinguish text vs binary for synthesized untracked diffs with a simple heuristic
- derive additions/deletions from the final rendered patch text

- [ ] **Step 7: Refactor `backend/src/routes/git.ts` to use the helpers for every file type**

Route responsibilities after refactor:
- validate task and worktree presence
- enumerate files from porcelain helpers
- for tracked files, read `git diff HEAD -- <file>` from `task.worktree_path`
- for untracked files, read file contents and synthesize patch text
- catch per-file failures and store `''`
- return `{ files, diffs }`

- [ ] **Step 8: Run helper and git-route tests to verify they pass**

Run: `cd backend && node --import tsx --test test/utils/gitDiff.test.ts test/gitRoutes.test.ts`
Expected: PASS

---

### Task 3: Align `/api/tasks/:id/worktree/diff` to the same semantics

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Create: `backend/test/taskWorktreeDiffRoutes.test.ts`
- Test: `backend/test/taskWorktreeDiffRoutes.test.ts`

- [ ] **Step 1: Write a failing test for `/api/tasks/:id/worktree/diff` using the same tracked uncommitted scenario**

Use the same temp repo and worktree fixture style as Task 1.

Expected assertion:

```ts
assert.equal(payload.data.files[0]?.status, 'modified');
assert.match(payload.data.diffs['tracked.txt'], /^diff --git /m);
```

- [ ] **Step 2: Run the focused task-route test and verify it fails under current branch comparison logic**

Run: `cd backend && node --import tsx --test test/taskWorktreeDiffRoutes.test.ts`
Expected: FAIL because `backend/src/routes/tasks.ts` still compares branch refs from the parent repo.

- [ ] **Step 3: Refactor `backend/src/routes/tasks.ts` to call the same uncommitted diff helpers**

Avoid copy-pasting a second implementation. Reuse the helper flow introduced in `backend/src/utils/git.ts`.

- [ ] **Step 4: Add regression tests for ignored `source` / `target` params and unchanged `{ files, diffs }` payload shape**

Expected assertions:

```ts
assert.equal(payload.data.files.length, 1);
assert.equal(payload.data.files[0]?.path, 'tracked.txt');
assert.ok(Array.isArray(payload.data.files));
assert.equal(typeof payload.data.diffs, 'object');
```

- [ ] **Step 5: Run both backend diff route test files and verify they pass together**

Run: `cd backend && node --import tsx --test test/gitRoutes.test.ts test/taskWorktreeDiffRoutes.test.ts`
Expected: PASS

---

### Task 4: Update frontend consumers to the shared `{ files, diffs }` uncommitted payload

**Files:**
- Modify: `frontend/src/api/git.js`
- Modify: `frontend/src/components/CommitDialog.vue`
- Modify: `frontend/src/components/TaskDetail.vue`
- Modify: `frontend/src/components/DiffViewer.vue`

- [ ] **Step 1: Remove branch comparison params from default frontend callers**

Change `frontend/src/api/git.js` so `getDiff(projectId, taskId)` only sends `projectId` by default.

Also update `CommitDialog.vue` to stop calling:

```js
getDiff(props.projectId, props.taskId, { source: 'master', target: props.currentBranch })
```

and instead call the uncommitted diff route without branch refs.

- [ ] **Step 2: Implement the minimal TaskDetail dialog state changes**

Replace:

```js
const diffContent = ref('')
diffContent.value = response.data.content || ''
```

with state shaped like:

```js
const diffData = ref(null)
const selectedDiffFile = ref('')
```

Initialize `selectedDiffFile` to the first returned file path.

- [ ] **Step 3: Update the TaskDetail dialog template to render file list, totals, and selected diff content**

Keep the existing dialog shell. Do not redesign the whole dialog.

At minimum render:
- total additions and deletions from `diffData.files`
- a simple selectable file list
- `<pre>` for `diffData.diffs[selectedDiffFile]`

- [ ] **Step 4: Extend status display to recognize `untracked` if needed**

If `TaskDetail.vue` or `DiffViewer.vue` maps status labels manually, add the equivalent of:

```js
untracked: 'U'
```

- [ ] **Step 5: Run the frontend build as the verification gate for these UI changes**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 6: Smoke-check the two directly changed frontend consumers against the unchanged `{ files, diffs }` shape**

Confirm both of the following against the implemented backend:
- `CommitDialog.vue` can load diff data without `source` / `target`
- `TaskDetail.vue` can open a diff dialog, select a file, and render `diffData.diffs[selectedDiffFile]`

Only if verification shows a regression, also inspect `GitWorktreePanel.vue` or the shared API helper.

---

### Task 5: Run final verification and real-scenario validation

**Files:**
- Modify: only files already listed above if verification reveals a real defect
- Test: `backend/test/gitRoutes.test.ts`
- Test: `backend/test/taskWorktreeDiffRoutes.test.ts`
- Test: `backend/test/utils/gitDiff.test.ts`

- [ ] **Step 1: Run the full focused backend verification suite**

Run: `cd backend && node --import tsx --test test/utils/gitDiff.test.ts test/gitRoutes.test.ts test/taskWorktreeDiffRoutes.test.ts`
Expected: PASS

- [ ] **Step 2: Run backend typecheck**

Run: `cd backend && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run frontend build again after any final touch-ups**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 4: Manually verify the original bug scenario against a real worktree**

Use a task worktree with:
- one modified tracked file
- one untracked file

Then confirm:
- `/api/git/worktrees/:taskId/diff` returns both files
- `/api/tasks/:id/worktree/diff` returns both files
- Task detail and commit dialog both show the expected patch content

- [ ] **Step 5: If verification exposes a real defect, fix only that defect and re-run the affected verification command**

Do not add a commit step unless the user explicitly requests one.
