---
name: tdd
description: Test-Driven Development methodology for AI coding agents. Covers red-green-refactor cycle, test-first design, minimal implementation, and regression testing.
---

# TDD Skill — Test-Driven Development

You are following strict Test-Driven Development. Always write tests before implementation.

## Core Principle

**Red → Green → Refactor**

1. Write a failing test that describes the desired behavior
2. Write the minimal code to make the test pass
3. Refactor while keeping all tests green

## Workflow

### Step 1: Understand Requirements
- Read the task description and acceptance criteria
- Identify core behaviors, edge cases, and error scenarios
- Check existing tests for patterns to follow

### Step 2: Write Failing Tests First
- Write tests that describe the expected behavior
- Each test should cover ONE specific behavior
- Run tests to confirm they FAIL (red phase)
- Name tests descriptively: `should {expected behavior} when {condition}`

### Step 3: Minimal Implementation
- Write ONLY enough code to make the failing tests pass (green phase)
- Do NOT add features that aren't tested
- Do NOT refactor yet
- Run tests to confirm they PASS

### Step 4: Refactor
- Clean up code while keeping tests green
- Remove duplication, improve naming, simplify logic
- Run tests after each refactoring step
- Do NOT change behavior during refactoring

## Test Categories

### Unit Tests
- Test individual functions/methods in isolation
- Mock external dependencies (APIs, databases, file system)
- Fast execution, no I/O
- Cover: core logic, edge cases, error handling

### Integration Tests
- Test multiple components working together
- Use real databases or in-memory alternatives when possible
- Cover: API endpoints, data flows, cross-component interactions

### End-to-End Tests
- Test complete user workflows
- Use real browser automation (Playwright)
- Cover: critical user paths, happy paths and error paths

## Test Design Rules

1. **Arrange-Act-Assert** — Structure every test clearly
2. **One assertion per concept** — Multiple assertions are OK if they test the same behavior
3. **No test interdependence** — Each test must run independently
4. **Meaningful assertions** — Assert behavior, not implementation details
5. **Cover the unhappy path** — Error cases, invalid input, missing data
6. **Don't test frameworks** — Trust library behavior, test your code

## Regression Testing

When fixing a bug:
1. **Write a test that reproduces the bug** — This test must fail
2. **Fix the bug** — Make the test pass with minimal changes
3. **Run all tests** — Ensure no regressions
4. **The bug test prevents recurrence** — It stays in the test suite

## Anti-Patterns

- **Writing tests after implementation** — You lose the design benefit of TDD
- **Testing implementation details** — Tests become brittle and break on refactoring
- **100% coverage obsession** — Coverage is a side effect, not a goal
- **Skipping edge cases** — "It works on my machine" is not a test strategy
- **Mocking everything** — Over-mocking means tests pass but code is broken in production
- **Writing trivial tests** — `expect(1+1).toBe(2)` adds no value
