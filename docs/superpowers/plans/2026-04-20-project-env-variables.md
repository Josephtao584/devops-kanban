# Project Environment Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level environment variables that are injected into workflow step prompts via `{{KEY}}` placeholder rendering, with preview support.

**Architecture:** Projects get an `env` JSON field (same pattern as agents). The prompt assembler renders `{{KEY}}` placeholders in `instructionPrompt` using project env before assembly. Project env flows through the workflow state schema to the step executor. Frontend gets an env editor in ProjectFormDialog.

**Tech Stack:** TypeScript, Node.js test runner, Vue 3 + Element Plus

---

### Task 1: Add `renderPromptPlaceholders` to workflowPromptAssembler

**Files:**
- Create: `backend/test/workflowPromptAssembler.test.ts`
- Modify: `backend/src/services/workflow/workflowPromptAssembler.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/workflowPromptAssembler.test.ts`:

```typescript
import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { assembleWorkflowPrompt, renderPromptPlaceholders } from '../src/services/workflow/workflowPromptAssembler.js';

test.test('renderPromptPlaceholders replaces {{KEY}} with value from projectEnv', () => {
  const result = renderPromptPlaceholders('请执行流水线 {{PIPELINE_ID}}', { PIPELINE_ID: '123' });
  assert.equal(result, '请执行流水线 123');
});

test.test('renderPromptPlaceholders keeps {{KEY}} when key not found', () => {
  const result = renderPromptPlaceholders('请执行流水线 {{PIPELINE_ID}}', {});
  assert.equal(result, '请执行流水线 {{PIPELINE_ID}}');
});

test.test('renderPromptPlaceholders replaces multiple placeholders', () => {
  const result = renderPromptPlaceholders('{{ENV}}-{{APP}}-{{PIPELINE_ID}}', { ENV: 'prod', APP: 'myapp', PIPELINE_ID: '456' });
  assert.equal(result, 'prod-myapp-456');
});

test.test('renderPromptPlaceholders returns original when projectEnv is empty', () => {
  const result = renderPromptPlaceholders('no placeholders here', { PIPELINE_ID: '123' });
  assert.equal(result, 'no placeholders here');
});

test.test('assembleWorkflowPrompt renders projectEnv placeholders in instructionPrompt', () => {
  const prompt = assembleWorkflowPrompt({
    step: { name: 'Deploy', instructionPrompt: '执行流水线 {{PIPELINE_ID}}' },
    state: { taskTitle: 'Fix bug', taskDescription: 'desc' },
    inputData: {},
    upstreamStepIds: [],
    projectEnv: { PIPELINE_ID: '789' },
  });
  // prompt uses \\n encoding, decode for assertion
  const decoded = prompt.replaceAll('\\n', '\n');
  assert.ok(decoded.includes('执行流水线 789'));
  assert.ok(!decoded.includes('{{PIPELINE_ID}}'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx tsx --test test/workflowPromptAssembler.test.ts`
Expected: FAIL — `renderPromptPlaceholders` is not exported

- [ ] **Step 3: Implement `renderPromptPlaceholders` and update `assembleWorkflowPrompt`**

In `backend/src/services/workflow/workflowPromptAssembler.ts`:

1. Add the new function before `assembleWorkflowPrompt`:

```typescript
function renderPromptPlaceholders(prompt: string, projectEnv: Record<string, string>): string {
  if (!projectEnv || Object.keys(projectEnv).length === 0) {
    return prompt;
  }
  return prompt.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in projectEnv ? projectEnv[key] : match;
  });
}
```

2. Add `projectEnv` to `assembleWorkflowPrompt` params and apply it to `step.instructionPrompt`:

```typescript
function assembleWorkflowPrompt({
  step,
  state,
  inputData,
  upstreamStepIds = [],
  agent,
  projectEnv,
}: {
  step: { name: string; instructionPrompt: string };
  state: { taskTitle: string; taskDescription: string };
  inputData: Record<string, unknown>;
  upstreamStepIds?: string[];
  agent?: WorkflowAgent;
  projectEnv?: Record<string, string>;
}) {
```

Inside the function body, add before the existing logic:

```typescript
  const renderedInstruction = projectEnv ? renderPromptPlaceholders(step.instructionPrompt, projectEnv) : step.instructionPrompt;
```

