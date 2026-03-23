import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { ContinueSessionBody, CreateSessionInput, SessionListItem } from '../../src/types/dto/sessions.ts';
import type { ListSessionEventsQuery, SessionEventListItem } from '../../src/types/dto/sessionEvents.ts';
import type {
  SessionEntity,
  SessionEventEntity,
  SessionSegmentEntity,
  WorkflowStepEntity,
} from '../../src/types/entities.ts';

test.test('session shared boundary types accept canonical event-based assignments', () => {
  const assertCreateSessionInput = (_value: CreateSessionInput) => {};
  const assertContinueSessionBody = (_value: ContinueSessionBody) => {};
  const assertListSessionEventsQuery = (_value: ListSessionEventsQuery) => {};
  const assertSessionListItem = (_value: SessionListItem) => {};
  const assertSessionEventListItem = (_value: SessionEventListItem) => {};
  const assertSessionEntity = (_value: SessionEntity) => {};
  const assertSessionSegmentEntity = (_value: SessionSegmentEntity) => {};
  const assertSessionEventEntity = (_value: SessionEventEntity) => {};
  const assertWorkflowStepEntity = (_value: WorkflowStepEntity) => {};

  assertCreateSessionInput({ task_id: 1, initial_prompt: 'continue' });
  // @ts-expect-error task_id remains required on CreateSessionInput
  assertCreateSessionInput({ initial_prompt: 'continue' });
  const createInput: CreateSessionInput = { task_id: 1, initial_prompt: 'continue' };

  assertContinueSessionBody({ input: 'fix tests' });
  // @ts-expect-error ContinueSessionBody uses input, not prompt
  assertContinueSessionBody({ prompt: 'fix tests' });
  const continueBody: ContinueSessionBody = { input: 'fix tests' };

  const session: SessionEntity = {
    id: 1,
    task_id: 10,
    status: 'RUNNING',
    worktree_path: '/repo/.worktrees/task-10',
    branch: 'task/10',
    initial_prompt: 'continue',
    agent_id: 7,
    executor_type: 'CLAUDE_CODE',
    started_at: '2026-03-23T00:00:00.000Z',
    completed_at: null,
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
  };
  assertSessionEntity(session);
  // @ts-expect-error SessionEntity executor_type uses canonical ExecutorType values
  assertSessionEntity({ ...session, executor_type: 'claude_code' });
  const sessionListItem: SessionListItem = session;
  assertSessionListItem(sessionListItem);

  const segment: SessionSegmentEntity = {
    id: 2,
    session_id: 1,
    segment_index: 1,
    status: 'RUNNING',
    executor_type: 'CLAUDE_CODE',
    agent_id: 7,
    provider_session_id: null,
    resume_token: null,
    checkpoint_ref: null,
    trigger_type: 'START',
    parent_segment_id: null,
    started_at: '2026-03-23T00:00:00.000Z',
    completed_at: null,
    metadata: { source: 'workflow-step' },
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
  };
  assertSessionSegmentEntity(segment);
  // @ts-expect-error SessionSegmentEntity executor_type uses canonical ExecutorType values
  assertSessionSegmentEntity({ ...segment, executor_type: 'claude_code' });

  const sessionEvent: SessionEventEntity = {
    id: 3,
    session_id: 1,
    segment_id: 2,
    seq: 1,
    kind: 'stream_chunk',
    role: 'assistant',
    content: 'hello',
    payload: { stream: 'stdout' },
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
  };
  assertSessionEventEntity(sessionEvent);

  const listQuery: ListSessionEventsQuery = { after_seq: '1', limit: '50' };
  assertListSessionEventsQuery(listQuery);
  // @ts-expect-error ListSessionEventsQuery uses after_seq, not after
  assertListSessionEventsQuery({ after: '1', limit: '50' });

  const listItem: SessionEventListItem = {
    id: 3,
    session_id: 1,
    segment_id: 2,
    seq: 1,
    kind: 'stream_chunk',
    role: 'assistant',
    content: 'hello',
    payload: { segment_id: 2 },
    created_at: '2026-03-23T00:00:00.000Z',
  };
  assertSessionEventListItem(listItem);

  const step: WorkflowStepEntity = {
    step_id: 'design',
    name: 'Design',
    status: 'RUNNING',
    started_at: null,
    completed_at: null,
    retry_count: 0,
    error: null,
    session_id: 1,
    summary: null,
  };
  assertWorkflowStepEntity(step);

  // @ts-expect-error SessionEntity no longer exposes output
  session.output;
  // @ts-expect-error SessionSegmentEntity uses trigger_type, not segment_type
  segment.segment_type;
  // @ts-expect-error SessionEventEntity uses kind, not event_type
  sessionEvent.event_type;
  // @ts-expect-error SessionEventEntity uses seq, not sequence
  sessionEvent.sequence;
  // @ts-expect-error ListSessionEventsQuery uses after_seq, not after
  listQuery.after;
  // @ts-expect-error SessionEventListItem uses created_at, not createdAt
  listItem.createdAt;

  assert.equal(createInput.task_id, 1);
  assert.equal(continueBody.input, 'fix tests');
  assert.equal(sessionListItem.task_id, 10);
  assert.equal(session.agent_id, 7);
  assert.equal(session.executor_type, 'CLAUDE_CODE');
  assert.equal(session.completed_at, null);
  assert.equal(segment.segment_index, 1);
  assert.equal(segment.trigger_type, 'START');
  assert.equal(sessionEvent.kind, 'stream_chunk');
  assert.equal(sessionEvent.seq, 1);
  assert.equal(listQuery.after_seq, '1');
  assert.equal(listItem.segment_id, 2);
  assert.deepEqual(listItem.payload, { segment_id: 2 });
  assert.equal(listItem.created_at, '2026-03-23T00:00:00.000Z');
  assert.equal(step.session_id, 1);
  assert.equal(step.summary, null);
});
