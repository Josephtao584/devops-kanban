# Remote-First Mastra Workflow Reconciliation Salvage Inventory

| Feature / Change | Current File Area | Classification | Rationale | Target Owner on Remote Baseline |
| --- | --- | --- | --- | --- |
| Workflow start editor card action UX (insert before/after, compact icon actions, details dialog polish) | `frontend/src/components/workflow/WorkflowStartEditorDialog.vue` | rewrite-on-top | Pure product-layer UX improvement. Valuable to keep, but must be reapplied on top of the remote Mastra-backed template/start contract rather than merged blindly. | `frontend/src/components/workflow/WorkflowStartEditorDialog.vue` on remote `master` |
| Shared template editor helpers for generating valid pre-start snapshots and step mutations | `frontend/src/components/workflow/templateEditorShared.js` | rewrite-on-top | Useful behavior for user-facing editing, but helper logic must stay aligned with remote template schema/API and must not smuggle old workflow assumptions back in. | `frontend/src/components/workflow/templateEditorShared.js` on remote `master` |
| Workflow template config editing refinements | `frontend/src/views/WorkflowTemplateConfig.vue` | rewrite-on-top | Keep only the UX behaviors that still fit the remote template API/read model. Reimplement selectively after comparing to remote. | `frontend/src/views/WorkflowTemplateConfig.vue` on remote `master` |
| Workflow progress dialog selection/display behavior | `frontend/src/components/WorkflowProgressDialog.vue` | rewrite-on-top | Valuable run/step/session display behavior, but must consume the remote Mastra-backed run shape instead of preserving any local state assumptions. | `frontend/src/components/WorkflowProgressDialog.vue` + remote workflow run API |
| Kanban workflow start validation coverage | `frontend/tests/KanbanView.workflow-start.spec.js` | cherry-pick-safe | Test-only product regression coverage. Safe to preserve if the remote start flow still exposes the same UX surface. | `frontend/tests/KanbanView.workflow-start.spec.js` |
| Workflow start editor regression coverage | `frontend/tests/WorkflowStartEditorDialog.spec.js` | rewrite-on-top | Keep the intent of the coverage, but update assertions/fixtures to match the remote contract if needed. | `frontend/tests/WorkflowStartEditorDialog.spec.js` |
| Workflow run display regression coverage | `frontend/tests/WorkflowProgressDialog.spec.js` | rewrite-on-top | Useful guardrail for preserved UI behavior, but test fixtures may need reshaping for the remote run model. | `frontend/tests/WorkflowProgressDialog.spec.js` |
| Legacy local workflow orchestration ownership | `backend/src/services/workflow/workflowService.ts` | drop | Architecture-owned runtime logic must come from remote Mastra baseline. Local non-conflicting changes in this file must not survive automatically. | `backend/src/services/workflow/workflowService.ts` from `origin/master` |
| Local workflow definition/integration changes outside remote truth | `backend/src/services/workflow/workflows.ts` | drop | Remote `master` already moved architecture to Mastra. Local changes here should not override or coexist with remote runtime ownership. | `backend/src/services/workflow/workflows.ts` from `origin/master` |
| Workflow route/runtime DTO changes tied to local orchestration assumptions | `backend/src/routes/workflows.ts` | drop | Route behavior must reflect the remote Mastra runtime contract first. Any needed shaping will be reintroduced intentionally later. | `backend/src/routes/workflows.ts` from `origin/master` |
| Template validation / translation changes compatible with remote Mastra contract | `backend/src/services/workflow/workflowTemplateService.ts` | rewrite-on-top | Product-facing template editing must survive, but only through remote-compatible validation and translation. | `backend/src/services/workflow/workflowTemplateService.ts` |
| Template CRUD route compatibility | `backend/src/routes/workflowTemplate.ts` | rewrite-on-top | Keep product-facing template APIs only if still needed by the remote frontend contract. Reapply intentionally. | `backend/src/routes/workflowTemplate.ts` |
| Executor integration seam tests | `backend/test/workflowStepExecutor.test.ts` | rewrite-on-top | Valuable guardrail if remote Mastra still executes through this seam, but must verify remote-owned execution flow rather than the old local one. | `backend/test/workflowStepExecutor.test.ts` |
| Workflow service runtime ownership tests | `backend/test/workflowService.test.ts` | rewrite-on-top | Keep as non-regression coverage, but rewrite expectations around Mastra-owned runtime authority. | `backend/test/workflowService.test.ts` |
| Diff viewer unification work | `frontend/src/components/GitDiffViewer.vue`, `frontend/src/components/CommitDialog.vue`, `frontend/src/components/TaskDetail.vue`, related tests | drop | Valuable work overall, but not required for this workflow reconciliation effort. Keep out of scope to avoid mixing unrelated feature recovery into the Mastra reconciliation. | Out of scope for this task |
| Internal task source adapter work | `backend/src/sources/internalApi.ts`, `backend/src/sources/index.ts`, `backend/task-sources/config.yaml`, related tests and UI | drop | Independent subsystem not part of workflow reconciliation scope. Do not combine with the remote-first Mastra alignment task. | Out of scope for this task |

## Rejected Legacy Paths

- `backend/src/services/workflow/workflowService.ts` legacy step scheduler logic: drop
- local-only workflow run state ownership outside Mastra: drop
- local-only transcript/event pipeline that competes with Mastra-backed truth: drop
- any non-conflicting local changes in workflow architecture-owned backend files that survive merge by accident: drop and restore from `origin/master`

## Inventory Review Checklist

- Template editing UI represented: yes
- Run/step/session display represented: yes
- Executor integration seam represented: yes
- Legacy runtime/orchestrator code represented: yes