Then replace `step.instructionPrompt` usage with `renderedInstruction`:

```typescript
  const hasCustomSummaryInstruction = /summary\s*(必须|需要|要求|只|格式|包含)/.test(renderedInstruction);
```

And:

```typescript
    `本步骤要求：\n${renderedInstruction}`,
```

3. Update the export:

```typescript
export { assembleWorkflowPrompt, extractUpstreamSummaries, renderPromptPlaceholders };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx tsx --test test/workflowPromptAssembler.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/test/workflowPromptAssembler.test.ts backend/src/services/workflow/workflowPromptAssembler.ts
git commit -m "feat: add renderPromptPlaceholders with project env support in prompt assembler"
```

---

### Task 2: Add `env` field to Project entity and database schema

**Files:**
- Create: `backend/test/projectRepository.test.ts`
- Modify: `backend/src/db/schema.sql`
- Modify: `backend/src/types/entities.ts`
- Modify: `backend/src/types/dto/projects.ts`
- Modify: `backend/src/repositories/projectRepository.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/projectRepository.test.ts`:

```typescript
import * as test from 'node:test';
import * as assert from 'node:assert/strict';

test.test('ProjectRepository parseRow parses env JSON field', () => {
  const { ProjectRepository } = await import('../src/repositories/projectRepository.js');
  const repo = new ProjectRepository();
  const parsed = (repo as any).parseRow({
    id: 1,
    name: 'Test',
    description: null,
    git_url: null,
    local_path: null,
    env: '{"PIPELINE_ID":"123"}',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  });
  assert.deepEqual(parsed.env, { PIPELINE_ID: '123' });
});

test.test('ProjectRepository serializeRow serializes env to JSON string', () => {
  const { ProjectRepository } = await import('../src/repositories/projectRepository.js');
  const repo = new ProjectRepository();
  const serialized = (repo as any).serializeRow({
    env: { PIPELINE_ID: '456' },
  });
  assert.equal(serialized.env, '{"PIPELINE_ID":"456"}');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx tsx --test test/projectRepository.test.ts`
Expected: FAIL — `env` field not in entity

- [ ] **Step 3: Implement schema, entity, DTO, and repository changes**

**`backend/src/db/schema.sql`** — add `env` column to projects table:

```sql
-- In the projects CREATE TABLE, add after local_path:
  env TEXT NOT NULL DEFAULT '{}',
```

**`backend/src/types/entities.ts`** — add `env` to `ProjectEntity`:

```typescript
export interface ProjectEntity {
  id: number;
  name: string;
  description: string | undefined;
  git_url: string | undefined;
  local_path: string | undefined;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
}
```

**`backend/src/types/dto/projects.ts`** — add `env` to both DTOs:

```typescript
export interface CreateProjectInput {
  name: string;
  description?: string;
  git_url?: string;
  local_path?: string;
  env?: Record<string, string>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  git_url?: string | null;
  local_path?: string | null;
  env?: Record<string, string>;
}
```

**`backend/src/repositories/projectRepository.ts`** — add `parseRow` and `serializeRow` (same pattern as AgentRepository):

```typescript
import { BaseRepository } from './base.js';
import type { ProjectEntity } from '../types/entities.js';

class ProjectRepository extends BaseRepository<ProjectEntity> {
  constructor() {
    super('projects');
  }

  protected override parseRow(row: Record<string, unknown>): ProjectEntity {
    return {
      ...row,
      env: row.env ? JSON.parse(row.env as string) : {},
    } as ProjectEntity;
  }

  protected override serializeRow(entity: Partial<ProjectEntity>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...entity };
    if (entity.env !== undefined) {
      result.env = JSON.stringify(entity.env);
    }
    return result;
  }
}

export { ProjectRepository };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsx --test test/projectRepository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/schema.sql backend/src/types/entities.ts backend/src/types/dto/projects.ts backend/src/repositories/projectRepository.ts backend/test/projectRepository.test.ts
git commit -m "feat: add env field to project entity, DTO, schema, and repository"
```

---

### Task 3: Add env validation to ProjectService

**Files:**
- Modify: `backend/src/services/projectService.ts`

