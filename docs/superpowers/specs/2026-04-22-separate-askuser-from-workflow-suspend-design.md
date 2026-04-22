# Design: Separate AskUserQuestion from Workflow Suspension

## Date: 2026-04-22

## Context

Currently, AskUserQuestion and "等待确认" (confirmation) both suspend the Mastra workflow. This couples agent-user interaction (asking questions) with workflow orchestration (confirming steps), making the chat behavior confusing — chat sometimes advances the workflow, sometimes doesn't.

## Design

Separate the two concepts:

| | AskUser | 等待确认 |
|---|---|---|
| Session status | `ASK_USER` (new) | unchanged |
| Workflow status | `RUNNING` (unchanged) | `SUSPENDED` |
| Chat input | enabled (continueSession, saves message only) | enabled (continueSession, normal chat) |
| Advancement | Chat message → step restarts executor internally | Confirm button → resumeWorkflow |

## Backend Changes

### 1. New session status `ASK_USER`
- Add to session status type
- Add to `SESSION_INPUT_STATUSES` on frontend

### 2. `workflows.ts` step function — internal polling loop
```
while true:
  start Claude Code executor
  if AskUser detected:
    kill process
    set session status = ASK_USER
    poll until session status != ASK_USER
    get latest user message from session events
    use as new prompt → continue loop
  else:
    execution complete → break

if step requires confirmation (template config):
  suspend workflow (等待确认)
else:
  mark step complete
```

### 3. `sessionService.continue()` — skip executor for ASK_USER
- When session is ASK_USER: save user message as event, set status to RUNNING, return immediately
- When session is other resumable status: existing behavior (start executor)

### 4. `workflowLifecycle` — new `onSessionAskUser()` method
- Only updates session status to ASK_USER
- Does NOT change workflow run status or step status
- Saves `ask_user` event to session events

### 5. Remove AskUser from Mastra suspend path
- The `STEP_AWAITING_USER_INPUT` exception catch in workflows.ts no longer calls `suspend()` or `onStepSuspend()`
- Instead, the step function handles it internally in the loop

## Frontend Changes

### 1. Session constants
- Add `ASK_USER` to `SESSION_INPUT_STATUSES` (chat enabled during AskUser)
- `ASK_USER` is NOT in `SESSION_BUSY_STATUSES` (chat not disabled)

### 2. StepSessionPanel
- Chat always uses `continueSession`, never `resumeWorkflow`
- Remove `workflowRunId` prop, `resumeWorkflow` import, `chatOnly` prop
- AskUser option buttons call `continueSession` (same as typing in chat)

### 3. WorkflowProgressDialog
- 等待确认: shows when workflow SUSPENDED (unchanged)
- AskUser: rendered from session `ask_user` events in StepSessionPanel

### 4. KanbanView
- Remove `:workflow-run-id` from StepSessionPanel
- No `disableInput` prop needed

## Verification
- AskUser question: session = ASK_USER, workflow = RUNNING, chat works
- Multiple AskUser rounds within one step
- 等待确认: workflow = SUSPENDED, confirm button shows
- Chat during confirmation: session continues, workflow stays SUSPENDED
- All existing tests pass
