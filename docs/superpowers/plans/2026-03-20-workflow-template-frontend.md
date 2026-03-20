# Workflow Template Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-sidebar entry and a dedicated frontend page for editing the global fixed four-step workflow template executor bindings.

**Architecture:** Keep the UI simple and aligned with the new backend API. Add a new route and sidebar nav item, create a focused API helper for workflow template requests, and build a single page that loads the full template, lets the user edit only the executor type for each fixed step, and saves the entire template back.

**Tech Stack:** Vue 3, Vue Router, Element Plus, vue-i18n, Axios

---

## File Structure

### Create
- `frontend/src/api/workflowTemplate.js` - GET/PUT helpers for `/api/workflow-template`
- `frontend/src/views/WorkflowTemplateConfig.vue` - workflow template editor page

### Modify
- `frontend/src/App.vue` - add left sidebar nav item for workflow template
- `frontend/src/router/index.js` - register `/workflow-template` route
- `frontend/src/locales/zh.js` - add sidebar label and page copy

---

### Task 1: Add workflow template API helper

**Files:**
- Create: `frontend/src/api/workflowTemplate.js`

- [ ] **Step 1: Write the minimal API helper**

```js
import api from './index'

export const getWorkflowTemplate = () => api.get('/workflow-template')
export const updateWorkflowTemplate = (data) => api.put('/workflow-template', data)
```

- [ ] **Step 2: Verify import shape matches existing API helpers**

Check against `frontend/src/api/agent.js` and `frontend/src/api/taskSource.js`.
Expected: same lightweight wrapper style.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/workflowTemplate.js
git commit -m "feat: add workflow template frontend api helpers"
```

---

### Task 2: Register the workflow template page route

**Files:**
- Modify: `frontend/src/router/index.js:3-29`
- Create: `frontend/src/views/WorkflowTemplateConfig.vue`

- [ ] **Step 1: Add the new route entry**

Add a route:

```js
{
  path: '/workflow-template',
  name: 'WorkflowTemplateConfig',
  component: () => import('../views/WorkflowTemplateConfig.vue')
}
```

- [ ] **Step 2: Add a temporary placeholder page component**

Create a minimal placeholder first so the route resolves:

```vue
<template>
  <div class="workflow-template-config">
    <h1>工作流模板</h1>
  </div>
</template>
```

- [ ] **Step 3: Run frontend dev server or build to verify route compiles**

Run: `cd "D:/workspace/devops-kanban/frontend" && npm run build`
Expected: build passes with the new route and view import.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/router/index.js frontend/src/views/WorkflowTemplateConfig.vue
git commit -m "feat: add workflow template frontend route"
```

---

### Task 3: Add sidebar entry in the left navigation

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/locales/zh.js`

- [ ] **Step 1: Add the new nav i18n keys**

Add minimal keys under navigation/page copy, for example:

```js
nav: {
  workflowTemplate: '工作流模板'
}
```

And page copy keys if needed for title/description/save messages.

- [ ] **Step 2: Add a new sidebar `router-link`**

Follow the existing `App.vue` nav item pattern and add:
- route: `/workflow-template`
- label: `$t('nav.workflowTemplate')`
- icon: simple settings/flow-style inline SVG

- [ ] **Step 3: Verify active route styling follows existing sidebar behavior**

The new nav item should use the same `nav-item` / `router-link-active` classes as the current sidebar links.

- [ ] **Step 4: Run frontend build to verify sidebar compiles**

Run: `cd "D:/workspace/devops-kanban/frontend" && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.vue frontend/src/locales/zh.js
git commit -m "feat: add workflow template sidebar entry"
```

---

### Task 4: Build the workflow template editor page

**Files:**
- Modify: `frontend/src/views/WorkflowTemplateConfig.vue`
- Create: `frontend/src/api/workflowTemplate.js`

- [ ] **Step 1: Replace placeholder with the actual page structure**

Page sections should include:
- title
- short description saying this is the global workflow template
- loading state
- error state if load fails
- form/table showing fixed steps
- one executor select per step
- save button

- [ ] **Step 2: Implement page state and initial load**

Use Vue refs for:
- `loading`
- `saving`
- `template`
- `loadError`

Load data on mount with `getWorkflowTemplate()`.

- [ ] **Step 3: Render the fixed step list from loaded template**

For each step show:
- `step.name`
- `step.id`
- `el-select` or native select bound to `step.executor.type`

Allowed options:
- `CLAUDE_CODE`
- `CODEX`
- `OPENCODE`

- [ ] **Step 4: Implement save action**

On save:
- call `updateWorkflowTemplate(template.value)`
- replace local state with returned `data`
- show success message
- show failure message on error

- [ ] **Step 5: Keep UI scope minimal**

Do not expose:
- `commandOverride`
- `args`
- `env`
- step reordering
- custom step creation

- [ ] **Step 6: Run frontend build to verify page compiles**

Run: `cd "D:/workspace/devops-kanban/frontend" && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/WorkflowTemplateConfig.vue frontend/src/api/workflowTemplate.js
git commit -m "feat: add workflow template editor page"
```

---

### Task 5: Verify end-to-end frontend behavior manually

**Files:**
- Review only: files touched above

- [ ] **Step 1: Run frontend locally**

Run: `cd "D:/workspace/devops-kanban/frontend" && npm run dev`
Expected: dev server starts successfully.

- [ ] **Step 2: Verify sidebar entry appears**

Manual check:
- left sidebar shows `工作流模板`
- clicking it navigates to `/workflow-template`

- [ ] **Step 3: Verify data load works**

Manual check:
- page loads current backend template
- all four fixed steps are shown
- current executor type is visible per step

- [ ] **Step 4: Verify save works**

Manual check:
- change one step executor
- click save
- success message appears
- reload page and confirm persisted value remains

- [ ] **Step 5: Run production build one final time**

Run: `cd "D:/workspace/devops-kanban/frontend" && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add <specific frontend files>
git commit -m "test: verify workflow template frontend flow"
```