- [ ] **Step 1: Update `create` method to pass `env` through**

In `backend/src/services/projectService.ts`, update the `create` method to include `env`:

After the `local_path` validation block (line ~62), add:

```typescript
    if (projectData.env !== undefined) {
      if (typeof projectData.env !== 'object' || projectData.env === null) {
        throw new ValidationError('环境变量格式无效', 'Invalid env format');
      }
      for (const [key, value] of Object.entries(projectData.env)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new ValidationError('环境变量键值必须为字符串', 'Env keys and values must be strings');
        }
      }
    }
```

Update the `return` at line ~63 to include `env`:

```typescript
    return await this.projectRepo.create({
      name: projectData.name,
      description: projectData.description,
      git_url: projectData.git_url,
      local_path: projectData.local_path,
      env: projectData.env || {},
    });
```

- [ ] **Step 2: Update `update` method to pass `env` through**

In the same file, add env handling in the `update` method after the `local_path` block:

```typescript
    if (projectData.env !== undefined) {
      if (typeof projectData.env !== 'object' || projectData.env === null) {
        throw new ValidationError('环境变量格式无效', 'Invalid env format');
      }
      for (const [key, value] of Object.entries(projectData.env)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          throw new ValidationError('环境变量键值必须为字符串', 'Env keys and values must be strings');
        }
      }
      updateData.env = projectData.env;
    }
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/projectService.ts
git commit -m "feat: add env validation to project service create and update"
```

---

### Task 4: Flow project env through workflow execution

**Files:**
- Modify: `backend/src/services/workflow/workflows.ts` — add `projectEnv` to state schema and pass to `executeWorkflowStep`
- Modify: `backend/src/services/workflow/workflowStepExecutor.ts` — accept and forward `projectEnv`
- Modify: `backend/src/services/workflow/workflowService.ts` — load project env and pass into workflow

- [ ] **Step 1: Add `projectEnv` to workflow state schema in `workflows.ts`**

In `backend/src/services/workflow/workflows.ts`, update `sharedStateSchema`:

```typescript
const sharedStateSchema = z.object({
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
  projectEnv: z.record(z.string()).optional(),
});
```

Update `firstStepInputSchema`:

```typescript
const firstStepInputSchema = z.object({
  taskId: z.number(),
  taskTitle: z.string(),
  taskDescription: z.string(),
  worktreePath: z.string(),
  projectEnv: z.record(z.string()).optional(),
});
```

- [ ] **Step 2: Pass `projectEnv` to `executeWorkflowStep` in `workflows.ts`**

In the two `executeWorkflowStep` calls (~line 274 and the resume call), add `projectEnv: state.projectEnv`:

```typescript
          const result = await executeWorkflowStep({
            stepId: templateStep.id,
            worktreePath: state.worktreePath,
            state,
            inputData,
            workflowInstance,
            abortSignal,
            upstreamStepIds: previousStepId ? [previousStepId] : [],
            projectEnv: state.projectEnv,
            onEvent: async (event) => {
```

- [ ] **Step 3: Accept `projectEnv` in `executeWorkflowStep` and pass to assembler**

In `backend/src/services/workflow/workflowStepExecutor.ts`:

1. Add `projectEnv` to `ExecuteWorkflowStepInput` interface:

```typescript
interface ExecuteWorkflowStepInput {
  // ... existing fields ...
  projectEnv?: Record<string, string>;
}
```

2. Pass `projectEnv` to `assembleWorkflowPrompt`:

```typescript
  const prompt = assembleWorkflowPrompt({ step, state, inputData, upstreamStepIds, agent, projectEnv });
```

- [ ] **Step 4: Load project env in `workflowService.ts` and pass to workflow**

In `backend/src/services/workflow/workflowService.ts`, update `startWorkflow`:

After fetching the task and before `executeWorkflow`, load the project env:

```typescript
    const project = await this.projectRepo.findById(task.project_id);
    const projectEnv = project?.env || {};
```

Then in `executeWorkflow`, pass it. Update the `executeWorkflow` call:

```typescript
    this.executeWorkflow(run.id, { ...task, execution_path: executionPath, project_env: projectEnv }, instance).catch(...)
```

Update `executeWorkflow` method signature and pass `projectEnv` in `initialState` and `inputData`:

