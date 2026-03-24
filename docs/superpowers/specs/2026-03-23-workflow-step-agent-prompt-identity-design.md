# Workflow Step Agent Prompt Identity Design

## Goal
Inject the bound workflow step agent's identity into the runtime step prompt so the executor works from that agent's role and skills instead of only seeing the generic step instruction.

After this change:
- each workflow step prompt includes the bound agent's name, role, optional description, and skills
- the prompt tells the model to treat that identity as a hard execution context
- the model must continue execution even when the step and role do not fully match
- the prompt explicitly instructs the final summary to state whether the work matched the agent role and note any mismatch risks

## In Scope
- backend workflow prompt assembly changes
- backend step execution wiring so the bound agent is passed into prompt assembly
- focused backend tests for prompt content and step execution wiring

## Out of Scope
- changing Claude Code CLI flags or executor launch arguments
- making skills a hard runtime permission boundary
- storing agent snapshots on workflow runs
- changing workflow template shape or agent persistence shape
- frontend changes
- post-execution validation or structured enforcement of role-match reporting

## Recommended Approach
Use prompt-level identity injection in `backend/src/services/workflow/workflowPromptAssembler.ts`, with `workflowStepExecutor.ts` passing the resolved bound agent into the assembler.

### Why this approach
This keeps the change small and aligned with the current design. The workflow layer already resolves the bound agent before choosing an executor, and the prompt assembler is already the single place where step/task/upstream context is merged into the prompt. Injecting role/skills there gives all executors the same behavior without adding CLI-specific branching.

## Design Details

### 1. Pass bound agent into prompt assembly
`backend/src/services/workflow/workflowStepExecutor.ts` already loads the step's bound agent before building executor config.

Change the `assembleWorkflowPrompt(...)` call so it also receives the resolved agent record, including:
- `name`
- `role`
- `description`
- `skills`

No executor config behavior changes are needed for this feature.

### 2. Add a dedicated agent identity section to the prompt
Insert a new section between upstream summaries and the step instruction block.

Suggested structure:
- 当前执行代理
- 代理名称
- 代理角色
- 代理描述（when present）
- 代理技能
- 强约束说明

The strong-constraint text should tell the model that:
- it is currently executing this workflow step as the bound agent
- the role and skills are mandatory execution context, not optional background information
- analysis, implementation choices, validation approach, and wording should reflect that role
- if the step and role do not fully match, the model must still complete the step
- the final summary should explicitly state whether the step matched the role, and list any mismatch or risk

### 3. Keep mismatch handling non-blocking
When a step and role are not a clean match, do not fail the workflow and do not ask the model to stop.

Required behavior:
- continue execution
- prompt the final summary to mention whether the role matched the task
- if not, mention the main mismatch and potential risk

This preserves workflow throughput while still surfacing role-drift to the user.

### 4. Preserve existing prompt behavior
The feature should not remove or weaken existing prompt sections:
- current step name
- original task title and description
- upstream step summaries
- step-specific instruction
- final-summary-only output constraint

Instead, extend the final summary constraint so it now requests:
- what was done
- whether files were modified
- the main result
- whether the work matched the current agent role
- mismatch/risk notes when applicable

### 5. Define prompt rendering edge cases
Prompt rendering should remain stable when optional or empty agent fields appear.

Required rendering rules:
- if `description` is missing or blank, omit the `代理描述` section entirely
- if `skills` is an empty array, still render the `代理技能` section with explicit text such as `未提供`
- the agent identity section must appear after upstream summaries and before `本步骤要求`

## Files Affected
- `backend/src/services/workflow/workflowPromptAssembler.ts`
- `backend/src/services/workflow/workflowStepExecutor.ts`
- `backend/test/workflowPromptAssembler.test.ts`
- `backend/test/workflowStepExecutor.test.ts`

## Testing Strategy
1. Add prompt-assembler coverage that fails until the new agent identity section is present.
2. Add prompt-assembler coverage for section ordering, missing description, and empty skills rendering.
3. Add step-executor coverage that verifies the resolved agent is reflected in the generated prompt.
4. Add a mismatch scenario in step-executor coverage that still reaches executor invocation while asserting the mismatch-reporting instruction is present in the prompt.
5. Run the focused workflow prompt/step tests.
6. Run backend typecheck to catch prompt signature drift.

## Acceptance Criteria
- bound agent identity is present in assembled workflow prompts
- prompt text clearly treats role/skills as hard context
- prompt text explicitly instructs role-match reporting in the final summary
- workflow execution still proceeds when role and step do not fully match
- prompt rendering is defined and tested for missing description and empty skills
- focused backend tests pass
