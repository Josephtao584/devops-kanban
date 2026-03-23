# Workflow Step Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each workflow step own a stable logical session whose full history is stored as unified session events, so the frontend can open any step and view historical plus incremental output without WebSocket.

**Architecture:** Keep `session` as the logical conversation root, add `session_segments` for provider/runtime resumability, and make `session_events` the single source of history. Workflow steps only store lightweight `session_id` and summary state, while executors emit canonical events through a sink and the frontend polls `after_seq` for incremental updates.

**Tech Stack:** Fastify 4, TypeScript, Node test runner, Vue 3, Element Plus, JSON-file repositories

---

## File Map

### Backend files to modify
- `backend/src/types/entities.ts` — remove session `output`, add `SessionSegmentEntity` / `SessionEventEntity`, add workflow step `session_id` / `summary`
- `backend/src/types/dto/sessions.ts` — align session DTOs with logical-session model
- `backend/src/types/dto/workflows.ts` — update workflow run response shape if step summary typing is enforced here later
- `backend/src/types/executors.ts` — extend executor input to support event emission and provider-state callbacks
- `backend/src/repositories/sessionRepository.ts` — stop defaulting `output`, keep session persistence focused on logical session fields
- `backend/src/repositories/workflowRunRepository.ts` — support writing `session_id`, `summary`, and updated step fields
- `backend/src/routes/sessions.ts` — add `GET /sessions/:id/events`, keep segment concerns internal, remove output-first flow
- `backend/src/routes/workflows.ts` — expose `steps[].session_id` and `steps[].summary`
- `backend/src/services/sessionService.ts` — refactor legacy output accumulation into session + segment + event creation
- `backend/src/services/workflow/workflowService.ts` — create/reuse per-step logical session, create a new segment per actual execution attempt, write step summary fields
- `backend/src/services/workflow/workflowStepExecutor.ts` — emit unified events through a sink instead of only returning final stdout/stderr blobs
- `backend/src/services/workflow/executors/claudeCodeExecutor.ts` — map Claude execution output into canonical event kinds
- `backend/src/services/workflow/executors/codexExecutor.ts` — map Codex execution output into canonical event kinds
- `backend/src/services/workflow/executors/opencodeExecutor.ts` — map OpenCode execution output into canonical event kinds
- `backend/src/services/workflow/stepResultAdapter.ts` — reduce reliance on final raw stdout/stderr snapshot semantics
- `frontend/src/api/session.js` — replace output endpoint usage with events endpoint helpers
- `frontend/src/api/workflow.js` — ensure workflow run payload includes session-aware step fields
- `frontend/src/components/WorkflowProgressDialog.vue` — convert from status-only dialog to step selector + session event detail pane
- `frontend/src/components/SessionTerminal.vue` — touch only if failing tests or removed `session.output` assumptions require it
- `frontend/src/composables/useSessionManager.js` — touch only if failing tests or removed `session.output` assumptions require it
- `frontend/src/stores/sessionStore.js` — touch only if DTO changes or failing tests prove it is impacted

### Backend files to create
- `backend/src/types/dto/sessionEvents.ts` — DTOs for listing session events
- `backend/src/repositories/sessionSegmentRepository.ts` — CRUD for `session_segments.json`
- `backend/src/repositories/sessionEventRepository.ts` — append/query `session_events.json` with monotonic session-level `seq`
- `backend/src/services/sessionSegmentService.ts` — create/find latest segments and manage provider session state
- `backend/src/services/sessionEventService.ts` — append/query events by `session_id` and `after_seq`
- `backend/src/services/workflow/executionEventSink.ts` — canonical append API for `message` / `tool_call` / `tool_result` / `status` / `error` / `artifact` / `stream_chunk`
- `frontend/src/composables/useSessionEvents.js` — fetch initial history and poll `after_seq`
- `frontend/src/components/workflow/StepSessionPanel.vue` — right-side event viewer for a selected workflow step
- `frontend/src/components/session/SessionEventRenderer.vue` — canonical renderer for event kinds

