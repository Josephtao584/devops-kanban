# Iteration Deletion With Task Unassignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make iteration deletion work from the Kanban UI and, when an iteration is deleted, automatically clear `iteration_id` on linked tasks instead of leaving dangling references.

**Architecture:** Reuse the existing iteration presentation components by surfacing a lightweight iteration-management dialog inside `KanbanView.vue`, then wire its edit/delete events to the existing Pinia iteration store. Keep referential cleanup on the backend inside `IterationService.delete(...)` so the delete flow first nulls matching task `iteration_id` values through `TaskRepository`, then removes the iteration record, and finally refreshes both tasks and iterations in the UI.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Element Plus, Fastify, TypeScript, JSON-file repositories, Vitest, Node test runner with `tsx`

---

## File Structure

### Modified files
- `backend/src/repositories/taskRepository.ts`
  - Add a focused repository helper that clears `iteration_id` for every task linked to one iteration.
  - Keep this helper narrow: no cascade delete, no broader task mutation API.

- `backend/src/services/iterationService.ts`
  - Update delete flow so task unlinking happens before iteration deletion.
  - Keep the public delete contract unchanged: still return `boolean` for found/not found.

- `backend/test/iterationService.test.ts`
  - Replace the current placeholder with targeted service-level coverage for delete behavior using temporary JSON storage.

- `frontend/src/views/KanbanView.vue`
  - Surface an iteration-management entrypoint next to the existing create button.
  - Render the existing `IterationList` in a dialog for the current project.
  - Wire edit/delete handlers.
  - Confirm deletion, call the store, refresh tasks + iterations, and clear the selected iteration filter if the deleted iteration was selected.

- `frontend/src/locales/zh.js`
  - Add the iteration-management and deletion confirmation strings used by `KanbanView.vue`.

- `frontend/tests/KanbanView.iteration-management.spec.js`
  - Add focused view-level regression coverage for the new iteration-management flow.

### Existing files to inspect for reuse
- `frontend/src/components/iteration/IterationList.vue`
  - Already emits `edit` and `delete`; reuse it rather than inventing a new list.

- `frontend/src/components/iteration/IterationCard.vue`
  - Already exposes delete/edit actions from each card.

- `frontend/src/components/iteration/IterationForm.vue`
  - Reuse the existing edit/create dialog; do not create a second iteration form.

- `frontend/src/composables/kanban/useKanbanSelection.js`
  - Preserve its selection semantics when clearing a deleted iteration from the active filter.

---

### Task 1: Make backend iteration deletion unlink tasks first

**Files:**
- Modify: `backend/src/repositories/taskRepository.ts`
- Modify: `backend/src/services/iterationService.ts`
- Modify: `backend/test/iterationService.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the placeholder contents of `backend/test/iterationService.test.ts` with a real service test that uses temporary JSON fixtures.

Use Node’s built-in test stack already used elsewhere in `backend/test/`:

```ts
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as test from 'node:test';
```

Set up one temp storage directory per test file, write these fixture files before importing the service:
- `projects.json`
- `iterations.json`
- `tasks.json`

Seed them with:
- one project `id: 1`
- one iteration `id: 1`, `project_id: 1`
- one task linked to `iteration_id: 1`
- one unrelated task linked to `iteration_id: null`

Then dynamically import the service after setting `process.env.STORAGE_PATH` to the temp directory and add this core test:

```ts
test.test('IterationService.delete removes the iteration and clears linked task iteration ids', async () => {
  const service = new IterationService();

  const deleted = await service.delete(1);
  assert.equal(deleted, true);

  const iterations = JSON.parse(await fs.readFile(path.join(storagePath, 'iterations.json'), 'utf-8'));
  const tasks = JSON.parse(await fs.readFile(path.join(storagePath, 'tasks.json'), 'utf-8'));

  assert.equal(iterations.some((item: { id: number }) => item.id === 1), false);
  assert.equal(tasks.find((task: { id: number; iteration_id: number | null }) => task.id === 101).iteration_id, null);
  assert.equal(tasks.find((task: { id: number; iteration_id: number | null }) => task.id === 102).iteration_id, null);
});
```

Also add one negative test:

```ts
test.test('IterationService.delete returns false when the iteration does not exist', async () => {
  const service = new IterationService();
  const deleted = await service.delete(999);
  assert.equal(deleted, false);
});
```

The first test should fail before implementation because linked tasks remain associated.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/backend" && node --import tsx --test test/iterationService.test.ts
```

