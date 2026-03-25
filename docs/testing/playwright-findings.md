# Playwright Findings

## Scope
Validated the running `devops-kanban` application on local `master` using browser automation, with the real seeded project `blog-helloworld` (`project_id = 4`) as the verification sample.

## Verified flows
- Project list shows `blog-helloworld`
- Opening the project navigates to `/kanban/4`
- `/kanban/4` loads the seeded tasks after async data fetch
  - `test` in TODO
  - `【需求】新建HelloWorld.py` in DONE
- Expanding workflow for task 1 shows workflow progress and worktree metadata
- Workflow node selection updates the right-side chat/session panel
- All historical workflow nodes for task 1 are selectable
  - `需求设计`
  - `代码开发`
  - `测试`
  - `代码审查`
- `/task-sources/4` shows the seeded GitHub task source
- Task source `测试连接` succeeds
- Task source `同步` opens the preview/import dialog and correctly marks the existing GitHub issue as already imported
- Task source `编辑` opens and correctly pre-fills existing source config
- Task diff dialog opens and renders changed files for the blog project worktree
- Task commit dialog opens and loads changed file details for the blog project worktree
- Real commit execution succeeds for task 1 worktree
  - Commit created: `8afbea9 test: save main.py change from kanban UI`
- Task merge dialog opens and shows the source branch `task/blog_helloworld/1`
- Task merge target dropdown opens and exposes `master` as a selectable target branch
- Selecting `master` enables the `合并分支` action button
- Executing the real merge action succeeds and shows the success toast `分支合并成功`
- TODO task `test` can create a real worktree successfully
  - Created branch/worktree: `task/blog_helloworld/2`
- TODO task `test` can open the workflow start entry
  - Clicking `启动` opens `选择工作流模板`
  - Confirming the template opens `启动前编辑工作流`
- After fixing the workflow-start bug, confirming `确认并启动` successfully sends `POST /tasks/2/start`
- After the fix, task `test` correctly moves into `处理中` with workflow progress visible in the inline panel

## Issues found

### ISSUE-001: Missing i18n key when testing task source connection
- Severity: Low
- Area: Task source config / localization
- Route: `/task-sources/4`
- Status: Fixed locally
- Root cause:
  - The locale dictionary in `frontend/src/locales/zh.js` defined `taskSource.test` and `taskSource.syncing`, but not `taskSource.testing`, while `TaskSourceConfig.vue` referenced `taskSource.testing` for the loading state label.
- Fix:
  - Added `taskSource.testing: '测试中...'` to `frontend/src/locales/zh.js`.
- Verification:
  - Added a failing regression test in `frontend/tests/TaskSourceConfig.spec.js`.
  - Re-ran `npx vitest run tests/TaskSourceConfig.spec.js` and it passed.

### ISSUE-002: Confirming workflow start unexpectedly opens delete-worktree confirmation instead of starting the workflow
- Severity: High
- Area: TODO task start flow / modal interaction
- Route: `/kanban/4`
- Status: Fixed locally
- Root cause:
  - `WorkflowTemplateSelectDialog` defaulted `autoCreateWorktree` to checked.
  - `KanbanView.startSelectedTaskWithTemplate()` called `handleWorktree(selectedTask.value)` when `autoCreateWorktree` was true.
  - `handleWorktree()` is a toggle helper: if the task already has a created worktree, it routes into `deleteWorktree()` instead of a create-noop path.
  - Therefore the start flow for a task with an existing worktree was diverted into delete confirmation before any `startTask()` request was made.
- Code path:
  - `frontend/src/components/workflow/WorkflowTemplateSelectDialog.vue`
  - `frontend/src/views/KanbanView.vue`
  - `frontend/src/composables/useWorktree.js`
- Fix:
  - In `frontend/src/views/KanbanView.vue`, changed the auto-create path so it only calls `handleWorktree()` when `selectedTask.value.worktree_status !== 'created'`.
- Verification:
  - Added a failing regression test in `frontend/tests/KanbanView.workflow-start.spec.js` for the existing-worktree case.
  - Re-ran `npx vitest run tests/KanbanView.workflow-start.spec.js` and all tests passed.
  - Live browser retest on `http://localhost:3001/kanban/4` confirmed:
    - no delete-worktree confirmation
    - `POST /tasks/2/start` fired successfully
    - task `test` moved into `处理中`
    - inline workflow progress showed `运行中 0/4`

## Notes / non-issues clarified during validation
- `/kanban/4` can initially look empty before async task loading completes; after `/api/tasks?project_id=4` returns, the expected tasks render. This is loading timing, not confirmed data loss.
- Clicking a task card does not open an edit dialog directly; it selects the task and updates the workflow/chat context. The dedicated `编辑` button correctly opens the edit dialog.
- The `打开本地目录` action currently presents a toast `路径已复制到剪贴板`; this may be intentional behavior, but the wording should be reviewed if the product expectation is to open Finder directly.
- The workflow node session panel for task 1 shows `暂无对话记录` for all historical nodes. Current backend evidence shows `/api/sessions/11/output`, `/api/sessions/12/output`, `/api/sessions/13/output`, and `/api/sessions/14/output` all return empty strings, so this is not yet confirmed as a frontend defect.
- The `差异` and `提交` chains are both reachable from the expanded workflow panel. Follow-up actions are blocked by whichever modal is currently open, which is expected modal behavior rather than a confirmed defect.
- The merge dialog is reachable, the source branch is correct, the target branch list is populated, and the final merge request succeeded in this local dataset.

## Final verification performed
- `npx vitest run tests/KanbanView.workflow-start.spec.js`
- `npx vitest run tests/TaskSourceConfig.spec.js`
- `npx vitest run tests/KanbanView.workflow-start.spec.js tests/TaskSourceConfig.spec.js`
- Live browser revalidation on the fixed frontend (`http://localhost:3001/kanban/4`) for the TODO task workflow start path

## Current code changes
- `frontend/src/views/KanbanView.vue`
- `frontend/src/locales/zh.js`
- `frontend/tests/KanbanView.workflow-start.spec.js`
- `frontend/tests/TaskSourceConfig.spec.js`
- `docs/testing/playwright-findings.md`
- Playwright scaffolding and e2e specs under `frontend/`
- Supporting dependency updates in `frontend/package.json` and `frontend/package-lock.json`
- `.gitignore` updates for Playwright outputs

## Conclusion
- The previously blocked TODO-task workflow start path is now fixed locally and revalidated in both automated test and live browser flows.
- The previously observed task source i18n warning is now fixed locally and covered by regression test.
- The major kanban flows requested for validation have been exercised against the real `blog-helloworld` sample project, and the key issues uncovered during validation have been fixed and reverified.