### Backend tests to modify/add
- `backend/test/contracts/sessionRouteInputTypes.test.ts` — update session DTO expectations, remove `output`, add event query DTO expectations
- `backend/test/contracts/workflowRouteInputTypes.test.ts` — update workflow run shape to include step `session_id` / `summary`
- `backend/test/workflowService.test.ts` — cover stable step session reuse + segment creation + step summary writes
- `backend/test/workflowStepExecutor.test.ts` — cover unified event emission, canonical event kinds only, and required `segment_id`
- `backend/test/sessionService.test.ts` — create if missing; cover session lifecycle without `output`
- `backend/test/sessionRoutes.test.ts` — create or extend; cover `/sessions/:id/events` and removal of output-first flow
- `backend/test/sessionSegmentService.test.ts` — create; cover segment creation, latest segment lookup, trigger types, provider state updates
- `backend/test/sessionEventService.test.ts` — create; cover append/query, `after_seq`, monotonic `seq`, `segment_id` required

### Frontend tests to add
- `frontend/tests/sessionApi.spec.js` — verify events endpoint helpers and polling semantics
- `frontend/tests/WorkflowProgressDialog.spec.js` — verify step click loads session history and running steps keep polling
- `frontend/tests/StepSessionPanel.spec.js` — verify unified event rendering and `after_seq` polling behavior

### Data files / runtime bootstrap
- `data/sessions.json` — existing runtime data must remain readable after removing `output`
- `data/session_segments.json` — new runtime storage; repository bootstrap must auto-create if missing
- `data/session_events.json` — new runtime storage; repository bootstrap must auto-create if missing
- `data/workflow_runs.json` — existing runtime records must tolerate missing `session_id` / `summary` until touched
- `data-sample/sessions.json` — align sample sessions with new schema (no `output`)
- `data-sample/session_segments.json` — sample segment data
- `data-sample/session_events.json` — sample event data
- `data-sample/workflow_runs.json` — sample `session_id` / `summary` on steps if sample workflow data exists

---

### Task 1: Redefine the core session, segment, and event contracts

**Files:**
- Modify: `backend/src/types/entities.ts`
- Modify: `backend/src/types/dto/sessions.ts`
- Create: `backend/src/types/dto/sessionEvents.ts`
- Modify: `backend/test/contracts/sessionRouteInputTypes.test.ts`

- [ ] **Step 1: Rewrite the session DTO contract test to remove `output` and add event list query types**

```ts
const createSessionBody: CreateSessionInput = {
  task_id: 7,
  initial_prompt: '实现 step 会话能力',
};

const listEventsQuery = {
  after_seq: '12',
  limit: '200',
};
```

- [ ] **Step 2: Run the session DTO contract test and verify it fails**

Run: `cd backend && npm test -- test/contracts/sessionRouteInputTypes.test.ts`
Expected: FAIL because session types still include `output` and event list query types do not exist.

- [ ] **Step 3: Add canonical entity contracts in `entities.ts`**

Use exact shapes:

```ts
export interface SessionEntity {
  id: number;
  task_id: number;
  status?: string;
  agent_id?: number | null;
  executor_type?: string | null;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SessionSegmentEntity {
  id: number;
  session_id: number;
  segment_index: number;
  status: string;
  executor_type: string;
  agent_id: number | null;
  provider_session_id?: string | null;
  resume_token?: string | null;
  checkpoint_ref?: string | null;
  trigger_type: 'START' | 'CONTINUE' | 'RESUME' | 'RETRY';
  parent_segment_id?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SessionEventEntity {
  id: number;
  session_id: number;
  segment_id: number;
  seq: number;
  kind: 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk';
  role: 'assistant' | 'system' | 'tool' | 'user';
  content: string;
  payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}
```

Also update workflow steps to include:

```ts
session_id?: number | null;
summary?: string | null;
```

- [ ] **Step 4: Define `sessionEvents.ts` DTOs for v1 list-only API**

