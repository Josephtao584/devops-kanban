# Mastra Workflow Engine Reintegration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Mastra as the full workflow orchestration engine by dynamically building Mastra workflows from user-editable templates at runtime.

**Architecture:** Replace the custom for-loop in `_runWorkflowTemplate` with Mastra's `run.stream()` API. Side-effects (session/segment/status) are extracted into a `WorkflowLifecycle` class. AbortSignal propagation enables clean cancellation from Mastra through to child processes.

**Tech Stack:** `@mastra/core` ^1.14.0, `@mastra/libsql` ^1.7.1, Zod, Node.js test runner

**Spec:** `docs/superpowers/specs/2026-03-25-mastra-workflow-engine-reintegration-design.md`

---

### Task 1: Add AbortSignal to ExecutorExecutionInput type

**Files:**
- Modify: `backend/src/types/executors.ts:37-44`

- [ ] **Step 1: Add abortSignal field to ExecutorExecutionInput**

```typescript
// In ExecutorExecutionInput, add after onProviderState:
abortSignal?: AbortSignal | undefined;
```

- [ ] **Step 2: Verify build passes**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (no consumers use the new field yet)

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/executors.ts
git commit -m "feat: add abortSignal to ExecutorExecutionInput type"
```

---

### Task 2: Wire AbortSignal through ClaudeStepRunner

> **Note:** The spec lists `claudeCodeExecutor.ts` in the file changes table, but the actual child process spawning happens in `claudeStepRunner.ts` which `claudeCodeExecutor` delegates to. Wiring the signal at the spawn level is more correct.

**Files:**
- Modify: `backend/src/services/workflow/executors/claudeStepRunner.ts:59-68,130-146`
- Test: `backend/test/claudeStepRunner.test.ts` (if exists, else skip test step)

- [ ] **Step 1: Add abortSignal to defaultSpawnImpl parameter and wire to child process**

In `defaultSpawnImpl`, add `abortSignal?: AbortSignal` to the parameter object (line 64). After `onSpawn?.(proc)` (line 86), add:

```typescript
if (abortSignal) {
  if (abortSignal.aborted) {
    spawnedProc.kill('SIGTERM');
  } else {
    abortSignal.addEventListener('abort', () => {
      spawnedProc.kill('SIGTERM');
    }, { once: true });
  }
}
```

- [ ] **Step 2: Add abortSignal to ClaudeStepRunner.runStep parameter and pass to spawnImpl**

In `runStep` (line 130), add `abortSignal?: AbortSignal` to the parameter object. Pass it to `this.spawnImpl`:

```typescript
const execution = await this.spawnImpl({
  worktreePath,
  prompt,
  executorConfig,
  ...(onSpawn ? { onSpawn } : {}),
  ...(abortSignal ? { abortSignal } : {}),
});
```

- [ ] **Step 3: Verify build passes**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/workflow/executors/claudeStepRunner.ts
git commit -m "feat: wire abortSignal through ClaudeStepRunner to child process"
```

---

### Task 3: Wire AbortSignal through executor implementations

**Files:**
- Modify: `backend/src/services/workflow/executors/claudeCodeExecutor.ts:12-26`
- Modify: `backend/src/services/workflow/executors/codexExecutor.ts:13`
- Modify: `backend/src/services/workflow/executors/opencodeExecutor.ts:13`

- [ ] **Step 1: ClaudeCodeExecutor — destructure abortSignal and pass to runner**

In `execute` method (line 12), add `abortSignal` to destructured params. Pass to `this.runner.runStep`:

```typescript
async execute({
  prompt,
  worktreePath,
  executorConfig,
  onSpawn,
  onEvent,
  onProviderState,
  abortSignal,
}: ExecutorExecutionInput): Promise<ExecutorExecutionResult> {
  const sink = new ExecutionEventSink({ onEvent, onProviderState });
  const result = await this.runner.runStep({
    prompt,
    worktreePath,
    executorConfig,
    ...(onSpawn ? { onSpawn } : {}),
    ...(abortSignal ? { abortSignal } : {}),
  });
  // ... rest unchanged
```

- [ ] **Step 2: CodexExecutor and OpenCodeExecutor — no code change needed**

These pass the full `input` object to `runImpl(input)`. Since `input` now has `abortSignal` from the type change in Task 1, it flows through automatically (`this.runImpl(input)` at line 18 in both files). These executors delegate to a user-provided `runImpl` callback and do not spawn child processes directly, so there is no process handle to wire the signal to. The `runImpl` implementation is responsible for handling `abortSignal` if it spawns processes.

