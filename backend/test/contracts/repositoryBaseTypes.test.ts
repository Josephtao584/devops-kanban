import * as test from 'node:test';
import * as assert from 'node:assert/strict';

import type { BaseEntity } from '../../src/repositories/base.ts';
import type { IterationEntity } from '../../src/repositories/iterationRepository.ts';

type HasStringIndexSignature<T> = string extends keyof T ? true : false;

test.test('repository base entities keep explicit fields without broad index signatures', () => {
  const baseEntity: BaseEntity = {
    id: 1,
    created_at: '2026-03-22T00:00:00.000Z',
    updated_at: '2026-03-22T00:00:00.000Z',
    external_id: 'ext-1',
  };

  const iterationEntity: IterationEntity = {
    id: 2,
    created_at: '2026-03-22T00:00:00.000Z',
    updated_at: '2026-03-22T00:00:00.000Z',
    project_id: 10,
    name: 'Sprint 1',
  };

  const baseEntityHasIndexSignature: HasStringIndexSignature<BaseEntity> = false;
  const iterationEntityHasIndexSignature: HasStringIndexSignature<IterationEntity> = false;

  assert.equal(baseEntity.id, 1);
  assert.equal(baseEntity.external_id, 'ext-1');
  assert.equal(iterationEntity.project_id, 10);
  assert.equal(iterationEntity.name, 'Sprint 1');
  assert.equal(baseEntityHasIndexSignature, false);
  assert.equal(iterationEntityHasIndexSignature, false);
});