```ts
export interface ListSessionEventsQuery {
  after_seq?: string;
  limit?: string;
}

export interface SessionEventListItem {
  id: number;
  session_id: number;
  segment_id: number;
  seq: number;
  kind: 'message' | 'tool_call' | 'tool_result' | 'status' | 'error' | 'artifact' | 'stream_chunk';
  role: 'assistant' | 'system' | 'tool' | 'user';
  content: string;
  payload: Record<string, unknown>;
  created_at: string;
}
```

- [ ] **Step 5: Update the contract test expectations to the new model**

Assert:
- no `output` on `SessionEntity`
- event list query DTO compiles
- `SessionSegmentEntity` and `SessionEventEntity` exist

- [ ] **Step 6: Run the session DTO contract test and verify it passes**

Run: `cd backend && npm test -- test/contracts/sessionRouteInputTypes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/types/entities.ts backend/src/types/dto/sessions.ts backend/src/types/dto/sessionEvents.ts backend/test/contracts/sessionRouteInputTypes.test.ts
git commit -m "refactor: redefine workflow session contracts"
```

### Task 2: Add JSON persistence and services for segments and events

**Files:**
- Modify: `backend/src/repositories/sessionRepository.ts`
- Create: `backend/src/repositories/sessionSegmentRepository.ts`
- Create: `backend/src/repositories/sessionEventRepository.ts`
- Create: `backend/src/services/sessionSegmentService.ts`
- Create: `backend/src/services/sessionEventService.ts`
- Test: `backend/test/sessionSegmentService.test.ts`
- Test: `backend/test/sessionEventService.test.ts`

- [ ] **Step 1: Write failing tests for segment indexing, monotonic event seq, and runtime bootstrap**

Add expectations like:

```ts
assert.equal(segment.segment_index, 1)
assert.equal(nextSegment.segment_index, 2)
assert.equal(event1.seq, 1)
assert.equal(event2.seq, 2)
assert.equal(event2.segment_id, segment.id)
```

Also verify repositories auto-create missing JSON files in a temp storage path.

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `cd backend && npm test -- test/sessionSegmentService.test.ts test/sessionEventService.test.ts`
Expected: FAIL because repositories/services do not exist.

- [ ] **Step 3: Remove output defaulting from `SessionRepository.create()`**

Delete:

```ts
override async create(sessionData) {
  return await super.create({
    ...sessionData,
    output: '',
  })
}
```

Replace with plain repository behavior.

- [ ] **Step 4: Create `SessionSegmentRepository` and `SessionEventRepository`**

Required methods:

```ts
// SessionSegmentRepository
findBySessionId(sessionId)
findLatestBySessionId(sessionId)
create(segment)
update(segmentId, update)

// SessionEventRepository
append(event)
listBySessionId(sessionId, { afterSeq, limit })
getLastSeq(sessionId)
```

- [ ] **Step 5: Implement `SessionSegmentService.createSegment()`**

```ts
const latest = await repo.findLatestBySessionId(sessionId)
return await repo.create({
  session_id: sessionId,
  segment_index: latest ? latest.segment_index + 1 : 1,
  status: 'CREATED',
  executor_type,
  agent_id,
  provider_session_id: null,
  resume_token: null,
  checkpoint_ref: null,
  trigger_type,
  parent_segment_id: latest?.id ?? null,
  started_at: null,
  completed_at: null,
  metadata: {},
})
```

- [ ] **Step 6: Implement `SessionEventService.appendEvent()` and `listEvents()`**

```ts
const lastSeq = await repo.getLastSeq(sessionId)
await repo.append({
  session_id: sessionId,
  segment_id,
  seq: lastSeq + 1,
  kind,
  role,
  content,
  payload,
})
```

Rules:
- `segment_id` required
- `after_seq` exclusive
- ascending `seq`
- `seq` monotonic per `session_id`

- [ ] **Step 7: Run the new tests and verify they pass**

Run: `cd backend && npm test -- test/sessionSegmentService.test.ts test/sessionEventService.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/repositories/sessionRepository.ts backend/src/repositories/sessionSegmentRepository.ts backend/src/repositories/sessionEventRepository.ts backend/src/services/sessionSegmentService.ts backend/src/services/sessionEventService.ts backend/test/sessionSegmentService.test.ts backend/test/sessionEventService.test.ts
git commit -m "feat: add session segments and events persistence"
```

