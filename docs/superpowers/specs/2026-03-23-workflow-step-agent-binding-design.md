# Workflow Step Agent Binding Design

## Goal
Replace workflow step-level executor configuration with step-to-agent associations so that each workflow step selects an agent, and the agent becomes the single source of execution configuration at runtime.

After this change:
- each workflow step binds to one agent
- each agent owns executor runtime configuration
- workflow startup performs full preflight validation for all step-agent bindings
- step execution resolves launch parameters from the bound agent instead of `step.executor`

## Scope

### In scope
- workflow template step schema changes from `executor` to `agentId`
- agent schema expansion so agents carry executor runtime configuration
- backend workflow startup validation for all bound agents
- backend step execution refactor to resolve executor config from agents
- frontend workflow template editing changes to bind an agent per step
- frontend agent editing changes to manage executor runtime configuration
- focused tests covering the new resolution and validation flow

### Out of scope
- default agent fallback when a step has no binding
- step-level overrides for command, args, env, or skills
- run-time agent config snapshots stored on workflow runs
- multi-agent collaboration inside a single step
- broader workflow engine redesign
- migration and backward-compatibility handling for old schema/data

## Constraints
- each workflow step must bind exactly one agent before a workflow can start
- invalid workflow configuration must fail before workflow execution begins
- the agent is the only source of executor runtime configuration
- keep the current executor registry model; only change where executor input comes from
- preserve the current fixed workflow step structure
- this version does not freeze agent bindings or config snapshots into workflow runs; after startup, in-flight runs continue to resolve the current template and current agent records at step execution time
- this is a one-shot development-stage schema change, so old `step.executor` and old `agent.type` compatibility is not required

## Recommended Approach
Use direct per-step `agentId` binding in the workflow template, and resolve the bound agent at workflow start and step execution time.

### Why this approach
Compared with keeping executor config on steps, this gives one clear configuration source and makes agents reusable across workflow steps and templates. Compared with introducing a separate indirection key or config snapshot layer now, it keeps the first version small and aligned with the current repository design.

## Alternatives Considered

### Option A — Step stores `agentId` directly (recommended)
Each step stores `agentId`, and the backend loads the corresponding agent to obtain executor type, command override, args, env, and skills.

**Pros**
- simplest mental model
- smallest change from the current codebase
- easy backend validation and frontend editing
- matches the desired design directly

**Cons**
- templates can contain stale agent references if agents are deleted
- run behavior depends on the current agent definition unless snapshots are added later

### Option B — Step stores a stable agent key
Each step stores a unique logical key such as `agentKey`, and runtime resolves it to an agent record.

**Pros**
- better portability across environments
- avoids hard dependency on numeric ids in templates

**Cons**
- requires adding and enforcing a new unique key on agents
- larger migration surface than needed for this change
- not justified by the current JSON-storage design

### Option C — Bind by `agentId` and snapshot config into workflow runs
Each step stores `agentId`, but workflow start also copies resolved agent runtime config into the workflow run record.

**Pros**
- protects in-flight runs from later agent edits
- stronger auditability for what a run actually used

**Cons**
- extra data model and persistence complexity
- unnecessary for the first delivery

## Data Model Design

### Workflow template step
Current step configuration includes:
- `id`
- `name`
- `instructionPrompt`
- `executor`

New step configuration becomes:
- `id`
- `name`
- `instructionPrompt`
- `agentId: number | null`

`agentId` is nullable in storage so newly created templates can exist before configuration is completed, but workflow startup must reject any template with null or invalid step bindings.

### Agent
Agents become executable runtime configuration entities.

Current agent fields are:
- `name`
- `type`
- `role`
- `description`
- `enabled`
- `skills`

New persisted agent fields should be:
- `name`
- `role`
- `description`
- `enabled`
- `skills: string[]`
- `executorType: 'CLAUDE_CODE' | 'CODEX' | 'OPENCODE'`
- `commandOverride: string | null`
- `args: string[]`
- `env: Record<string, string>`

