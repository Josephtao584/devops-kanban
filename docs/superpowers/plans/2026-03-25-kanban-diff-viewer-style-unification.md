# Kanban Diff Viewer Style Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared diff presentation component so the TaskDetail diff dialog reuses the CommitDialog diff UI while keeping TaskDetail read-only and CommitDialog fully submittable.

**Architecture:** Extract the current diff-display structure and styling out of `CommitDialog.vue` into a new presentational `GitDiffViewer.vue` component. Keep all API calls, commit-specific selection state, and submit behavior in the parent dialogs; normalize each parent’s raw data into the same `fileItems` view model before passing it down. Update `TaskDetail.vue` to open its diff dialog immediately and drive the shared viewer with an explicit loading state so its in-dialog loading/empty/content states match the commit flow.

**Tech Stack:** Vue 3 `<script setup>`, Element Plus, Vitest, Vue Test Utils, existing git API clients in `frontend/src/api/git`

---

## File Structure

### New file
- `frontend/src/components/GitDiffViewer.vue`
  - Shared presentational diff viewer.
  - Owns no API calls, no commit logic, no route/task mutations.
  - Renders the unified left/right diff layout, empty/loading states, file selection UI, and parsed diff lines.

### Modified files
- `frontend/src/components/CommitDialog.vue`
  - Replaces inline diff UI markup/styles with `GitDiffViewer.vue`.
  - Keeps `getUncommittedChanges`, `getDiff`, `commit`, selected file state, selected file toggling, selected count, and submit UI.
  - Adds normalization from `changes` + `diffData.files` to the shared `fileItems` shape.

- `frontend/src/components/TaskDetail.vue`
  - Replaces old read-only diff dialog body with `GitDiffViewer.vue`.
  - Keeps `getDiff` request ownership.
  - Adds `diffLoading` state and opens the dialog before the request resolves.
  - Normalizes `diffData.files` to the shared `fileItems` shape.
  - Clears stale diff state before opening and on request failure.

### Test files
- Create: `frontend/tests/GitDiffViewer.spec.js`
  - Focused coverage for presentational modes and emitted events.

- Modify: `frontend/tests/CommitDialog.spec.js`
  - Preserve and extend current commit dialog regression coverage.
  - Add/adjust local test stubs needed for shared viewer rendering, including `el-checkbox`, `el-input`, `el-button`, `el-scrollbar`, `el-empty`, `el-tag`, `el-icon`.
  - Ensure `commit` remains imported and mocked in the spec.

- Modify: `frontend/tests/AgentConfig.spec.js`
  - Extend existing `TaskDetail` mount/test anchor instead of creating a separate large TaskDetail suite.

### Existing file to inspect for reuse
- `frontend/src/components/DiffViewer.vue`
  - Read before implementation.
  - Do not blindly reuse it; compare whether any diff parsing helpers or style fragments are useful.

---

### Task 1: Build shared GitDiffViewer component

**Files:**
- Create: `frontend/src/components/GitDiffViewer.vue`
- Test: `frontend/tests/GitDiffViewer.spec.js`
- Reference: `frontend/src/components/CommitDialog.vue`
- Reference: `frontend/src/components/DiffViewer.vue`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/GitDiffViewer.spec.js` with local test stubs for the Element Plus components it uses, including at least:
- `el-checkbox`
- `el-button`
- `el-scrollbar`
- `el-empty`
- `el-tag`
- `el-icon`

Use the same stubbed testing style already used in `frontend/tests/AgentConfig.spec.js`.

Add focused tests for the shared viewer contract:

```js
it('renders commit-mode controls and emits file selection events', async () => {
  const wrapper = mount(GitDiffViewer, {
    props: {
      fileItems: [
        {
          path: 'docs/guide.md',
          displayName: 'guide.md',
          status: 'modified',
          additions: 3,
          deletions: 1,
          selected: true
        }
      ],
      diffsByPath: {
        'docs/guide.md': '@@ -1,1 +1,2 @@\n-old\n+new'
      },
      loading: false,
      selectedFilePath: 'docs/guide.md',
      selectable: true,
      title: '代码差异'
    },
    global: {
      stubs: {
        'el-checkbox': ElCheckboxStub,
        'el-button': ElButtonStub,
        'el-scrollbar': ElScrollbarStub,
        'el-empty': ElEmptyStub,
        'el-tag': ElTagStub,
        'el-icon': ElIconStub
      }
    }
  })

  expect(wrapper.find('.file-actions').exists()).toBe(true)
  expect(wrapper.find('.el-checkbox-stub').exists()).toBe(true)

  await wrapper.find('.file-item').trigger('click')
  expect(wrapper.emitted('update:selectedFilePath')).toEqual([['docs/guide.md']])
})