### Task 3: Extend executor contracts and add the unified execution event sink

**Files:**
- Modify: `backend/src/types/executors.ts`
- Modify: `backend/src/services/workflow/workflowStepExecutor.ts`
- Create: `backend/src/services/workflow/executionEventSink.ts`
- Test: `backend/test/workflowStepExecutor.test.ts`

- [ ] **Step 1: Rewrite workflow step executor tests to expect sink-driven canonical events**

```ts
assert.equal(appendedEvents[0].kind, 'status')
assert.equal(appendedEvents[1].kind, 'message')
assert.equal(appendedEvents.every((event) => event.segment_id > 0), true)
```

- [ ] **Step 2: Run the workflow step executor tests and verify they fail**

Run: `cd backend && npm test -- test/workflowStepExecutor.test.ts`
Expected: FAIL because executors still return final stdout/stderr blobs only.

- [ ] **Step 3: Extend executor input with event/provider-state callbacks**

```ts
onEvent?: ((event: UnifiedExecutionEventInput) => void | Promise<void>)
onProviderState?: ((state: { providerSessionId?: string; resumeToken?: string; checkpointRef?: string }) => void | Promise<void>)
```

- [ ] **Step 4: Implement `ExecutionEventSink` helpers**

```ts
appendMessage(content, role = 'assistant')
appendToolCall(toolName, arguments)
appendToolResult(toolName, result)
appendStatus(from, to)
appendError(content, payload = {})
appendArtifact(content, payload)
appendStreamChunk(content, stream)
```

Each helper should call `SessionEventService.appendEvent()`.

- [ ] **Step 5: Inject the sink into `executeWorkflowStep()`**

```ts
await executor.execute({
  ...input,
  onEvent: async (event) => sink.append(event),
  onProviderState: async (state) => segmentService.updateProviderState(segmentId, state),
})
```

- [ ] **Step 6: Run the workflow step executor tests and verify they pass**

Run: `cd backend && npm test -- test/workflowStepExecutor.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/types/executors.ts backend/src/services/workflow/workflowStepExecutor.ts backend/src/services/workflow/executionEventSink.ts backend/test/workflowStepExecutor.test.ts
git commit -m "feat: emit canonical workflow session events"
```

### Task 4: Refactor session service and routes to use events instead of output snapshots

**Files:**
- Modify: `backend/src/services/sessionService.ts`
- Modify: `backend/src/routes/sessions.ts`
- Test: `backend/test/sessionService.test.ts`
- Test: `backend/test/sessionRoutes.test.ts`

- [ ] **Step 1: Write failing tests for session lifecycle without `output` and with `/sessions/:id/events`**

Cover:
- create session returns no `output`
- internal session start creates a segment
- internal session continue creates a new segment on the same logical session
- `/sessions/:id/events` returns `{ events, last_seq, has_more }`
- `/sessions/:id/output` is removed or no longer used

Note: generic session start/continue compatibility here is supporting infrastructure only, not the primary v1 acceptance target. The primary acceptance target remains workflow-step history + polling.

- [ ] **Step 2: Run the session service/route tests and verify they fail**

Run: `cd backend && npm test -- test/sessionService.test.ts test/sessionRoutes.test.ts`
Expected: FAIL because the service still accumulates `output` and the events route does not exist.

- [ ] **Step 3: Replace `_readProcessOutput()` string accumulation with sink/event appends**

Delete logic like:

```ts
const output: string[] = []
output.push(trimmed)
await this.sessionRepo.update(sessionId, { status, output: output.join('\n') })
```

Replace with appends through `SessionEventService` / `ExecutionEventSink`.

- [ ] **Step 4: Create/attach segments on `start()` and `continue()`**

At start:
- create segment with `trigger_type = 'START'`
- set `started_at`

At continue:
- create new segment with `trigger_type = 'CONTINUE'` or `RESUME`

This work exists to preserve internal session lifecycle consistency and future resumability; it is not the primary user-facing acceptance criterion for v1.