- [ ] **Step 3: Verify build passes**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/workflow/executors/claudeCodeExecutor.ts
git commit -m "feat: wire abortSignal through ClaudeCodeExecutor"
```

---

### Task 4: Add abortSignal to executeWorkflowStep

**Files:**
- Modify: `backend/src/services/workflow/workflowStepExecutor.ts:22-39,75-141`
- Test: `backend/test/workflowStepExecutor.test.ts`

- [ ] **Step 1: Write failing test for abortSignal propagation**

Add test in `workflowStepExecutor.test.ts`:

```typescript
it('passes abortSignal to executor', async () => {
  const ac = new AbortController();
  let receivedSignal: AbortSignal | undefined;

  const mockExecutor = {
    execute: async (input: any) => {
      receivedSignal = input.abortSignal;
      return { exitCode: 0, stdout: '{"result":"ok"}', stderr: '', proc: null, rawResult: { summary: 'ok' } };
    },
  };

  // Use your existing test harness pattern to set up mock registry, agent, template
  // Pass abortSignal: ac.signal to executeWorkflowStep
  // Assert receivedSignal === ac.signal
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --test-name-pattern "passes abortSignal"`
Expected: FAIL

- [ ] **Step 3: Add abortSignal to ExecuteWorkflowStepInput interface and wire to executor**

In `ExecuteWorkflowStepInput` (line 22), add:

```typescript
abortSignal?: AbortSignal | undefined;
```

In the `executeWorkflowStep` function body, after the `onSpawn` callback sets `context.proc`, add a defense-in-depth AbortSignal listener (around line 125, after `executor.execute` call setup):

```typescript
// Belt-and-suspenders: if executor doesn't handle abortSignal, kill proc from here
if (abortSignal && context) {
  abortSignal.addEventListener('abort', () => {
    context?.proc?.kill?.('SIGTERM');
  }, { once: true });
}

const execution: ExecutorExecutionResult = await executor.execute({
  prompt,
  worktreePath,
  executorConfig,
  abortSignal,
  onSpawn: (proc) => {
    if (context) {
      context.proc = proc;
    }
  },
  // ... rest unchanged
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- --test-name-pattern "passes abortSignal"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflow/workflowStepExecutor.ts backend/test/workflowStepExecutor.test.ts
git commit -m "feat: add abortSignal support to executeWorkflowStep"
```

---

### Task 5: Create WorkflowLifecycle class

**Files:**
- Create: `backend/src/services/workflow/workflowLifecycle.ts`
- Test: `backend/test/workflowLifecycle.test.ts`

This class extracts lifecycle methods from `workflowService.ts`. The methods to extract are `_handleWorkflowStepStart` (lines 498-558), `_handleWorkflowStepCompletion` (lines 639-645), `_handleWorkflowStepFailure` (lines 648-651), `_handleWorkflowStepCancellation` (lines 654-658), and all supporting private methods they depend on: `_getRunStep`, `_getTemplateStepBinding`, `_createLogicalStepSession`, `_createStepAttemptSegment`, `_getCurrentAttemptSegment`, `_finalizeCancelledStepStart`, `_syncCancelledStepArtifacts`, `_finalizeStepArtifacts`, `_isWorkflowRunCancelled`, `_isWorkflowStepCancelled`, `_finalizeRunningStepAfterUnexpectedError`, step-attempt-segment-id tracking (`_stepAttemptSegmentIds` Map and helpers).

> **Dependencies:** `workflowRunRepo`, `sessionRepo`, `sessionSegmentRepo` are listed in the spec. Additionally, `agentRepo` and `workflowTemplateService` are needed by `_createLogicalStepSession` and `_getTemplateStepBinding` which are moved alongside the lifecycle methods.

- [ ] **Step 1: Write failing test for WorkflowLifecycle.onStepStart**

Create `backend/test/workflowLifecycle.test.ts`. Test that `onStepStart` creates a session, creates a segment, and updates the step to RUNNING. Use the same mock repository pattern from `workflowService.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --test-name-pattern "onStepStart"`
Expected: FAIL (module not found)

- [ ] **Step 3: Create WorkflowLifecycle class**

Create `backend/src/services/workflow/workflowLifecycle.ts` with:

```typescript
import { WorkflowRunRepository } from '../../repositories/workflowRunRepository.js';
import { AgentRepository } from '../../repositories/agentRepository.js';
import { SessionRepository } from '../../repositories/sessionRepository.js';
import { SessionSegmentRepository } from '../../repositories/sessionSegmentRepository.js';
import { WorkflowTemplateService } from './workflowTemplateService.js';
import type { WorkflowTemplate } from './workflowTemplateService.js';
import type { SessionEntity, SessionSegmentEntity, WorkflowRunEntity, WorkflowStepEntity } from '../../types/entities.ts';
import type { ExecutorType } from '../../types/executors.js';

// Move these interfaces and all supporting private methods from workflowService.ts:
// - _getRunStep, _getTemplateStepBinding
// - _createLogicalStepSession, _createStepAttemptSegment
// - _getCurrentAttemptSegment, _isWorkflowRunCancelled, _isWorkflowStepCancelled
// - _finalizeCancelledStepStart, _syncCancelledStepArtifacts, _finalizeStepArtifacts
// - _finalizeRunningStepAfterUnexpectedError
// - _stepAttemptSegmentIds Map and helpers

class WorkflowLifecycle {
  // Dependencies: same repos as WorkflowService used for these methods
  constructor({ workflowRunRepo, agentRepo, sessionRepo, sessionSegmentRepo, workflowTemplateService }: { ... })

  // Public API (renamed from _handleWorkflowStep* for clarity)
  async onStepStart(runId, stepId, task)        // was _handleWorkflowStepStart
  async onStepComplete(runId, stepId, result)    // was _handleWorkflowStepCompletion
  async onStepError(runId, stepId, errorMessage) // was _handleWorkflowStepFailure
  async onStepCancel(runId, stepId)              // was _handleWorkflowStepCancellation
  async onUnexpectedError(runId, errorMessage)   // was _finalizeRunningStepAfterUnexpectedError
}

export { WorkflowLifecycle };
```

Move the method bodies verbatim from `workflowService.ts`. Keep the same logic, just different class and public method names.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- --test-name-pattern "onStepStart"`
Expected: PASS

- [ ] **Step 5: Write tests for onStepComplete, onStepError, onStepCancel**

Follow the same pattern — test that each method calls the right repo updates with the right statuses.

- [ ] **Step 6: Run all lifecycle tests**

Run: `cd backend && npm test -- --test-name-pattern "WorkflowLifecycle"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/workflow/workflowLifecycle.ts backend/test/workflowLifecycle.test.ts
git commit -m "feat: extract WorkflowLifecycle from WorkflowService"
```

---

### Task 6: Rewrite workflows.ts as dynamic factory

**Files:**
- Rewrite: `backend/src/services/workflow/workflows.ts`
- Test: `backend/test/workflows.test.ts`

- [ ] **Step 1: Write failing test for buildWorkflowFromTemplate**

Create `backend/test/workflows.test.ts`:

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowFromTemplate } from '../src/services/workflow/workflows.js';

describe('buildWorkflowFromTemplate', () => {
  it('builds a committed workflow from a 2-step template', async () => {
    const template = {
      template_id: 'test-wf',
      name: 'Test',
      steps: [
        { id: 'step-a', name: 'A', instructionPrompt: 'Do A', agentId: 1 },
        { id: 'step-b', name: 'B', instructionPrompt: 'Do B', agentId: 2 },
      ],
    };

    const workflow = buildWorkflowFromTemplate(template);
    assert.ok(workflow, 'should return a workflow object');
    assert.equal(typeof workflow.createRun, 'function', 'should have createRun method');
  });

  it('builds workflow with correct number of steps from a 3-step template', () => {
    const template = {
      template_id: 'test-3step',
      name: 'Three Step',
      steps: [
        { id: 's1', name: 'S1', instructionPrompt: 'Do 1', agentId: 1 },
        { id: 's2', name: 'S2', instructionPrompt: 'Do 2', agentId: 2 },
        { id: 's3', name: 'S3', instructionPrompt: 'Do 3', agentId: 3 },
      ],
    };

    const workflow = buildWorkflowFromTemplate(template);
    assert.ok(workflow);
    assert.equal(typeof workflow.createRun, 'function');
  });
});
```

> **Design note:** `buildWorkflowFromTemplate` accepts an optional second `options` parameter for binding runtime context (runId, lifecycle, task) into step closures. This is necessary because Mastra's `createStep` captures the `execute` function at definition time — there is no later hook to inject runtime state. Without options, lifecycle calls are skipped (used for structural tests). The workflow is not reusable across runs by design; we build a fresh one per run.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --test-name-pattern "buildWorkflowFromTemplate"`
Expected: FAIL

- [ ] **Step 3: Rewrite workflows.ts**

Replace the entire file with the dynamic factory. Key structure:

```typescript
import * as path from 'node:path';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { STORAGE_PATH } from '../../config/index.js';
import { executeWorkflowStep } from './workflowStepExecutor.js';
import type { WorkflowTemplate } from './workflowTemplateService.js';
import type { WorkflowLifecycle } from './workflowLifecycle.js';

const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
});

const stepOutputSchema = z.object({ summary: z.string() });

const firstStepInputSchema = z.object({
  taskId: z.number(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
});

let _mastra: Mastra | null = null;
let _initialized = false;

export async function initWorkflows() {
  if (_initialized) return;
  const dbPath = path.join(STORAGE_PATH as string, 'mastra.db');
  _mastra = new Mastra({
    storage: new LibSQLStore({ id: 'kanban-workflow-store', url: `file:${dbPath}` }),
  });
  _initialized = true;
}

export function getMastra() {
  if (!_mastra) throw new Error('Mastra not initialized. Call initWorkflows() first.');
  return _mastra;
}

interface BuildWorkflowOptions {
  runId: number;
  task: { id: number; execution_path: string };
  lifecycle: WorkflowLifecycle;
  templateSnapshot: WorkflowTemplate;
}

export function buildWorkflowFromTemplate(
  template: WorkflowTemplate,
  options?: BuildWorkflowOptions,
) {
  const steps = template.steps.map((templateStep, index) => {
    const isFirst = index === 0;
    const previousStepId = index > 0 ? template.steps[index - 1].id : null;

    return createStep({
      id: templateStep.id,
      inputSchema: isFirst ? firstStepInputSchema : stepOutputSchema,
      outputSchema: stepOutputSchema,
      stateSchema: sharedStateSchema,
      execute: async ({ inputData, state, abortSignal, abort }) => {
        if (options) {
          await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
        }

        const result = await executeWorkflowStep({
          stepId: templateStep.id,
          worktreePath: state.worktreePath,
          state,
          inputData,
          templateSnapshot: options?.templateSnapshot ?? template,
          abortSignal,
          upstreamStepIds: previousStepId ? [previousStepId] : [],
        });

        if (abortSignal?.aborted) {
          return abort();
        }

        return result;
      },
    });
  });

  let workflow = createWorkflow({
    id: template.template_id,
    inputSchema: firstStepInputSchema,
    outputSchema: stepOutputSchema,
    stateSchema: sharedStateSchema,
  });

  for (const step of steps) {
    workflow = workflow.then(step);
  }

  workflow.commit();
  return workflow;
}

export { sharedStateSchema };
```

Delete: `buildDevWorkflow`, `_devWorkflow`, `getDevWorkflow`, `requirementDesignStep`, `codeDevelopmentStep`, `testingStep`, `codeReviewStep`, `buildWorkflowSharedState`, `buildStepExecutorInput`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- --test-name-pattern "buildWorkflowFromTemplate"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflow/workflows.ts backend/test/workflows.test.ts
git commit -m "feat: rewrite workflows.ts as dynamic Mastra workflow factory"
```

---

### Task 7: Refactor workflowService to use Mastra run.stream()

**Files:**
- Modify: `backend/src/services/workflow/workflowService.ts`
- Delete: `backend/src/services/workflow/workflowExecutionContext.ts`
- Test: `backend/test/workflowService.test.ts`

This is the core integration task. Replace `_runWorkflowTemplate` for-loop with Mastra-driven execution.

- [ ] **Step 1: Replace imports and constructor dependencies**

Remove imports:
- `import { runWithWorkflowExecutionContext } from './workflowExecutionContext.js'`
- `import { executeWorkflowStep } from './workflowStepExecutor.js'`

Add imports:
- `import { buildWorkflowFromTemplate, initWorkflows } from './workflows.js'`
- `import { WorkflowLifecycle } from './workflowLifecycle.js'`

Add `lifecycle: WorkflowLifecycle` to constructor and `this.lifecycle`.

Change `_activeRuns` type from current complex type to `Map<number, { run: ReturnType<Awaited<ReturnType<typeof buildWorkflowFromTemplate>>['createRun']> }>` (or use `any` initially and refine after verifying Mastra's exported types).

- [ ] **Step 2: Replace _executeWorkflow method**

Replace the entire `_executeWorkflow` method (lines 753-852) with:

```typescript
async _executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string }, templateSnapshot: WorkflowTemplate) {
  try {
    await this.workflowRunRepo.update(runId, { status: 'RUNNING' });

    const workflow = buildWorkflowFromTemplate(templateSnapshot, {
      runId,
      task: { id: task.id, execution_path: task.execution_path },
      lifecycle: this.lifecycle,
      templateSnapshot,
    });

    const run = await workflow.createRun({ runId: String(runId) });
    this._activeRuns.set(runId, { run });

    const output = run.stream({
      inputData: {
        taskId: task.id,
        taskTitle: task.title || 'Untitled Task',
        taskDescription: task.description || '',
        worktreePath: task.execution_path,
      },
      state: {
        taskTitle: task.title || 'Untitled Task',
        taskDescription: task.description || '',
        worktreePath: task.execution_path,
      },
    });

    for await (const event of output.fullStream) {
      if (event.type === 'workflow-step-finish') {
        const stepId = event.payload?.stepName;
        const result = event.payload?.output ?? {};
        if (stepId) {
          await this.lifecycle.onStepComplete(runId, stepId, normalizeStepResult(result));
        }
      } else if (event.type === 'workflow-step-error') {
        const stepId = event.payload?.stepName;
        const error = event.payload?.error;
        if (stepId) {
          await this.lifecycle.onStepError(runId, stepId, typeof error === 'string' ? error : String(error ?? 'Step failed'));
        }
      }
    }

    const result = await output.result;

    if (result.status === 'success') {
      await this.workflowRunRepo.update(runId, {
        status: 'COMPLETED',
        context: result.result ?? {},
        current_step: null,
      });
      await this.taskRepo.update(task.id, { status: 'DONE' });
    } else if (result.status === 'canceled') {
      await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
      await this._resetTaskToTodo(task.id);
    } else {
      await this.workflowRunRepo.update(runId, {
        status: 'FAILED',
        context: { error: 'Workflow failed' },
        current_step: null,
      });
      await this._resetTaskToTodo(task.id);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await this.lifecycle.onUnexpectedError(runId, errorMessage).catch(() => {});
    await this.workflowRunRepo.update(runId, {
      status: 'FAILED',
      context: { error: errorMessage },
      current_step: null,
    }).catch(() => {});
    await this._resetTaskToTodo(task.id);
  } finally {
    this._activeRuns.delete(runId);
  }
}
```

- [ ] **Step 3: Replace cancelWorkflow method**

```typescript
async cancelWorkflow(runId: number) {
  const run = await this.workflowRunRepo.findById(runId) as WorkflowRunEntity | null;
  if (!run) {
    const error = new Error('Workflow run not found') as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
    const error = new Error(`Cannot cancel workflow in status: ${run.status}`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  // Cancel via in-memory run reference (sends AbortSignal to running step)
  const activeRun = this._activeRuns.get(runId);
  if (activeRun?.run) {
    await activeRun.run.cancel();
  } else {
    // Fallback: reconstruct from storage (handles edge cases where
    // _activeRuns entry was cleaned up but run is still marked RUNNING)
    const template = (run.workflow_template_snapshot as WorkflowTemplate | null)
      ?? await this._loadTemplate(run.workflow_template_id ?? undefined);
    const workflow = buildWorkflowFromTemplate(template);
    const reconstructedRun = await workflow.createRun({ runId: String(runId) });
    await reconstructedRun.cancel();
  }

  // Finalize running step
  const runningStep = (run.current_step
    ? run.steps.find((candidate) => candidate.step_id === run.current_step && candidate.status === 'RUNNING')
    : null) || run.steps.find((candidate) => candidate.status === 'RUNNING');

  if (runningStep) {
    await this.lifecycle.onStepCancel(runId, runningStep.step_id).catch(() => {});
  }

  const updatedRun = await this.workflowRunRepo.update(runId, { status: 'CANCELLED' });
  await this._resetTaskToTodo((run as { task_id?: number }).task_id ?? 0);
  return updatedRun;
}
```

- [ ] **Step 4: Delete dead code from workflowService.ts**

Remove from `WorkflowService`:
- `_runWorkflowTemplate` method
- `_handleWorkflowStepStart`, `_handleWorkflowStepCompletion`, `_handleWorkflowStepFailure`, `_handleWorkflowStepCancellation`
- `_finalizeStepArtifacts`, `_finalizeRunningStepAfterUnexpectedError`, `_syncCancelledStepArtifacts`, `_finalizeCancelledStepStart`
- `_createLogicalStepSession`, `_createStepAttemptSegment`, `_getCurrentAttemptSegment`
- `_getRunStep`, `_getTemplateStepBinding`
- `_isWorkflowRunCancelled`, `_isWorkflowStepCancelled`, `_shouldSkipWorkflowSuccessFinalization`
- `_stepAttemptSegmentIds` Map and helpers
- `_buildInitialWorkflowState` and local `buildWorkflowSharedState` duplicate (deduplication achieved by inlining state construction directly in `_executeWorkflow`)
- `WorkflowExecutionContext` interface, `ActiveRunContext` interface
- `RunWorkflowTemplateArgs` interface

**Keep:** `normalizeStepResult` (used by `_executeWorkflow` stream event handler), `toStepState` (used by `startWorkflow`), validation helpers.

- [ ] **Step 5: Delete workflowExecutionContext.ts**

Remove the file entirely. It contained AsyncLocalStorage-based context that is no longer needed.

- [ ] **Step 6: Verify build passes**

Run: `cd backend && npx tsc --noEmit`
Expected: PASS (or fix any remaining import/type issues)

- [ ] **Step 7: Commit**

```bash
git add -u backend/src/services/workflow/
git rm backend/src/services/workflow/workflowExecutionContext.ts
git commit -m "feat: refactor workflowService to use Mastra run.stream() orchestration"
```

---

### Task 8: Update workflowService tests

**Files:**
- Modify: `backend/test/workflowService.test.ts`

The existing tests reference methods and interfaces that were removed or renamed. This task updates them to work with the new Mastra-driven architecture.

- [ ] **Step 1: Assess which tests break**

Run: `cd backend && npm test -- --test-name-pattern "WorkflowService" 2>&1 | head -100`

Identify failing tests. Likely failures:
- Tests that mock `_runWorkflowTemplate` or `executeWorkflowStep` directly
- Tests that reference `WorkflowExecutionContext`
- Tests that check `_activeRuns` internals
- Tests that call `_handleWorkflowStep*` methods directly

- [ ] **Step 2: Fix tests for new architecture**

For each failing test:
- Replace `_runWorkflowTemplate` mocks with Mastra `buildWorkflowFromTemplate` mocks
- Replace `executeWorkflowStep` expectations with `lifecycle.onStepStart/Complete/Error` expectations
- Replace `_activeRuns` assertions with `run.cancel()` assertions
- Keep all behavioral tests (start, cancel, get, validation) — only change the internals they hook into

- [ ] **Step 3: Add cancellation flow test**

Ensure at least one test covers the full cancellation path:

```typescript
it('cancelWorkflow calls run.cancel() and finalizes step via lifecycle', async () => {
  // Setup: create a run in RUNNING status with a mock Mastra run in _activeRuns
  // Act: call cancelWorkflow(runId)
  // Assert:
  //   - mockRun.cancel() was called
  //   - lifecycle.onStepCancel was called for the running step
  //   - workflowRunRepo.update was called with status CANCELLED
  //   - task was reset to TODO
});
```

- [ ] **Step 4: Run full test suite**

Run: `cd backend && npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit cleanup**

```bash
git add backend/test/workflowService.test.ts
git commit -m "test: update workflowService tests for Mastra stream-based execution"
```

---

### Task 9: Verify end-to-end and clean up

**Files:**
- Verify: all modified files

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && npm test`
Expected: ALL PASS

- [ ] **Step 2: Verify build**

Run: `cd backend && npm run build`
Expected: PASS

- [ ] **Step 3: Remove unused imports in all touched files**

Scan for and remove any imports that are no longer used after the refactoring. Specifically check:

```bash
cd backend && grep -rn "getDevWorkflow\|getWorkflowExecutionContext\|runWithWorkflowExecutionContext\|buildStepExecutorInput" src/ --include="*.ts"
```

Any hits outside the deleted files indicate imports that need updating. Expected: no hits (only `workflows.ts` exported these, only `workflowService.ts` consumed them, both are already updated).

- [ ] **Step 4: Run tests again after cleanup**

Run: `cd backend && npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit cleanup**

```bash
git add -u backend/
git commit -m "chore: clean up unused imports after Mastra reintegration"
```