it('hides commit-only controls and never emits multi-select events in read-only mode', async () => {
  const wrapper = mount(GitDiffViewer, {
    props: {
      fileItems: [
        {
          path: 'main.py',
          displayName: 'main.py',
          status: 'untracked',
          additions: 5,
          deletions: 0
        }
      ],
      diffsByPath: {
        'main.py': '@@ -0,0 +1,1 @@\n+print("hi")'
      },
      loading: false,
      selectedFilePath: 'main.py',
      selectable: false,
      title: '代码差异'
    },
    global: {
      stubs: {
        'el-checkbox': ElCheckboxStub,
        'el-button': ElButtonStub,
        'el-scrollbar': ElScrollbarStub,
        'el-empty': ElEmptyStub,
        'el-tag': ElTagStub,
        'el-icon': ElIconStub
      }
    }
  })

  expect(wrapper.find('.file-actions').exists()).toBe(false)
  expect(wrapper.find('.el-checkbox-stub').exists()).toBe(false)
  expect(wrapper.emitted('toggle-file')).toBeFalsy()
  expect(wrapper.emitted('select-all')).toBeFalsy()
  expect(wrapper.emitted('deselect-all')).toBeFalsy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- GitDiffViewer.spec.js
```

Expected:
- FAIL because `frontend/src/components/GitDiffViewer.vue` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/components/GitDiffViewer.vue` with:
- Props:
  - `fileItems`
  - `diffsByPath`
  - `loading`
  - `selectedFilePath`
  - `selectable`
  - `title`
- Emits:
  - `update:selectedFilePath`
  - `toggle-file`
  - `select-all`
  - `deselect-all`
- Render contract:
  - Same left/right diff structure as current `CommitDialog.vue`
  - Same `panel-header`, `panel-title`, `file-panel`, `diff-panel`, `diff-stats`, `diff-line` styling family
  - Checkbox + file actions only when `selectable === true`
  - Row click emits only `update:selectedFilePath`
  - Checkbox click emits only `toggle-file`
- Computed helpers:
  - current diff by `selectedFilePath`
  - current file additions/deletions
  - parsed diff lines (copied minimally from current `CommitDialog.vue` / compare `DiffViewer.vue` first)
- Rendering rules:
  - `added` -> 新增样式
  - `modified` -> 修改样式
  - `deleted` -> 删除样式
  - `untracked` -> 保持 `untracked` 状态值，但按新增视觉展示
  - unknown status fallback happens in parents and must map to `modified`

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- GitDiffViewer.spec.js
```

Expected:
- PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/GitDiffViewer.vue frontend/tests/GitDiffViewer.spec.js
git commit -m "feat: add shared git diff viewer"
```

---

### Task 2: Migrate CommitDialog to the shared viewer

**Files:**
- Modify: `frontend/src/components/CommitDialog.vue`
- Modify: `frontend/tests/CommitDialog.spec.js`
- Reference: `frontend/src/components/GitDiffViewer.vue`

- [ ] **Step 1: Write the failing test**

Extend `frontend/tests/CommitDialog.spec.js` with explicit tests.

Before writing assertions, update the test harness so the spec can actually render the shared viewer path:
- keep `commit` imported from `../src/api/git`
- keep `commit` mocked in `vi.mock('../src/api/git', ...)`
- add/adjust local stubs for:
  - `el-checkbox`
  - `el-input`
  - `el-button`
  - `el-scrollbar`
  - `el-empty`
  - `el-tag`
  - `el-icon`

Then add tests:

```js
it('renders the shared diff viewer with commit controls still visible', async () => {
  getUncommittedChanges.mockResolvedValue({
    success: true,
    data: [
      { path: '__pycache__/main.cpython-312.pyc', status: 'untracked' }
    ]
  })

  getDiff.mockResolvedValue({
    success: true,
    data: {
      files: [
        {
          path: '__pycache__/main.cpython-312.pyc',
          status: 'untracked',
          additions: 0,
          deletions: 0
        }
      ],
      diffs: {
        '__pycache__/main.cpython-312.pyc': 'diff --git a/__pycache__/main.cpython-312.pyc b/__pycache__/main.cpython-312.pyc'
      }
    }
  })

  const wrapper = mount(CommitDialog, { ... })
  await flushPromises()

  expect(wrapper.findComponent({ name: 'GitDiffViewer' }).exists()).toBe(true)
  expect(wrapper.find('.commit-input').exists()).toBe(true)
  expect(wrapper.find('.commit-actions').exists()).toBe(true)
  expect(wrapper.find('.el-checkbox-stub').exists()).toBe(true)
})

it('submits the selected files and commit message from CommitDialog ownership', async () => {
  commit.mockResolvedValue({ success: true, data: {} })

  const wrapper = mount(CommitDialog, { ... })
  await flushPromises()

  await wrapper.find('textarea').setValue('test commit message')
  await wrapper.get('.commit-actions button:last-child').trigger('click')

  expect(commit).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), {
    message: 'test commit message',
    addAll: false,
    files: ['__pycache__/main.cpython-312.pyc']
  })
})

it('renders a non-empty filename label for directory-like change paths', async () => {
  const wrapper = mount(CommitDialog, { ... })
  await flushPromises()

  const fileLabel = wrapper.find('.file-path')
  expect(fileLabel.exists()).toBe(true)
  expect(fileLabel.text()).toBe('__pycache__')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- CommitDialog.spec.js
```

Expected:
- FAIL because `CommitDialog.vue` does not yet render `GitDiffViewer`.

- [ ] **Step 3: Write minimal implementation**

Update `frontend/src/components/CommitDialog.vue`:
- Import and render `GitDiffViewer.vue`
- Remove inline diff-viewer markup that the shared component replaces
- Keep:
  - `loadChanges`
  - `loadDiff`
  - `handleCommit`
  - commit textarea/footer
- Add `fileItems` computed that merges:
  - `changes.value` selection state
  - `diffData.value.files` additions/deletions
  - `displayName` derived from normalized path basename
- Apply exact normalization rules in the parent:
  - `modified` -> `modified`
  - `added` -> `added`
  - `deleted` -> `deleted`
  - `untracked` -> `untracked`
  - unknown -> `modified`
- Pass props:
  - `:file-items="fileItems"`
  - `:diffs-by-path="diffData?.diffs || {}"`
  - `:loading="diffLoading"`
  - `:selected-file-path="selectedFile"`
  - `:selectable="true"`
- Wire emits:
  - `@update:selected-file-path="handleViewerFileSelect"`
  - `@toggle-file="toggleFileByPath"`
  - `@select-all="selectAll"`
  - `@deselect-all="deselectAll"`
- Implement `handleViewerFileSelect(path)` so it routes through the existing `selectFile(file)` / `loadDiff()` behavior instead of only assigning `selectedFile`

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- CommitDialog.spec.js
```

Expected:
- PASS with commit-specific regression tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommitDialog.vue frontend/tests/CommitDialog.spec.js
git commit -m "refactor: reuse shared diff viewer in commit dialog"
```

---

### Task 3: Migrate TaskDetail diff dialog to the shared viewer

**Files:**
- Modify: `frontend/src/components/TaskDetail.vue:176-225`
- Modify: `frontend/src/components/TaskDetail.vue:367-470`
- Modify: `frontend/tests/AgentConfig.spec.js`
- Reference: `frontend/src/components/GitDiffViewer.vue`

- [ ] **Step 1: Write the failing test**

Extend `frontend/tests/AgentConfig.spec.js` with explicit TaskDetail diff-dialog tests:

```js
it('opens the diff dialog in read-only mode and shows loading before diff data resolves', async () => {
  let resolveDiff
  getDiff.mockReturnValue(new Promise((resolve) => {
    resolveDiff = resolve
  }))

  const wrapper = mountTaskDetail({
    task: { id: 123, title: 'Fix bug' },
    projectId: 9
  })
  await flushPromises()

  const pending = wrapper.vm.showDiffDialog()
  await flushPromises()

  expect(wrapper.findComponent({ name: 'GitDiffViewer' }).exists()).toBe(true)
  expect(wrapper.html()).toContain('加载中')
  expect(wrapper.find('.el-checkbox-stub').exists()).toBe(false)

  resolveDiff({
    success: true,
    data: {
      files: [
        { path: 'docs/guide.md', status: 'modified', additions: 1, deletions: 1 }
      ],
      diffs: {
        'docs/guide.md': '@@ -1,1 +1,1 @@\n-old\n+new'
      }
    }
  })

  await pending
  await flushPromises()

  expect(wrapper.html()).not.toContain('取消全选')
  expect(wrapper.html()).not.toContain('提交中')
})

it('defaults to the first returned file after diff data resolves', async () => {
  getDiff.mockResolvedValue({
    success: true,
    data: {
      files: [
        { path: 'docs/guide.md', status: 'modified', additions: 1, deletions: 1 },
        { path: 'main.py', status: 'untracked', additions: 5, deletions: 0 }
      ],
      diffs: {
        'docs/guide.md': '@@ -1,1 +1,1 @@\n-old\n+new',
        'main.py': '@@ -0,0 +1,1 @@\n+print("hi")'
      }
    }
  })

  const wrapper = mountTaskDetail({ task: { id: 123, title: 'Fix bug' }, projectId: 9 })
  await flushPromises()

  await wrapper.vm.showDiffDialog()
  await flushPromises()

  expect(wrapper.vm.selectedDiffFile).toBe('docs/guide.md')
  expect(wrapper.findComponent({ name: 'GitDiffViewer' }).exists()).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- AgentConfig.spec.js
```

Expected:
- FAIL because `TaskDetail.vue` still waits for `getDiff` before opening and still renders the old diff dialog layout.

- [ ] **Step 3: Write minimal implementation**

Update `frontend/src/components/TaskDetail.vue`:
- Import `GitDiffViewer.vue`
- Replace old diff dialog body with the shared viewer
- Add `diffLoading = ref(false)`
- Add normalized `taskDetailFileItems` computed from `diffData.value.files`
- Apply exact normalization rules in the parent:
  - `modified` -> `modified`
  - `added` -> `added`
  - `deleted` -> `deleted`
  - `untracked` -> `untracked`
  - unknown -> `modified`
- Before opening the dialog, clear stale state:
  - `diffData.value = null`
  - `selectedDiffFile.value = ''`
- On diff-load failure, keep the dialog open for error/empty-state correctness and clear stale state again
- Change `showDiffDialog` flow to:
  1. set `diffData.value = null`
  2. set `selectedDiffFile.value = ''`
  3. set `diffDialogVisible.value = true`
  4. set `diffLoading.value = true`
  5. request `getDiff(...)`
  6. populate `diffData`
  7. default-select first file
  8. set `diffLoading.value = false`
- Pass the full shared viewer contract explicitly:
  - `:file-items="taskDetailFileItems"`
  - `:diffs-by-path="diffData?.diffs || {}"`
  - `:loading="diffLoading"`
  - `:selected-file-path="selectedDiffFile"`
  - `:selectable="false"`
  - `:title="$t('git.diff', 'Code Changes')"`
- Wire `@update:selected-file-path="selectedDiffFile = $event"`
- Keep footer with only close button
- Remove old task-detail-specific inline diff styles that the shared viewer now owns

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- AgentConfig.spec.js
```

Expected:
- PASS with the new TaskDetail diff-dialog assertions green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TaskDetail.vue frontend/tests/AgentConfig.spec.js
git commit -m "refactor: reuse shared diff viewer in task detail"
```

---

### Task 4: Run focused regression verification

**Files:**
- Verify: `frontend/src/components/GitDiffViewer.vue`
- Verify: `frontend/src/components/CommitDialog.vue`
- Verify: `frontend/src/components/TaskDetail.vue`
- Verify: `frontend/tests/GitDiffViewer.spec.js`
- Verify: `frontend/tests/CommitDialog.spec.js`
- Verify: `frontend/tests/AgentConfig.spec.js`

- [ ] **Step 1: Run the shared viewer tests**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- GitDiffViewer.spec.js
```

Expected:
- PASS.

- [ ] **Step 2: Run the commit dialog tests**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- CommitDialog.spec.js
```

Expected:
- PASS.

- [ ] **Step 3: Run the TaskDetail/AgentConfig tests**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- AgentConfig.spec.js
```

Expected:
- PASS.

- [ ] **Step 4: Run all three together**

Run:
```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban/frontend && npm run test:run -- GitDiffViewer.spec.js CommitDialog.spec.js AgentConfig.spec.js
```

Expected:
- PASS with no new regressions in the touched diff UI surface.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/GitDiffViewer.vue frontend/src/components/CommitDialog.vue frontend/src/components/TaskDetail.vue frontend/tests/GitDiffViewer.spec.js frontend/tests/CommitDialog.spec.js frontend/tests/AgentConfig.spec.js
git commit -m "test: verify unified diff viewer flows"
```

---

## Notes for the implementer
- Read `frontend/src/components/DiffViewer.vue` before copying parsing logic. Reuse any helpful existing logic, but do not pull its API-calling behavior into the new shared viewer.
- Keep changes tightly scoped to diff presentation reuse. Do not refactor unrelated parts of `TaskDetail.vue`.
- Follow @superpowers:test-driven-development for each task.
- After the plan is implemented, request code review before any final integration step.
