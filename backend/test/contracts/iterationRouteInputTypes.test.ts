import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateIterationInput,
  UpdateIterationInput,
} from '../../src/types/dto/iterations.ts';

test.test('iteration route and service DTOs accept explicit create and update inputs', () => {
  const createInput: CreateIterationInput = {
    name: 'Sprint 12',
    description: '稳定版本冲刺',
    goal: '完成收尾',
    project_id: 1,
    start_date: '2026-03-01',
    end_date: '2026-03-15',
    status: 'PLANNED',
  };

  const updateInput: UpdateIterationInput = {
    name: 'Sprint 12A',
    description: '进入验收',
    goal: '完成验收',
    start_date: '2026-03-02',
    end_date: '2026-03-18',
    status: 'ACTIVE',
  };

  assert.equal(createInput.project_id, 1);
  assert.equal(createInput.description, '稳定版本冲刺');
  assert.equal(updateInput.status, 'ACTIVE');
  assert.equal(updateInput.goal, '完成验收');
});
