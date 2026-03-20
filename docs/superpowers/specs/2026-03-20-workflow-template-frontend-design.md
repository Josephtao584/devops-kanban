# 2026-03-20 Workflow Template Frontend Entry Design

## Goal

Add a left-sidebar entry for workflow template management and a dedicated frontend page for editing the global fixed four-step workflow template.

## Scope

This frontend change only covers:

- a new sidebar navigation button
- a new route and page for workflow template config
- loading the current template from `GET /api/workflow-template`
- editing executor type for the fixed four steps
- saving the updated template through `PUT /api/workflow-template`

This change does not cover:

- editing step order
- adding/removing steps
- editing advanced executor fields like `commandOverride`, `args`, or `env`

## Current Context

- Sidebar navigation is hard-coded in `frontend/src/App.vue`
- Routes are declared in `frontend/src/router/index.js`
- Existing config-style pages live under `frontend/src/views/`
- Axios API client is `frontend/src/api/index.js`
- Existing nav i18n keys live in `frontend/src/locales/zh.js`

## Chosen Approach

Use a simple dedicated configuration page.

### Why

- matches current backend capability exactly
- avoids overbuilding a complex settings UI
- keeps the workflow template model visible and easy to understand
- can later expand to advanced executor options without changing the route structure

## UI Design

### Sidebar entry

Add a new sidebar item in `frontend/src/App.vue`:

- label: `工作流模板`
- route: `/workflow-template`
- uses the same sidebar nav style as existing items

### Page layout

Create `frontend/src/views/WorkflowTemplateConfig.vue` with:

- page title
- short description that this is the global workflow template
- a loading state
- a simple list/table of the four fixed steps
- one executor selector per step
- save button

### Editing model

The page should bind to the full template object returned by the backend, but only expose executor type editing in the UI.

For each step display:

- step name
- step id or description if helpful
- executor type select with options:
  - `CLAUDE_CODE`
  - `CODEX`
  - `OPENCODE`

## Data Flow

1. User opens `/workflow-template`
2. Page calls `GET /api/workflow-template`
3. Response populates local reactive template state
4. User changes one or more executor selects
5. User clicks save
6. Page sends the full template object to `PUT /api/workflow-template`
7. On success, show success message and refresh local state from response

## Files

### Create

- `frontend/src/api/workflowTemplate.js` - GET/PUT API helpers
- `frontend/src/views/WorkflowTemplateConfig.vue` - editor page

### Modify

- `frontend/src/App.vue` - add sidebar entry
- `frontend/src/router/index.js` - add route
- `frontend/src/locales/zh.js` - add nav/page labels
- `frontend/src/locales/en.js` - add matching English labels if present

## Validation / Error Handling

Keep it minimal:

- disable save while loading/saving
- show load failure message if GET fails
- show save failure message if PUT fails
- do not add client-side schema validation beyond ensuring a template is loaded

## Testing

Frontend verification should include:

- sidebar button appears and routes to the new page
- page loads template successfully
- changing a step executor updates bound state
- clicking save sends updated template
- success and error message states behave correctly

## Result

This gives the user a direct left-sidebar entry to manage the global workflow template while keeping the UI aligned with the current backend scope: fixed four steps, editable executor per step.