This is a one-shot development-stage schema change:
- backend storage and DTOs move directly from `type` to `executorType`
- frontend screens that currently read `agent.type` must be updated to read `agent.executorType`
- no migration, compatibility alias, or legacy preservation layer is required

This keeps the model explicit and avoids ambiguity with the removed step executor config.

## Backend Design

### 1. Agent DTOs and repository
Update the backend agent DTOs, route contracts, shared entity typing, and repository entity so the persisted agent record includes executor runtime configuration.

Files affected:
- `backend/src/types/dto/agents.ts`
- `backend/src/repositories/agentRepository.ts`
- `backend/src/routes/agents.ts`
- any shared backend entity typing that models agent persistence/response payloads

Validation ownership:
- invalid agent runtime config must be rejected during agent create/update, not only at workflow start
- agent CRUD remains the first line of defense
- workflow startup validation remains a second line of defense for cross-step workflow correctness and stale references

Validation requirements on create/update:
- `executorType` must be one of the supported executor types
- `commandOverride` must be null/undefined or a non-empty string
- `args` must be a string array
- `env` must be a string-to-string map
- `skills` must remain a string array

Error behavior on create/update:
- invalid payloads should return a 4xx validation error with a specific field-level message when possible
- the repository should not silently persist malformed executor config

### 2. Workflow template service
Refactor template normalization and validation so workflow steps no longer use `executor`.

Files affected:
- `backend/src/services/workflow/workflowTemplateService.ts`
- `backend/src/types/dto/workflowTemplates.ts`
- `backend/src/routes/workflowTemplate.ts`
- any shared backend entity typing that models workflow template persistence/response payloads
- `data-sample/workflow_template.json`

Changes:
- default template steps use `agentId: null`
- step normalization removes executor defaults
- template request/response payloads change from `executor` to `agentId`
- template validation checks only structural step rules:
  - fixed step ids remain unchanged
  - `instructionPrompt` is required
  - `agentId` is either `number` or `null`

This service should not attempt strong agent existence or enabled-state validation because that is a workflow start-time business rule, not a template shape rule.

### 3. Workflow start preflight validation
Workflow start must validate all step-agent bindings before creating a running workflow.

Primary file:
- `backend/src/services/workflow/workflowService.ts`

Recommended startup sequence:
1. load task
2. resolve execution path
3. load workflow template
4. collect all `agentId` values from steps
5. load referenced agents
6. validate every step binding
7. reject startup on any validation failure
8. create workflow run only after validation passes

Validation rules per step:
- `agentId` must not be null
- referenced agent must exist
- referenced agent must be enabled
- referenced agent must have a valid executor runtime config

Preflight guarantee boundary for this version:
- startup validation guarantees the workflow is valid at the moment the run is created
- it does not freeze template step bindings or agent config for later steps
- if the template or an agent is edited, disabled, or deleted after startup, a later step may resolve different runtime config or fail at execution time
- this behavior is accepted for the first version and is not treated as a spec violation

Example failure messages:
- `Step "测试" has no agent assigned`
- `Agent #3 for step "代码审查" not found`
- `Agent "Claude Reviewer" for step "代码审查" is disabled`
- `Agent "Claude Dev" has invalid executor configuration`

### 4. Step execution flow
Step execution must resolve agent configuration first, then choose an executor and execute using agent-owned settings.

Primary file:
- `backend/src/services/workflow/workflowStepExecutor.ts`

Current behavior:
- load template step
- read `step.executor`
- select executor from `step.executor.type`
- execute with `step.executor`

New behavior:
- load template step
- load agent by `step.agentId`
- convert the agent record into executor config
- select executor from `agent.executorType`
- execute with agent-derived config