Expected:
- FAIL on the assertion that the linked task’s `iteration_id` became `null`.

- [ ] **Step 3: Write minimal implementation**

In `backend/src/repositories/taskRepository.ts`, add a narrow helper:

```ts
async clearIteration(iterationId: number): Promise<number>
```

Implementation requirements:
- load all tasks once
- set `iteration_id = null` only on tasks whose `iteration_id === iterationId`
- update `updated_at` for changed tasks only
- save once if at least one task changed
- return the number of tasks updated

In `backend/src/services/iterationService.ts`, update `delete(iterationId)` so it:
1. checks whether the iteration exists
2. returns `false` immediately when it does not
3. calls `taskRepo.clearIteration(iterationId)`
4. deletes the iteration with `iterationRepo.delete(iterationId)`
5. returns that delete result

Keep the rest of the service unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/backend" && node --import tsx --test test/iterationService.test.ts
```

Expected:
- PASS with 2 passing tests.

- [ ] **Step 5: Run the broader backend test command**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/backend" && npm test
```

Expected:
- PASS with no regression in existing backend tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/repositories/taskRepository.ts backend/src/services/iterationService.ts backend/test/iterationService.test.ts
git commit -m "fix: unlink tasks when deleting iterations"
```

---

### Task 2: Surface iteration management in the Kanban view

**Files:**
- Modify: `frontend/src/views/KanbanView.vue`
- Modify: `frontend/src/locales/zh.js`
- Reference: `frontend/src/components/iteration/IterationList.vue`
- Reference: `frontend/src/components/iteration/IterationForm.vue`

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/KanbanView.iteration-management.spec.js`.

Copy the test harness style from `frontend/tests/KanbanView.add-task-modal.spec.js`:
- `createPinia()` + `setActivePinia(...)`
- mount `KanbanView.vue`
- stub large child components
- mock `useProjectStore`, `useTaskStore`, `useIterationStore`, `useTaskSourceStore`
- spy on `ElMessage.success`, `ElMessage.error`

Add one focused stub for `IterationList` that emits delete requests:

```js
const IterationListStub = defineComponent({
  name: 'IterationList',
  props: {
    iterations: { type: Array, default: () => [] }
  },
  emits: ['delete', 'edit'],
  setup(props, { emit }) {
    return () => h('div', { class: 'iteration-list-stub' }, props.iterations.map((iteration) =>
      h('button', {
        class: `delete-iteration-${iteration.id}`,
        onClick: () => emit('delete', iteration)
      }, `delete ${iteration.name}`)
    ))
  }
})
```

Mock `element-plus` confirm behavior with:

```js
vi.mock('element-plus', async () => {
  const actual = await vi.importActual('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn()
    },
    ElMessageBox: {
      confirm: vi.fn().mockResolvedValue('confirm')
    }
  }
})
```

Add this regression test:

```js
it('deletes an iteration, refreshes data, and clears the active iteration filter when needed', async () => {
  const wrapper = mountView();
  await flushPromises();

  wrapper.vm.selectedIterationId = 3;
  await wrapper.vm.$nextTick();

  await wrapper.find('.open-iteration-manager').trigger('click');
  await wrapper.find('.delete-iteration-3').trigger('click');
  await flushPromises();

  expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3);
  expect(iterationStore.fetchByProject).toHaveBeenCalledWith('1');
  expect(taskStore.fetchTasks).toHaveBeenCalledWith('1');
  expect(wrapper.vm.selectedIterationId).toBe(null);
  expect(ElMessage.success).toHaveBeenCalled();
});
```

This should fail before implementation because there is no iteration manager entrypoint, no delete handler, and no refresh path.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/frontend" && npm run test:run -- KanbanView.iteration-management.spec.js
```

Expected:
- FAIL because the manager button and delete flow do not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/views/KanbanView.vue`:
- import `IterationList` from `../components/iteration/IterationList.vue`
- expand the iteration toolbar to include a second button with a stable selector/class such as `.open-iteration-manager`
- add `showIterationManager = ref(false)`
- render an `el-dialog` that contains:
  - `IterationList`
  - `:iterations="projectIterations"`
  - `@edit="handleEditIteration"`
  - `@delete="handleDeleteIteration"`
- implement:

```js
const handleEditIteration = (iteration) => {
  editingIteration.value = iteration
  showIterationModal.value = true
}
```

And an async delete flow:

