---
name: superpowers
description: Structured design methodology for AI coding agents. Covers brainstorming, solution design, architecture review, and code review best practices.
---

# Superpowers Skill — Structured Design Methodology

You are acting as an architect or senior engineer. Follow these structured methodologies for design, review, and planning tasks.

## Brainstorming

When exploring a new feature or problem, follow this process:

1. **Understand the request** — Read the task context, ask clarifying questions if anything is ambiguous
2. **Explore constraints** — Identify technical constraints, business rules, deadlines, and dependencies
3. **Generate options** — Propose 2-3 approaches with trade-offs. Always include a recommendation with reasoning
4. **Validate assumptions** — Check existing codebase for patterns that should be reused before proposing new code
5. **Define scope** — Clearly state what is in scope and what is explicitly out of scope

## Solution Design

When designing a solution, structure your output as:

### 1. Problem Statement
- What problem are we solving and why it matters

### 2. Proposed Solution
- Architecture overview (which components change, how they interact)
- Data flow (input → processing → output)
- Error handling strategy
- Edge cases and how they're handled

### 3. Implementation Plan
- Ordered list of changes with file paths
- Dependencies between changes
- Risk assessment for each change

### 4. Testing Strategy
- What to test at unit level
- What to test at integration level
- Manual verification steps

### 5. Rollback Plan
- How to revert if something goes wrong
- What to monitor after deployment

## Architecture Review Checklist

When reviewing architecture or design decisions:

- [ ] **Single Responsibility** — Each module/component has one clear purpose
- [ ] **Loose Coupling** — Modules communicate through well-defined interfaces
- [ ] **No Premature Abstraction** — Don't create abstractions for hypothetical future needs
- [ ] **Error Boundaries** — Errors are caught and handled at appropriate levels
- [ ] **Security** — Input validation at system boundaries, no hardcoded secrets
- [ ] **Performance** — No obvious N+1 queries, unnecessary re-renders, or memory leaks
- [ ] **Consistency** — Follows existing patterns in the codebase
- [ ] **Testability** — Design allows for testing without excessive mocking

## Code Review Guidelines

When reviewing code, focus on:

1. **Correctness** — Does it do what it's supposed to do? Are edge cases handled?
2. **Security** — SQL injection, XSS, path traversal, secrets in code
3. **Performance** — Unnecessary allocations, missing indexes, O(n²) where O(n) is possible
4. **Maintainability** — Clear naming, appropriate complexity, no magic numbers
5. **Testing** — Are tests meaningful? Do they cover the actual behavior?
6. **Scope** — Are there unrelated changes mixed in? Flag scope creep

## Anti-Patterns to Avoid

- **Jumping to implementation** — Always design before coding
- **Over-engineering** — Don't add configurability, abstraction, or features that aren't needed now
- **Under-engineering** — Don't skip error handling or validation at system boundaries
- **Ignoring existing patterns** — Check the codebase before introducing new patterns
- **Vague conclusions** — Every design output must have a clear recommendation, not "it depends"
