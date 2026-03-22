import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateIterationInput,
  UpdateIterationInput,
} from '../../src/types/dto/iterations.ts';

test.test('iteration route and service DTOs accept explicit create and update inputs', () => {
  const createInput: CreateIterationInput = {
    name: 'Sprint 12',
    project_id: 1,
    status: 'PLANNED',
  };

  const updateInput: UpdateIterationInput = {
    name: 'Sprint 12A',
    status: 'ACTIVE',
  };

  assert.equal(createInput.project_id, 1);
  assert.equal(updateInput.status, 'ACTIVE');
});
