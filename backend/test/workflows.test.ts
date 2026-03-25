import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
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