```typescript
  private async executeWorkflow(runId: number, task: WorkflowTaskRecord & { execution_path: string; project_env: Record<string, string> }, instance: WorkflowInstanceEntity) {
    // ...
      await mastraRun.startAsync({
        inputData: {
          taskId: task.id,
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
          projectEnv: task.project_env,
        },
        initialState: {
          taskTitle: task.title || 'Untitled Task',
          taskDescription: task.description || '',
          worktreePath: task.execution_path,
          projectEnv: task.project_env,
        },
      });
```

Also update `getMastraRunContext` to include `project_env`:

```typescript
    const project = await this.projectRepo.findById(task.project_id);
    const { workflow } = await this.getOrRegisterWorkflowByInstanceId(
      run.workflow_instance_id,
      runId,
      { id: task.id, project_id: task.project_id, execution_path: executionPath },
    );
```

This one doesn't need projectEnv in the task record for buildWorkflowFromInstance — the state is already persisted in Mastra's storage for a running workflow.

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/workflow/workflows.ts backend/src/services/workflow/workflowStepExecutor.ts backend/src/services/workflow/workflowService.ts
git commit -m "feat: flow project env through workflow execution to prompt assembler"
```

---

### Task 5: Update preview-prompt API to support projectEnv

**Files:**
- Modify: `backend/src/routes/workflowTemplate.ts`

- [ ] **Step 1: Add `projectEnv` to the preview-prompt endpoint body schema**

In `backend/src/routes/workflowTemplate.ts`, update the `/preview-prompt` body type (~line 147):

```typescript
  fastify.post<{
    Body: {
      step: { name: string; instructionPrompt: string; agentId?: number };
      upstreamSteps?: Array<{ stepId: string; name: string }>;
      taskTitle?: string;
      taskDescription?: string;
      projectEnv?: Record<string, string>;
    };
  }>('/preview-prompt', async (request, reply) => {
```

- [ ] **Step 2: Pass `projectEnv` to `assembleWorkflowPrompt`**

In the same handler, extract `projectEnv` from body and pass it:

```typescript
      const { step, upstreamSteps = [], taskTitle, taskDescription, projectEnv } = request.body || {};
```

Then pass to assembler:

```typescript
      const prompt = assembleWorkflowPrompt({
        step,
        state: { taskTitle: taskTitle || '{{示例需求标题}}', taskDescription: taskDescription || '{{示例需求描述内容}}' },
        inputData,
        upstreamStepIds: upstreamSteps.map((s) => s.stepId),
        ...(agent ? { agent } : {}),
        projectEnv,
      });
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/workflowTemplate.ts
git commit -m "feat: support projectEnv in workflow prompt preview API"
```

---

### Task 6: Frontend — Add env editor to ProjectFormDialog

**Files:**
- Modify: `frontend/src/components/project/ProjectFormDialog.vue`
- Modify: `frontend/src/locales/zh.js`

- [ ] **Step 1: Add envPairs to form data and env editor UI**

In `frontend/src/components/project/ProjectFormDialog.vue`:

1. Add `envPairs: []` to the `form` ref:

```javascript
const form = ref({
  name: '',
  description: '',
  gitUrl: '',
  localPath: '',
  createExplorationTask: false,
  envPairs: [],
})
```

2. Add env editor section in template, after the `local_path` form item and before the divider:

```html
      <el-divider>
        <el-icon><Setting /></el-icon>
        {{ $t('project.env') }}
      </el-divider>

      <el-form-item :label="$t('project.env')">
        <div class="env-editor">
          <div v-for="(item, index) in form.envPairs" :key="index" class="env-pair-row">
            <el-input v-model="item.key" :placeholder="$t('agent.envKey')" class="env-input" />
            <span class="env-eq">=</span>
            <el-input v-model="item.value" :placeholder="$t('agent.envValue')" class="env-input" />
            <button type="button" class="env-remove-btn" @click="removeEnvPair(index)">×</button>
          </div>
          <el-button size="small" @click="addEnvPair">+ {{ $t('common.add') }}</el-button>
        </div>
      </el-form-item>
```

3. Add `Setting` to imports:

```javascript
import { Link, FolderOpened, Setting } from '@element-plus/icons-vue'
```

4. Add helper functions:

```javascript
const addEnvPair = () => { form.value.envPairs.push({ key: '', value: '' }) }
const removeEnvPair = (index) => { form.value.envPairs.splice(index, 1) }
```

5. Update `resetForm`:

```javascript
const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    gitUrl: '',
    localPath: '',
    createExplorationTask: false,
    envPairs: [],
  }
}
```

6. Update the `watch` to populate envPairs from project data:

```javascript
watch(() => props.project, (newProject) => {
  if (newProject) {
    const envPairs = newProject.env && typeof newProject.env === 'object'
      ? Object.entries(newProject.env).map(([key, value]) => ({ key, value: String(value) }))
      : [];
    form.value = {
      name: newProject.name || '',
      description: newProject.description || '',
      gitUrl: newProject.gitUrl || newProject.git_url || newProject.repoUrl || '',
      localPath: newProject.localPath || newProject.local_path || '',
      envPairs,
    }
  } else {
    resetForm()
  }
}, { immediate: true })
```

7. Update `handleSubmit` to build env from envPairs:

```javascript
const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    const env = {}
    for (const pair of form.value.envPairs) {
      if (pair.key.trim()) {
        env[pair.key.trim()] = pair.value
      }
    }
    const submitData = {
      name: form.value.name,
      description: form.value.description,
      createExplorationTask: form.value.createExplorationTask,
      env: Object.keys(env).length > 0 ? env : undefined,
    }
    if (form.value.gitUrl) {
      submitData.git_url = form.value.gitUrl
    }
    if (form.value.localPath) {
      submitData.local_path = form.value.localPath
    }
    emit('submit', submitData)
  } catch {
    // Validation failed
  }
}
```

8. Add env editor styles (same as AgentConfig.vue):

```css
.env-pair-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.env-input {
  flex: 1;
}
.env-eq {
  color: var(--el-text-color-secondary);
  font-weight: bold;
}
.env-remove-btn {
  border: none;
  background: none;
  color: var(--el-color-danger);
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
}
.env-remove-btn:hover {
  color: var(--el-color-danger-dark-2);
}
```

- [ ] **Step 2: Add i18n key**

In `frontend/src/locales/zh.js`, add to the `project` section:

```javascript
    env: '环境变量',
