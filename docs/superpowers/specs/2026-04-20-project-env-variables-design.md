# 项目环境变量 + 工作流 Prompt 渲染

## Context

不同项目需要跑不同的流水线（pipeline ID 不同），这类信息是项目级别的固定配置，不应每次执行时手动输入。需要支持项目级别的自定义环境变量，并在工作流 prompt 中通过占位符引用，启动前可预览渲染效果。

## 需求

1. 项目支持自定义 key-value 环境变量（如 `PIPELINE_ID=123`）
2. 工作流 step 的 `instructionPrompt` 中用 `{{KEY}}` 占位符引用
3. 启动前可预览渲染后的 prompt
4. 变量来源仅项目 env，找不到保留原文 `{{KEY}}`

## 方案

复用 agents 表已有的 `env TEXT` 模式，在 projects 表新增 `env` 字段。

### 数据层

**数据库**：`projects` 表新增 `env TEXT NOT NULL DEFAULT '{}'`（与 agents 表一致）

**实体**（`backend/src/types/entities.ts`）：
- `ProjectEntity` 新增 `env: Record<string, string>`

**DTO**（`backend/src/types/dto/projects.ts`）：
- `CreateProjectInput` / `UpdateProjectInput` 新增 `env?: Record<string, string>`

### Prompt 渲染

**文件**：`backend/src/services/workflow/workflowPromptAssembler.ts`

新增函数：
```typescript
function renderPromptPlaceholders(prompt: string, projectEnv: Record<string, string>): string
```

- 替换规则：`{{KEY}}` → value，找不到 key 则保留原文
- 只替换 `step.instructionPrompt`，在传入 `assembleWorkflowPrompt` 之前调用
- `assembleWorkflowPrompt` 新增可选参数 `projectEnv`，在内部对 `step.instructionPrompt` 调用渲染

**数据流**：
```
workflowStepExecutor 拿到 task.project_id
  → 查 project.env
  → 传入 assembleWorkflowPrompt({ ..., projectEnv })
  → 内部对 step.instructionPrompt 调用 renderPromptPlaceholders
```

**文件**：`backend/src/services/workflow/workflowStepExecutor.ts`
- 新增 `projectRepo` 参数或通过 workflowRun 查到 task → project → env
- 将 projectEnv 传入 `assembleWorkflowPrompt`

### 预览 API

**文件**：`backend/src/routes/workflowTemplate.ts`

现有 `POST /workflow-template/preview-prompt` 新增可选参数 `projectEnv?: Record<string, string>`，传入渲染流程。

### 前端 UI

**ProjectFormDialog**（`frontend/src/components/project/ProjectFormDialog.vue`）：
- 新增环境变量编辑区（key-value 表格，支持增删行）
- 参考 Agent 配置中已有的 env 编辑模式

**WorkflowStartEditorDialog**（`frontend/src/components/workflow/WorkflowStartEditorDialog.vue`）：
- 预览 prompt 时从当前项目 store 取 env 传入预览 API

## 关键文件

- `backend/src/db/schema.sql`
- `backend/src/types/entities.ts`
- `backend/src/types/dto/projects.ts`
- `backend/src/services/workflow/workflowPromptAssembler.ts`
- `backend/src/services/workflow/workflowStepExecutor.ts`
- `backend/src/routes/workflowTemplate.ts`
- `frontend/src/components/project/ProjectFormDialog.vue`
- `frontend/src/components/workflow/WorkflowStartEditorDialog.vue`

## 验证

1. 启动后端，创建/编辑项目设置 `env: { "PIPELINE_ID": "123" }`
2. 创建工作流模板，step prompt 写 `请执行流水线 {{PIPELINE_ID}}`
3. 启动编辑器中预览 prompt，确认 `{{PIPELINE_ID}}` 渲染为 `123`
4. 实际执行工作流，确认 executor 收到的 prompt 中占位符已替换
