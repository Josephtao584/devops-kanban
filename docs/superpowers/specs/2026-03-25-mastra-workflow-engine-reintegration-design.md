# Mastra Workflow Engine Reintegration Design

## Context

After implementing user-editable workflow templates, the Mastra framework integration became dead code. `workflows.ts` still contains Mastra imports and hardcoded step definitions, but `workflowService.ts` bypasses Mastra entirely with a custom for-loop execution in `_runWorkflowTemplate`.

**Goal:** Restore Mastra as the full workflow orchestration engine, driving step sequencing, state management, and cancellation — while preserving compatibility with dynamic user-editable templates.

## Approach: Dynamic Workflow Factory

Each workflow run dynamically builds a Mastra workflow from the user's template at runtime. Mastra drives step execution; side-effects (session/segment/status tracking) are separated into a lifecycle handler.

## Design

### 1. Dynamic Workflow Factory (`workflows.ts`)

Replace hardcoded 4-step workflow with a factory function:

```
buildWorkflowFromTemplate(template: WorkflowTemplate): MastraWorkflow
```

**Logic:**
1. Iterate `template.steps`, each step becomes a `createStep`:
   - First step `inputSchema`: `{ taskId, taskTitle, taskDescription, worktreePath }`
   - Subsequent steps `inputSchema`: `{ summary: string }` (upstream output)
   - All steps share `stateSchema`: `{ taskTitle, taskDescription, worktreePath }`
   - `execute` function: calls `executeWorkflowStep` (pure agent call)
2. `createWorkflow({ id: template.template_id, ... }).then(step0).then(step1)...commit()`
3. Return committed workflow object

**Delete:** `requirementDesignStep`, `codeDevelopmentStep`, `testingStep`, `codeReviewStep`, `buildDevWorkflow()`, `_devWorkflow`, `getDevWorkflow()`.

**Keep:** `initWorkflows()` (Mastra instance + LibSQLStore init), `getMastra()`, `sharedStateSchema`.

**Deduplicate:** Remove `buildWorkflowSharedState` duplicate in `workflowService.ts`; import from `workflows.ts`.

### 2. Execution Flow (`workflowService.ts`)

Replace `_runWorkflowTemplate` for-loop with Mastra-driven execution:

```
_executeWorkflow(runId, task, template):
  try:
    1. buildWorkflowFromTemplate(template)     // may throw on invalid template
    2. workflow.createRun({ runId: String(runId) })
    3. const output = run.stream({ inputData: { taskId, taskTitle, taskDescription, worktreePath } })
    4. for await (event of output.fullStream):
         workflow-step-start  → (informational, onStepStart already called inside execute)
         workflow-step-finish → lifecycle.onStepComplete(runId, stepId, result)
         workflow-step-error  → lifecycle.onStepError(runId, stepId, error)
    5. const result = await output.result
    6. Based on result.status:
         success   → workflowRunRepo.update(COMPLETED), task.update(DONE)
         failed    → workflowRunRepo.update(FAILED), task.reset(TODO)
         canceled  → workflowRunRepo.update(CANCELLED), task.reset(TODO)
  catch (err):
    // Handles: buildWorkflowFromTemplate failure, stream drop, unexpected errors
    lifecycle.onStepError(runId, currentStep, err)   // finalize running step if any
    workflowRunRepo.update(runId, { status: 'FAILED' })
    task.reset(TODO)
```

**Event flow detail:**
- `onStepStart` is called inside the step's `execute` function (before agent call)
- Mastra emits `workflow-step-finish` / `workflow-step-error` to the stream after `execute` returns/throws
- Stream consumer calls `onStepComplete` / `onStepError` in response
- If `onStepStart` itself throws, the step aborts and Mastra emits `workflow-step-error`

**Cancellation:**

Mastra's `createRun({ runId })` with an existing ID attaches to persisted state, and `run.cancel()` updates the status in storage. However, the in-flight AbortSignal propagation to the running step relies on the same process holding the run reference. Therefore, retain a minimal in-memory map for cancellation:

```
_activeRuns: Map<number, { run: MastraRun }>

cancelWorkflow(runId):
  activeRun = _activeRuns.get(runId)
  if (activeRun):
    activeRun.run.cancel()     // sends AbortSignal to running step
  else:
    // fallback: reconstruct from storage (handles edge cases)
    template = workflowRunRepo.findById(runId).workflow_template_snapshot
    workflow = buildWorkflowFromTemplate(template)
    run = workflow.createRun({ runId: String(runId) })
    run.cancel()
  workflowRunRepo.update(runId, { status: 'CANCELLED' })
```

The map stores only the Mastra run reference; entries are added after `createRun()` and deleted in `finally`.