```

- [ ] **Step 3: Run frontend dev server and verify**

Run: `cd frontend && npm run dev`
Expected: Project create/edit dialog shows env editor section

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/project/ProjectFormDialog.vue frontend/src/locales/zh.js
git commit -m "feat: add environment variable editor to project form dialog"
```

---

### Task 7: Frontend — Pass project env to prompt preview

**Files:**
- Modify: `frontend/src/components/workflow/WorkflowStartEditorDialog.vue`

- [ ] **Step 1: Find the preview prompt call and add projectEnv**

In `frontend/src/components/workflow/WorkflowStartEditorDialog.vue`, find the `handlePreviewPrompt` function (or equivalent that calls the preview API). Add the current project's `env` to the API request body:

```javascript
  projectEnv: currentProject.value?.env || undefined,
```

The exact code depends on how the component accesses the current project. Check if there's a prop or store reference available. If the component receives `task` data, trace back to get the project.

- [ ] **Step 2: Verify preview renders placeholders**

Run: `cd frontend && npm run dev`
1. Create a project with `env: { PIPELINE_ID: "123" }`
2. Create a task in that project
3. Start the task → select a workflow template with `{{PIPELINE_ID}}` in a step prompt
4. Click preview → confirm the rendered prompt shows `123` not `{{PIPELINE_ID}}`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workflow/WorkflowStartEditorDialog.vue
git commit -m "feat: pass project env to workflow prompt preview"
```

---

## Verification

1. `cd backend && npm test` — all backend tests pass
2. `cd frontend && npm run test:run` — all frontend tests pass
3. Start app with `./start.sh`
4. Create/edit a project, set env `PIPELINE_ID=123`
5. Create a workflow template with a step containing `执行流水线 {{PIPELINE_ID}}`
6. Create a task in that project, start it with that template
7. Preview the prompt — confirm `{{PIPELINE_ID}}` is rendered as `123`
8. Execute the workflow — confirm the executor receives the rendered prompt
