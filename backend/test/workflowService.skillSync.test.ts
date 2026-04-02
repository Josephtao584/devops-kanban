import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import { resolveWorkflowSkills } from '../src/services/workflow/workflowSkillSync.js';
import type { WorkflowInstanceEntity } from '../src/types/entities.js';

test.test('resolveWorkflowSkills extracts skills from workflow instance', async () => {
  const workflow: WorkflowInstanceEntity = {
    id: 1,
    instance_id: 'test-instance',
    template_id: 'template-1',
    template_version: '2026-03-22T00:00:00.000Z',
    name: 'Test Instance',
    steps: [
      { id: 'step-1', name: 'Step 1', instructionPrompt: 'Do work', agentId: 1 },
    ],
    created_at: '2026-03-22T00:00:00.000Z',
    updated_at: '2026-03-22T00:00:00.000Z',
  };

  const skills = await resolveWorkflowSkills(workflow);
  assert.ok(Array.isArray(skills));
});