- [ ] **Step 5: Add `GET /sessions/:id/events` and do not add public segment routes in v1**

Expected response shape:

```json
{
  "success": true,
  "data": {
    "events": [],
    "last_seq": 0,
    "has_more": false
  }
}
```

- [ ] **Step 6: Run the session service/route tests and verify they pass**

Run: `cd backend && npm test -- test/sessionService.test.ts test/sessionRoutes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/sessionService.ts backend/src/routes/sessions.ts backend/test/sessionService.test.ts backend/test/sessionRoutes.test.ts
git commit -m "refactor: drive session history from event records"
```

### Task 5: Make workflow steps create/reuse logical sessions and create a new segment per attempt

**Files:**
- Modify: `backend/src/services/workflow/workflowService.ts`
- Modify: `backend/src/repositories/workflowRunRepository.ts`
- Modify: `backend/src/types/entities.ts`
- Test: `backend/test/workflowService.test.ts`
- Test: `backend/test/contracts/workflowRouteInputTypes.test.ts`

- [ ] **Step 1: Add failing tests for stable step session identity and step summary fields**

Cover:
- starting a workflow creates `steps[].session_id`
- same workflow-step-within-run keeps the same `session_id` on retry/continue
- each new attempt creates a new segment
- step summary no longer depends on `output`

- [ ] **Step 2: Run the workflow service tests and verify they fail**

Run: `cd backend && npm test -- test/workflowService.test.ts test/contracts/workflowRouteInputTypes.test.ts`
Expected: FAIL because workflow steps do not yet carry `session_id` or `summary`.

- [ ] **Step 3: Extend workflow step initialization with session-aware summary fields**

```ts
{
  step_id,
  name,
  status: 'PENDING',
  started_at: null,
  completed_at: null,
  retry_count: 0,
  session_id: null,
  summary: null,
  error: null,
}
```

- [ ] **Step 4: On step start, create or reuse the logical session and create the correct segment trigger**

```ts
const sessionId = existingStep.session_id ?? await sessionService.createWorkflowStepSession(...)
const triggerType = existingStep.session_id ? 'RETRY' : 'START'
const segment = await sessionSegmentService.createSegment(sessionId, { trigger_type: triggerType, ... })
await workflowRunRepo.updateStep(runId, stepId, { session_id: sessionId, status: 'RUNNING', started_at: now })
```

- [ ] **Step 5: On step completion/failure, write only summary/error to the step snapshot**

```ts
await workflowRunRepo.updateStep(runId, stepId, {
  status: 'COMPLETED',
  completed_at: now,
  summary: result.summary ?? null,
})
```

- [ ] **Step 6: Run the workflow service tests and verify they pass**

Run: `cd backend && npm test -- test/workflowService.test.ts test/contracts/workflowRouteInputTypes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/workflow/workflowService.ts backend/src/repositories/workflowRunRepository.ts backend/src/types/entities.ts backend/test/workflowService.test.ts backend/test/contracts/workflowRouteInputTypes.test.ts
git commit -m "feat: bind workflow steps to logical sessions"
```

### Task 6: Normalize Claude/Codex/OpenCode executors to the canonical event model

**Files:**
- Modify: `backend/src/services/workflow/executors/claudeCodeExecutor.ts`
- Modify: `backend/src/services/workflow/executors/codexExecutor.ts`
- Modify: `backend/src/services/workflow/executors/opencodeExecutor.ts`
- Modify: `backend/src/services/workflow/stepResultAdapter.ts`
- Test: `backend/test/workflowStepExecutor.test.ts`

- [ ] **Step 1: Add failing tests for canonical event kinds only**

Assert persisted events never use `stdout` or `stderr` as top-level kinds.

- [ ] **Step 2: Run the workflow step executor tests and verify they fail**

Run: `cd backend && npm test -- test/workflowStepExecutor.test.ts`
Expected: FAIL because adapters still think in stdout/stderr blobs.

- [ ] **Step 3: Map textual output into `stream_chunk` with `payload.stream`**

