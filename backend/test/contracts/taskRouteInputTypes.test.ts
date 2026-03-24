import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateTaskInput,
  StartTaskInput,
  UpdateTaskInput,
} from '../../src/types/dto/tasks.ts';
import type { WorkflowTemplate } from '../../src/services/workflow/workflowTemplateService.ts';

function buildWorkflowTemplateSnapshot(): WorkflowTemplate {
  return {
    template_id: 'quick-fix-v1-custom',
    name: '快速修复工作流（任务定制）',
    steps: [
      {
        id: 'triage',
        name: '问题定位',
        instructionPrompt: '先确认问题范围。',
        agentId: 11,
      },
      {
        id: 'fix',
        name: '实施修复',
        instructionPrompt: '完成最小修复。',
        agentId: 12,
      },
    ],
  };
}

const workflowTemplateSnapshot = buildWorkflowTemplateSnapshot();

test.test('task route and service DTOs accept explicit create, start, and update inputs', () => {
  const createInput: CreateTaskInput = {
    title: 'Split route module',
    project_id: 1,
    priority: 'HIGH',
  };

  const createWithOptionalFields: CreateTaskInput = {
    title: 'Wire source metadata',
    project_id: 2,
    external_id: null,
    workflow_run_id: null,
    worktree_path: null,
    worktree_branch: null,
  };

  const startInput: StartTaskInput = {
    workflow_template_id: 'quick-fix-v1',
    workflow_template_snapshot: workflowTemplateSnapshot,
  };

  const snapshotOnlyStartInput: StartTaskInput = {
    workflow_template_snapshot: workflowTemplateSnapshot,
  };

  const snapshotStepIds = startInput.workflow_template_snapshot?.steps.map((step) => step.id);

  const snapshotOnlyTemplateId = snapshotOnlyStartInput.workflow_template_snapshot?.template_id;

  const typedSnapshot: WorkflowTemplate = startInput.workflow_template_snapshot!;

  const updateInput: UpdateTaskInput = {
    title: 'Split route module safely',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
  };

  const updateWithNullableFields: UpdateTaskInput = {
    description: 'Refine task payload',
    external_id: null,
    workflow_run_id: null,
    worktree_path: null,
    worktree_branch: null,
  };

  assert.equal(createInput.project_id, 1);
  assert.equal(createWithOptionalFields.external_id, null);
  assert.equal(startInput.workflow_template_id, 'quick-fix-v1');
  assert.deepEqual(snapshotStepIds, ['triage', 'fix']);
  assert.equal(snapshotOnlyTemplateId, 'quick-fix-v1-custom');
  assert.equal(typedSnapshot.name, '快速修复工作流（任务定制）');
  assert.equal(updateInput.status, 'IN_PROGRESS');
  assert.equal(updateWithNullableFields.worktree_path, null);
});
