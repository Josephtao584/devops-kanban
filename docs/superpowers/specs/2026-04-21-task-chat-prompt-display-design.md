# Feature Design: Display Assembled Prompt in Task Chat

## Context

Workflow step prompts are assembled by `assembleWorkflowPrompt()` and sent to AI agents but never persisted. Users cannot see what prompt was actually sent during execution. This feature stores the assembled prompt and displays it in the frontend chat panel.

## Architecture

### Data Flow

```
assembleWorkflowPrompt() → prompt string
  → executeWorkflowStep() emits via onAssembledPrompt callback
    → workflows.ts receives it in step execution
      → workflowLifecycle.onStepStart() stores in step.assembledPrompt
        → WorkflowRunRepository serializes to workflow_runs.steps JSON
          → GET /api/workflows/runs/:id returns it (no new API needed)
            → StepSessionPanel.vue reads from step data, renders in collapsible
```

### Backend Changes

**`backend/src/types/entities.ts`**
- `WorkflowStepEntity` add optional field: `assembledPrompt?: string`

**`backend/src/services/workflow/workflowStepExecutor.ts`**
- `ExecuteWorkflowStepInput` interface add: `onAssembledPrompt?: (prompt: string) => void | Promise<void>`
- After `assembleWorkflowPrompt()` call, invoke `onAssembledPrompt(prompt)`

**`backend/src/services/workflow/workflows.ts`**
- In `buildWorkflowFromInstance()`, pass `onAssembledPrompt` callback to `executeWorkflowStep()`
- The callback stores prompt in a local variable accessible to the step start lifecycle hook

**`backend/src/services/workflow/workflowLifecycle.ts`**
- `onStepStart()` accepts `assembledPrompt` in the step update payload
- Uses `WorkflowRunRepository.updateStep()` to persist it

### Frontend Changes

**`frontend/src/components/workflow/StepSessionPanel.vue`**
- Add an `ElButton` "查看 Prompt" in the top toolbar (alongside existing toggles)
- Toggle a `showPrompt` ref that controls visibility of a collapsible panel
- Collapsible panel: dark background, monospace font, `white-space: pre-wrap`, copy button
- Data source: `props.step` or fetched from workflow run data; read `step.assembledPrompt`

## Error Handling

- `assembledPrompt` is optional — if absent (old runs), the button is hidden or shows "该步骤未记录 Prompt"
- No backend migration needed — existing JSON simply lacks the field

## Verification

1. Run a workflow step execution, then check the step data contains `assembledPrompt`
2. Open the step session panel in the frontend, click "查看 Prompt", verify prompt content matches
3. Check older workflow runs (without the field) still render correctly without errors