```ts
onStdoutChunk(chunk) => onEvent({ kind: 'stream_chunk', role: 'assistant', content: chunk, payload: { stream: 'stdout' } })
onStderrChunk(chunk) => onEvent({ kind: 'stream_chunk', role: 'system', content: chunk, payload: { stream: 'stderr' } })
```

- [ ] **Step 4: Preserve higher-level semantic events when available**

When an executor can detect structure, emit:
- `message`
- `tool_call`
- `tool_result`
- `artifact`

instead of degrading everything to chunks.

- [ ] **Step 5: Run the workflow step executor tests and verify they pass**

Run: `cd backend && npm test -- test/workflowStepExecutor.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/workflow/executors/claudeCodeExecutor.ts backend/src/services/workflow/executors/codexExecutor.ts backend/src/services/workflow/executors/opencodeExecutor.ts backend/src/services/workflow/stepResultAdapter.ts backend/test/workflowStepExecutor.test.ts
git commit -m "refactor: normalize executor output into session events"
```

### Task 7: Add frontend session-event API helpers and polling composable

**Files:**
- Modify: `frontend/src/api/session.js`
- Create: `frontend/src/composables/useSessionEvents.js`
- Test: `frontend/tests/sessionApi.spec.js`

- [ ] **Step 1: Write failing frontend API/composable tests for history + incremental polling**

Cover:
- `getSessionEvents(id, { afterSeq, limit })`
- composable appends new events using returned `last_seq`
- polling stops when session becomes terminal

- [ ] **Step 2: Run the frontend API tests and verify they fail**

Run: `cd frontend && npm run test:run -- sessionApi.spec.js`
Expected: FAIL because events API/composable do not exist.

- [ ] **Step 3: Replace output helper with events helper in `frontend/src/api/session.js`**

```js
export const getSessionEvents = (id, params = {}) => api.get(`/sessions/${id}/events`, { params })
```

Stop using:

```js
export const getSessionOutput = (id) => api.get(`/sessions/${id}/output`)
```

- [ ] **Step 4: Implement `useSessionEvents.js` with exact polling behavior**

```js
const events = ref([])
const lastSeq = ref(0)
async function loadInitial(sessionId) { ... }
async function pollNext(sessionId) { ... }
function startPolling(sessionId, isTerminal) { ... }
function stopPolling() { ... }
```

- [ ] **Step 5: Run the frontend API/composable tests and verify they pass**

Run: `cd frontend && npm run test:run -- sessionApi.spec.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/session.js frontend/src/composables/useSessionEvents.js frontend/tests/sessionApi.spec.js
git commit -m "feat: add session event polling api"
```

### Task 8: Replace workflow step dialog detail pane with a session event viewer

**Files:**
- Modify: `frontend/src/components/WorkflowProgressDialog.vue`
- Create: `frontend/src/components/workflow/StepSessionPanel.vue`
- Create: `frontend/src/components/session/SessionEventRenderer.vue`
- Test: `frontend/tests/WorkflowProgressDialog.spec.js`
- Test: `frontend/tests/StepSessionPanel.spec.js`

- [ ] **Step 1: Write failing component tests for step selection and event rendering**

Cover:
- default selection prefers running step, otherwise last step with `session_id`
- clicking a step loads session history
- panel renders `message`, `tool_call`, `tool_result`, `status`, `error`, `artifact`, `stream_chunk`
- polling appends new events while session is still running

- [ ] **Step 2: Run the frontend component tests and verify they fail**

Run: `cd frontend && npm run test:run -- WorkflowProgressDialog.spec.js StepSessionPanel.spec.js`
Expected: FAIL because the dialog is still status-only.

- [ ] **Step 3: Create `SessionEventRenderer.vue` with canonical rendering per event kind**

Map exactly:
- `message` → bubble
- `tool_call` / `tool_result` → cards
- `status` → system row
- `error` → error row
- `artifact` → artifact row
- `stream_chunk` → monospace block

- [ ] **Step 4: Create `StepSessionPanel.vue` that loads session details and uses `useSessionEvents()`**

