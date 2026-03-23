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
import type { BroadcastPayload, SessionChannel, WebSocketPayload } from '../../src/types/ws/sessions.ts';

test.test('session shared boundary types accept canonical event-based assignments', () => {
  const createInput: CreateSessionInput = { task_id: 1, initial_prompt: 'continue' };
  const continueBody: ContinueSessionBody = { input: 'fix tests' };
  const session: SessionEntity = {
    id: 1,
    task_id: 10,
    status: 'RUNNING',
    worktree_path: '/repo/.worktrees/task-10',
    branch: 'task/10',
    initial_prompt: 'continue',
    created_at: '2026-03-23T00:00:00.000Z',
    updated_at: '2026-03-23T00:00:00.000Z',
  };
  const sessionListItem: SessionListItem = session;
  const segment: SessionSegmentEntity = {
    id: 2,
    session_id: 1,
    segment_index: 1,
    status: 'RUNNING',
    executor_type: 'claude_code',
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
  const listQuery: ListSessionEventsQuery = { after_seq: '1', limit: '50' };
  const listItem: SessionEventListItem = {
    id: 3,
    session_id: 1,
    segment_id: 2,
    seq: 1,
    kind: 'stream_chunk',
    role: 'assistant',
    content: 'hello',
    payload: { stream: 'stdout' },
    created_at: '2026-03-23T00:00:00.000Z',
  };
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
  const payload: WebSocketPayload = { type: 'subscribe', session_id: 1, channel: 'output' };
  const event: BroadcastPayload = { type: 'chunk', content: 'hello', stream: 'stdout' };
  const channel: SessionChannel = 'status';

  assert.equal(createInput.task_id, 1);
  assert.equal(continueBody.input, 'fix tests');
  assert.equal(sessionListItem.task_id, 10);
  assert.equal('output' in session, false);
  assert.equal(segment.segment_index, 1);
  assert.equal(segment.trigger_type, 'START');
  assert.equal('segment_type' in segment, false);
  assert.equal(sessionEvent.kind, 'stream_chunk');
  assert.equal(sessionEvent.seq, 1);
  assert.equal('event_type' in sessionEvent, false);
  assert.equal('sequence' in sessionEvent, false);
  assert.equal(listQuery.after_seq, '1');
  assert.equal('after' in listQuery, false);
  assert.equal(listItem.segment_id, 2);
  assert.equal(listItem.created_at, '2026-03-23T00:00:00.000Z');
  assert.equal(step.session_id, 1);
  assert.equal(step.summary, null);
  assert.equal(payload.channel, 'output');
  assert.equal(event.stream, 'stdout');
  assert.equal(channel, 'status');
});