**Concurrent run guard:** The existing check-then-act pattern in `startWorkflow` (findLatestByTaskId → check status → create) is a pre-existing race condition over JSON storage. The `_activeRuns` map provides a secondary in-memory guard. A full fix requires atomic storage operations and is out of scope.

**Delete:** `_runWorkflowTemplate`, `WorkflowExecutionContext` interface, `runWithWorkflowExecutionContext`, manual step management methods (extracted into WorkflowLifecycle).

### 3. Step Execution & Side-Effects Separation

**Step execute function** (generated by factory):

```typescript
execute: async ({ inputData, state, abortSignal, abort }) => {
  await lifecycle.onStepStart(runId, stepId)

  const result = await executeWorkflowStep({
    stepId,
    worktreePath: state.worktreePath,
    state,
    inputData,
    templateSnapshot,
    abortSignal,
    upstreamStepIds: previousStepIds,  // computed by factory from step position
  })

  if (abortSignal?.aborted) {
    return abort()
  }

  return result   // returned to Mastra, which emits workflow-step-finish to stream
}
```

- `onStepStart` is inside execute because Mastra's `workflow-step-start` stream event fires concurrently, not before execute
- `executeWorkflowStep` remains pure (agent call only, no lifecycle awareness)
- `upstreamStepIds` is computed by the factory: empty for first step, `[previousStep.id]` for subsequent

**WorkflowLifecycle** (new class, extracted from existing methods):

```
WorkflowLifecycle {
  onStepStart(runId, stepId)              → create session/segment, mark step RUNNING
  onStepComplete(runId, stepId, result)   → mark step COMPLETED, store summary
  onStepError(runId, stepId, error)       → mark step FAILED, store error
}
```

Dependencies: `workflowRunRepo`, `sessionRepo`, `sessionSegmentRepo`.

### 4. Data Model

- `workflowRunRepo` (JSON) continues to exist — tracks kanban business data (task association, template snapshot, step list)
- Mastra LibSQLStore tracks orchestration engine internal state
- RunId mapping: numeric ID from `workflowRunRepo` → `String(id)` for Mastra

### 5. AbortSignal Propagation

Full chain: Mastra `run.cancel()` → AbortSignal → step `execute` → `executeWorkflowStep` → executor → child process kill.

**Changes required (moderate, not minor):**

1. **`executeWorkflowStep`**: Accept `abortSignal: AbortSignal` parameter. Wire it up:
   ```
   abortSignal.addEventListener('abort', () => {
     context?.proc?.kill?.('SIGTERM')
   })
   ```

2. **`ExecutorExecutionInput` type** (`executors.ts`): Add optional `abortSignal?: AbortSignal` field.

3. **Executor implementations** (`claudeCodeExecutor.ts`, `codexExecutor.ts`, `opencodeExecutor.ts`): Listen to `abortSignal` to kill spawned child process. Pattern:
   ```
   if (input.abortSignal) {
     input.abortSignal.addEventListener('abort', () => proc.kill('SIGTERM'))
   }
   ```

### 6. `executionEventSink.ts`

Keep unchanged. It handles real-time event streaming to WebSocket clients and is orthogonal to `WorkflowLifecycle` which handles persistent state changes.

## File Changes

| File | Action |
|------|--------|
| `workflows.ts` | **Rewrite**: hardcoded steps → `buildWorkflowFromTemplate()` factory |
| `workflowService.ts` | **Refactor**: `_executeWorkflow` uses Mastra `run.stream()`; delete `_runWorkflowTemplate`, manual step methods; simplify `_activeRuns` to `Map<number, { run }>` |
| `workflowStepExecutor.ts` | **Moderate**: accept `abortSignal`, wire to proc.kill |
| `workflowExecutionContext.ts` | **Delete**: no longer needed |
| `workflowLifecycle.ts` | **New**: step lifecycle management |
| `executors.ts` | **Minor**: add `abortSignal` to `ExecutorExecutionInput` |
| `claudeCodeExecutor.ts` | **Minor**: listen to abortSignal, kill child process |
| `codexExecutor.ts` | **Minor**: listen to abortSignal, kill child process |
| `opencodeExecutor.ts` | **Minor**: listen to abortSignal, kill child process |
| `workflowPromptAssembler.ts` | No change |
| `workflowTemplateService.ts` | No change |
| `stepResultAdapter.ts` | No change |
| `agentExecutorRegistry.ts` | No change |
| `executionEventSink.ts` | No change |
| `workflowService.test.ts` | **Rewrite**: test stream-based execution, lifecycle calls, cancellation |
| `workflowStepExecutor.test.ts` | **Update**: add abortSignal propagation tests |
