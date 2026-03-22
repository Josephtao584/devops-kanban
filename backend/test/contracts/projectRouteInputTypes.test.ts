import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '../../src/types/dto/projects.ts';

test.test('project route and service DTOs accept explicit create and update inputs', () => {
  const createInput: CreateProjectInput = {
    name: 'Platform',
    description: 'Platform rewrite',
    git_url: 'https://example.com/repo.git',
  };

  const createWithNullableFields: CreateProjectInput = {
    name: 'Infra',
    git_url: null,
    local_path: null,
  };

  const updateInput: UpdateProjectInput = {
    name: 'Platform v2',
    local_path: '/repos/platform',
  };

  const updateWithNullableFields: UpdateProjectInput = {
    description: 'Refined scope',
    git_url: null,
  };

  assert.equal(createInput.name, 'Platform');
  assert.equal(createWithNullableFields.git_url, null);
  assert.equal(updateInput.local_path, '/repos/platform');
  assert.equal(updateWithNullableFields.git_url, null);
});