```js
props: {
  sessionId: Number,
  sessionStatus: String,
  stepName: String,
}
```

- [ ] **Step 5: Refactor `WorkflowProgressDialog.vue` into two-pane layout**

The dialog should:
- keep the left step list
- track `selectedStepId`
- compute `selectedStep`
- render `StepSessionPanel` on the right when `selectedStep.session_id` exists
- still poll workflow run status separately for overall step status changes

- [ ] **Step 6: Run the frontend component tests and verify they pass**

Run: `cd frontend && npm run test:run -- WorkflowProgressDialog.spec.js StepSessionPanel.spec.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/WorkflowProgressDialog.vue frontend/src/components/workflow/StepSessionPanel.vue frontend/src/components/session/SessionEventRenderer.vue frontend/tests/WorkflowProgressDialog.spec.js frontend/tests/StepSessionPanel.spec.js
git commit -m "feat: show workflow step session history"
```

### Task 9: Remove remaining output-based assumptions from legacy session UI and align runtime/sample data

**Files:**
- Modify: `frontend/src/components/SessionTerminal.vue`
- Modify: `frontend/src/composables/useSessionManager.js`
- Modify: `data-sample/sessions.json`
- Create: `data-sample/session_segments.json`
- Create: `data-sample/session_events.json`

- [ ] **Step 1: Identify the remaining `session.output` assumptions**

Search for exact usages of:
- `response.data.output`
- `session.output`

- [ ] **Step 2: Remove output-string initialization from `SessionTerminal.vue` and related composables**

Replace blocks like:

```js
if (response.data.output) {
  const lines = response.data.output.split('\n')
}
```

with either event history loading or an empty-state fallback where that UI is not yet migrated.

- [ ] **Step 3: Align sample data and runtime bootstrap expectations**

Ensure sample records use:
- sessions without `output`
- segments with `provider_session_id`
- events with `segment_id`, `seq`, `kind`, `payload.stream`

Do not hand-edit runtime `data/*.json` unless absolutely required; prefer repository bootstrap.

- [ ] **Step 4: Run targeted frontend/backend tests to verify no output-based flow remains**

Run:
- `cd frontend && npm run test:run -- WorkflowProgressDialog.spec.js StepSessionPanel.spec.js`
- `cd backend && npm test -- test/sessionService.test.ts test/sessionRoutes.test.ts test/workflowService.test.ts test/workflowStepExecutor.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SessionTerminal.vue frontend/src/composables/useSessionManager.js data-sample/sessions.json data-sample/session_segments.json data-sample/session_events.json
git commit -m "refactor: remove legacy session output assumptions"
```

### Task 10: Run the full verification suite and final review handoff

**Files:**
- Verify only

- [ ] **Step 1: Run backend focused verification**

```bash
cd backend && npm test -- test/contracts/sessionRouteInputTypes.test.ts test/sessionService.test.ts test/sessionRoutes.test.ts test/sessionSegmentService.test.ts test/sessionEventService.test.ts test/workflowService.test.ts test/workflowStepExecutor.test.ts test/contracts/workflowRouteInputTypes.test.ts
```

Expected: PASS

- [ ] **Step 2: Run frontend focused verification**

```bash
cd frontend && npm run test:run -- WorkflowProgressDialog.spec.js StepSessionPanel.spec.js sessionApi.spec.js
```

Expected: PASS

- [ ] **Step 3: Manually verify the workflow step history flow**

Manual checklist:
- start a workflow with at least one running step
- open workflow progress dialog
- verify running step is selected by default
- verify right panel loads existing history for selected step
- keep dialog open and verify new events appear without refresh
- switch to a completed step and verify history remains available
- optionally, if generic session continue remains wired in this branch, verify a new `session_segment` is created while the logical `session_id` stays the same

- [ ] **Step 4: Request review with `@superpowers:requesting-code-review` before merge or handoff**

- [ ] **Step 5: Use `@superpowers:verification-before-completion` before any final success claim**

- [ ] **Step 6: Commit final fixes if verification surfaces anything**

```bash
git add <specific files>
git commit -m "fix: address workflow step session verification issues"
```