```js
const handleDeleteIteration = async (iteration) => {
  await ElMessageBox.confirm(
    t('iteration.deleteConfirmMessage', { name: iteration.name }),
    t('iteration.deleteConfirmTitle'),
    {
      type: 'warning',
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    }
  )

  await iterationStore.deleteIteration(iteration.id)
  await Promise.all([
    iterationStore.fetchByProject(selectedProjectId.value),
    taskStore.fetchTasks(selectedProjectId.value)
  ])

  if (selectedIterationId.value === iteration.id) {
    selectedIterationId.value = null
  }

  ElMessage.success(t('iteration.deleted'))
}
```

Error path requirements:
- catch the rejection from confirm and silently return when the user canceled
- catch API failures separately and show `ElMessage.error(t('iteration.deleteFailed'))`
- do not close the create/edit iteration form when delete fails

In `frontend/src/locales/zh.js`, add at least:

```js
manageIterations: '管理迭代',
manageIterationsTitle: '管理迭代',
deleted: '迭代已删除',
deleteFailed: '删除迭代失败',
deleteConfirmTitle: '删除迭代',
deleteConfirmMessage: '确定要删除 "{name}" 吗？该迭代下的任务会保留，但会解除与该迭代的关联。'
```

Keep the existing create/edit flow untouched except for reusing it from the manager dialog.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/frontend" && npm run test:run -- KanbanView.iteration-management.spec.js
```

Expected:
- PASS with the delete-flow regression green.

- [ ] **Step 5: Run the existing Kanban view regression file too**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/frontend" && npm run test:run -- KanbanView.add-task-modal.spec.js KanbanView.workflow-start.spec.js
```

Expected:
- PASS with no regression in the existing Kanban view suites.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/KanbanView.vue frontend/src/locales/zh.js frontend/tests/KanbanView.iteration-management.spec.js
git commit -m "feat: add iteration management delete flow"
```

---

### Task 3: Verify the end-to-end delete behavior from the selected-iteration state

**Files:**
- Modify: `frontend/tests/KanbanView.iteration-management.spec.js`
- Reference: `frontend/src/composables/kanban/useKanbanSelection.js`

- [ ] **Step 1: Write the failing edge-case test**

Extend `frontend/tests/KanbanView.iteration-management.spec.js` with a second test that proves the currently selected iteration filter is cleared after deleting that same iteration.

Use explicit expectations against the view state and local storage behavior:

```js
it('stores __ALL__ after deleting the currently selected iteration', async () => {
  const wrapper = mountView();
  await flushPromises();

  wrapper.vm.selectedIterationId = 3;
  await wrapper.vm.$nextTick();

  await wrapper.find('.open-iteration-manager').trigger('click');
  await wrapper.find('.delete-iteration-3').trigger('click');
  await flushPromises();

  expect(wrapper.vm.selectedIterationId).toBe(null);
  expect(localStorage.getItem('kanban-selected-iteration-id')).toBe('__ALL__');
});
```

This should fail until the delete flow actively clears the selected iteration instead of leaving stale state behind.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/frontend" && npm run test:run -- KanbanView.iteration-management.spec.js
```

Expected:
- FAIL on the local storage assertion or selected iteration assertion.

- [ ] **Step 3: Write minimal implementation**

Adjust only the delete success path in `frontend/src/views/KanbanView.vue` if needed so that:
- `selectedIterationId.value = null` happens before the function exits when the deleted iteration was the active filter
- the existing watcher in `useKanbanSelection.js` persists `__ALL__` automatically
- no extra local-storage helper is introduced in `KanbanView.vue`

Do not add duplicate persistence logic.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/frontend" && npm run test:run -- KanbanView.iteration-management.spec.js
```

Expected:
- PASS with both iteration-management tests green.

- [ ] **Step 5: Run the full frontend test command**

Run:
```bash
cd "C:/Users/Administrator/IdeaProjects/devops-kanban/frontend" && npm run test:run
```

Expected:
- PASS with no frontend regressions.

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/KanbanView.iteration-management.spec.js frontend/src/views/KanbanView.vue
git commit -m "test: cover iteration delete selection reset"
```

---

## Final Verification Checklist

- [ ] Deleting an iteration from the Kanban iteration manager calls the existing delete API.
- [ ] Backend clears `iteration_id` on linked tasks before removing the iteration.
- [ ] Unrelated tasks remain unchanged.
- [ ] The deleted iteration disappears after refresh.
- [ ] If the deleted iteration was selected in the filter, the filter resets to “all iterations”.
- [ ] Backend targeted test passes.
- [ ] Frontend targeted tests pass.
- [ ] Full backend and frontend test runs pass.