Recommended internal helper responsibilities:
- `resolveStepAgent(step)` resolves and validates the agent for the step
- `buildExecutorConfigFromAgent(agent)` converts an agent record into the executor config shape expected by executors

This keeps step execution logic readable and avoids spreading raw agent persistence details through workflow code.

### 5. Executor registry
Keep the executor registry design unchanged.

Primary file:
- `backend/src/services/workflow/agentExecutorRegistry.ts`

The registry should continue to map executor type to executor implementation. The only change is that the executor type now comes from the bound agent instead of the workflow step template.

### 6. Skills handling
Workflow code should treat `skills` as agent-owned executor input, not as a workflow-level concept.

That means:
- workflow decides which agent a step uses
- executor decides how agent skills affect command line args, env, or prompt construction

This keeps executor-specific behavior inside executor implementations and avoids coupling workflow orchestration to CLI-specific skill semantics.

## Frontend Design

### 1. Agent management UI
Extend agent editing so agents own all runtime execution settings.

Files likely affected:
- `frontend/src/api/agent.js`
- `frontend/src/stores/agentStore.js`
- `frontend/src/views/AgentConfig.vue`
- `frontend/src/components/AgentSelector.vue`
- any other frontend component that currently reads or displays `agent.type`

Repo-wide frontend rename requirement:
- all current frontend consumers of `agent.type` must move to `agent.executorType` in the same change set
- this includes list/detail display, icons, labels, grouping, and selection dialogs, not just the agent edit form

New editable fields:
- `executorType`
- `commandOverride`
- `args`
- `env`
- `skills`

Recommended controls:
- `executorType`: select input
- `commandOverride`: optional text input
- `args`: list editor
- `env`: key-value editor
- `skills`: tag/list editor

### 2. Workflow template UI
Replace step executor editing with step agent binding.

Files likely affected:
- workflow template API client and editing view/components

Each step should expose:
- step name
- `instructionPrompt`
- agent selector

Recommended selector behavior:
- show all existing agents so disabled bindings remain visible
- clearly indicate disabled agents
- if `agentId` points to a missing agent, render an explicit missing state such as `Missing agent (#12)` rather than leaving the field blank
- allow the user to rebind to an enabled agent
- leave final start blocking to backend validation

Deletion behavior:
- agent deletion is allowed even if a template still references that agent
- templates with deleted bindings remain editable but show the explicit missing-agent state
- workflow startup remains blocked until the missing binding is repaired

New step payload shape returned to and sent from the frontend:
- `id`
- `name`
- `instructionPrompt`
- `agentId`

## Testing Strategy

### Backend tests
Add or update focused tests for:
- template default generation with `agentId: null`
- template validation for valid and invalid `agentId`
- workflow startup success when every step has a valid enabled agent
- workflow startup failure when a step has no agent
- workflow startup failure when an agent is missing
- workflow startup failure when an agent is disabled
- workflow startup failure when an agent config is invalid
- step execution resolving agent config and selecting the expected executor

### Frontend tests
Add focused tests for:
- agent form submission with new runtime fields
- workflow step agent selection payload shape
- rendering of disabled or missing agent bindings in template editing

## Risks and Follow-up

### Accepted risks for this version
- startup validation guarantees correctness only at run creation time; later template or agent edits can still affect later steps in the same run
- running workflows read the current agent definition rather than a run snapshot
- templates can temporarily contain null or stale `agentId` values
- executor-specific `skills` behavior remains intentionally uneven across executors until each executor implementation defines support

### Natural follow-up enhancements
- store agent config snapshots on workflow runs for stronger auditability and stable in-flight behavior
- introduce stable `agentKey` if template portability becomes important
- add richer per-executor validation and UI hints

## Implementation Summary
The implementation should move workflow step runtime ownership from `step.executor` to `step.agentId -> agent`. Agents become the single source of executor type and launch settings, workflow startup performs strict preflight validation, and step execution resolves launch arguments from the bound agent before selecting and invoking the executor.
