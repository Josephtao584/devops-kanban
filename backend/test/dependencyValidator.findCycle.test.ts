import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCycleById } from '../src/services/workflow/dependencyValidator.js';

test('findCycleById returns null for empty graph', () => {
  assert.equal(findCycleById(new Map()), null);
});

test('findCycleById returns null for single node without deps', () => {
  const map = new Map<number, number[]>([[1, []]]);
  assert.equal(findCycleById(map), null);
});

test('findCycleById detects self-loop', () => {
  const map = new Map<number, number[]>([[1, [1]]]);
  const cycle = findCycleById(map);
  assert.ok(cycle, 'expected a cycle path');
  assert.equal(cycle![0], cycle![cycle!.length - 1]);
});

test('findCycleById detects simple cycle 1→2→1', () => {
  const map = new Map<number, number[]>([
    [1, [2]],
    [2, [1]],
  ]);
  const cycle = findCycleById(map);
  assert.ok(cycle, 'expected a cycle path');
  assert.equal(cycle![0], cycle![cycle!.length - 1]);
  assert.ok(cycle!.length >= 3);
});

test('findCycleById detects long cycle 1→2→3→4→1', () => {
  const map = new Map<number, number[]>([
    [1, [2]],
    [2, [3]],
    [3, [4]],
    [4, [1]],
  ]);
  const cycle = findCycleById(map);
  assert.ok(cycle);
  assert.equal(cycle![0], cycle![cycle!.length - 1]);
  assert.equal(cycle!.length, 5);
});

test('findCycleById returns null for DAG', () => {
  const map = new Map<number, number[]>([
    [1, []],
    [2, [1]],
    [3, [1]],
    [4, [2, 3]],
  ]);
  assert.equal(findCycleById(map), null);
});

test('findCycleById finds a cycle when multiple exist', () => {
  const map = new Map<number, number[]>([
    [1, [2]],
    [2, [1]],
    [3, [4]],
    [4, [3]],
  ]);
  const cycle = findCycleById(map);
  assert.ok(cycle);
  assert.equal(cycle![0], cycle![cycle!.length - 1]);
});
