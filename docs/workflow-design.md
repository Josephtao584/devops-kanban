# Workflow 功能实现设计文档

## 1. 概述

### 目标
在现有 DevOps Kanban 系统中实现 Workflow（工作流）能力，用于编排一系列 Agent 任务。每个 Task 是一个 Workflow 的运行实例，Workflow 中的每个 Step 拉起一个 Claude Code CLI 子进程完成具体工作，Step 之间传递上下文（输出件 + 共享工作目录）。

### 第一版固定工作流
```
需求设计（输出设计文档）→ 代码开发 → 测试 → 代码 Review
```

## 2. 框架选型：Mastra

### 为什么选 Mastra

| 考量 | Mastra | 自研 | Temporal |
|------|--------|------|----------|
| 与现有栈兼容 | Fastify 适配器 + Zod schema，天然契合 | 无额外依赖 | 需要独立 Temporal Server |
| Step 上下文传递 | 内置 inputSchema/outputSchema 自动传递 + stateSchema 跨步骤共享 | 需要自己实现 | 内置 |
| 重试机制 | Step 级别 `retries` 配置，开箱即用 | 需要自己实现 | 内置 |
| 未来扩展性 | 支持 parallel / branch / foreach / human-in-the-loop（暂停等待人工介入） | 需要逐个实现 | 全部支持 |
| 运维成本 | 零，纯库嵌入 | 零 | 高，需要部署 Temporal Server |
| 学习成本 | 中等，API 简洁 | 低 | 高 |

**结论**：Mastra 在保持低运维成本的同时，提供了足够的工作流编排能力，且与现有技术栈（Fastify + Zod）天然兼容。未来用户自定义编排时，Mastra 的声明式 API 也更容易扩展。

### 集成方式

**选择方案 A：纯编程调用**（推荐第一版）

不使用 Mastra 的 HTTP 适配器，仅在 Service 层以库的方式调用 `createWorkflow` / `createRun` / `start`。这样：
- 不暴露 Mastra 自动生成的 REST 端点，避免与现有 `/api` 路由冲突
- 完全由现有路由层控制 Workflow 的触发和查询
- 后续如果需要 Mastra 的内置 API，可以通过 `@mastra/fastify` 适配器挂载到 `/api/v2` 前缀下

### 状态持久化

Mastra 纯库模式支持 workflow 状态持久化，通过创建 `Mastra` 实例并配置 `LibSQLStore`（本地 SQLite 文件）实现：

```javascript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'kanban-workflow-store',
    url: 'file:../data/mastra.db',   // 与现有 JSON 数据文件放在同一目录
  }),
});
```

持久化能力：
- **Snapshot 自动保存**：每个 step 执行前后，Mastra 自动将 workflow 状态（stepResults、attempts、triggerData）写入 SQLite
- **服务重启恢复**：服务重启后可通过 `loadWorkflowSnapshot(workflowName, runId)` 加载上次状态，恢复中断的 workflow
- **Suspend/Resume**：支持暂停 workflow 等待外部事件，状态持久化到 storage，跨部署恢复

> 注意：子进程本身无法恢复（被 kill 后丢失），但 Mastra 知道中断在哪个 step，重启后可以从该 step 重新执行。

## 3. 数据模型

### 新增实体：Workflow Run

存储在 `data/workflow_runs.json`，记录每次工作流运行的状态。

```javascript
{
  id: number,              // 自增 ID
  task_id: number,         // 关联的 Task ID（一个 Task = 一次 Workflow 运行）
  workflow_id: string,     // 工作流模板 ID，第一版固定 "dev-workflow-v1"
  status: string,          // PENDING | RUNNING | COMPLETED | FAILED | CANCELLED
  current_step: string,    // 当前执行到的 step ID
  steps: [                 // 各 step 的执行记录
    {
      step_id: string,           // e.g. "requirement-design"
      status: string,            // PENDING | RUNNING | COMPLETED | FAILED | SKIPPED
      started_at: string | null,
      completed_at: string | null,
      retry_count: number,       // 当前重试次数
      output: object | null,     // step 输出（如设计文档路径、测试结果等）
      error: string | null       // 失败时的错误信息
    }
  ],
  worktree_path: string,   // 共享的 git worktree 路径
  branch: string,          // git 分支名
  context: object,         // 跨 step 共享的累积上下文
  created_at: string,
  updated_at: string
}
```

### Task 扩展

现有 Task 新增可选字段：

```javascript
{
  // ...existing fields...
  workflow_run_id: number | null  // 关联的 Workflow Run ID
}
```

## 4. 工作流定义

### Step 定义

```
Step 1: requirement-design（需求设计）
  输入: Task 的标题 + 描述 + 关联的 Requirement 内容
  动作: 拉起 Claude Code CLI，prompt 要求输出设计文档
  输出: 设计文档文件路径（写入 worktree 内，如 docs/design.md）

Step 2: code-development（代码开发）
  输入: 设计文档内容（从 Step 1 输出的文件中读取）+ Task 描述
  动作: 拉起 Claude Code CLI，prompt 要求按照设计文档进行编码
  输出: 变更的文件列表 + commit hash

Step 3: testing（测试）
  输入: Step 2 的变更文件列表 + 设计文档
  动作: 拉起 Claude Code CLI，prompt 要求编写并运行测试
  输出: 测试结果（通过/失败 + 测试报告路径）

Step 4: code-review（代码审查）
  输入: Step 2 的变更 + Step 3 的测试结果
  动作: 拉起 Claude Code CLI，prompt 要求对代码进行 review
  输出: Review 报告（写入 worktree 内，如 docs/review.md）
```

### Mastra Workflow 伪代码

```javascript
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: 需求设计
const requirementDesignStep = createStep({
  id: 'requirement-design',
  inputSchema: z.object({
    taskTitle: z.string(),
    taskDescription: z.string(),
    requirementContent: z.string(),
    worktreePath: z.string(),
  }),
  outputSchema: z.object({
    designDocPath: z.string(),
    designDocContent: z.string(),
  }),
  retries: 2,
  execute: async ({ inputData, setState }) => {
    const prompt = buildDesignPrompt(inputData);
    const result = await runClaudeCode(inputData.worktreePath, prompt);
    // 读取生成的设计文档
    const designDoc = await readFile(path.join(inputData.worktreePath, 'docs/design.md'));
    setState({ designDocContent: designDoc }); // 写入共享 state
    return { designDocPath: 'docs/design.md', designDocContent: designDoc };
  },
});

// Step 2: 代码开发
const codeDevelopmentStep = createStep({
  id: 'code-development',
  inputSchema: z.object({
    designDocPath: z.string(),
    designDocContent: z.string(),
  }),
  outputSchema: z.object({
    changedFiles: z.array(z.string()),
    commitHash: z.string(),
  }),
  retries: 2,
  execute: async ({ inputData, state }) => {
    const prompt = buildCodingPrompt(inputData, state);
    const result = await runClaudeCode(state.worktreePath, prompt);
    // 获取 git diff 和 commit hash
    const changedFiles = await getGitChangedFiles(state.worktreePath);
    const commitHash = await getLatestCommitHash(state.worktreePath);
    return { changedFiles, commitHash };
  },
});

// Step 3 & 4 类似结构...

// 组装工作流
const devWorkflow = createWorkflow({
  id: 'dev-workflow-v1',
  inputSchema: z.object({
    taskTitle: z.string(),
    taskDescription: z.string(),
    requirementContent: z.string(),
    worktreePath: z.string(),
  }),
  stateSchema: z.object({         // 跨步骤共享状态
    worktreePath: z.string(),
    designDocContent: z.string().optional(),
  }),
})
  .then(requirementDesignStep)
  .then(codeDevelopmentStep)
  .then(testingStep)
  .then(codeReviewStep)
  .commit();
```

## 5. 核心模块设计

### 新增文件清单

```
backend/
├── src/
│   ├── workflows/
│   │   ├── index.js              # Mastra 实例初始化 + workflow 注册
│   │   ├── devWorkflow.js        # 第一版固定工作流定义（4个 step）
│   │   └── steps/
│   │       ├── requirementDesign.js
│   │       ├── codeDevelopment.js
│   │       ├── testing.js
│   │       └── codeReview.js
│   ├── services/
│   │   └── WorkflowService.js    # 工作流业务逻辑（触发、查询、取消）
│   ├── repositories/
│   │   └── WorkflowRunRepository.js  # workflow_runs.json CRUD
│   └── routes/
│       └── workflows.js          # API 路由
├── data/
│   └── workflow_runs.json        # 新增数据文件
```

### WorkflowService

```javascript
class WorkflowService {
  // 触发工作流：为指定 Task 创建 workflow run 并启动执行
  async startWorkflow(taskId)

  // 查询工作流运行状态
  async getWorkflowRun(runId)
  async getWorkflowRunByTask(taskId)

  // 取消正在运行的工作流
  async cancelWorkflow(runId)

  // 内部：执行 claude code CLI 并等待完成
  async _runClaudeCode(worktreePath, prompt)

  // 内部：更新 step 状态
  async _updateStepStatus(runId, stepId, status, output)
}
```

### `_runClaudeCode` 实现要点

复用现有 `SessionService` 中的 Claude Code 子进程管理模式：

```javascript
async _runClaudeCode(worktreePath, prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['-y', '@anthropic-ai/claude-code', '--print', '--prompt', prompt], {
      cwd: worktreePath,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr, exitCode: 0 });
      else reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
    });
  });
}
```

> 注意：使用 `--print` 模式（非交互式），agent 执行完自动退出并输出结果。

### API 路由

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/workflows/run` | 为指定 Task 触发工作流 `{ task_id }` |
| GET | `/api/workflows/runs/:id` | 查询单次运行状态 |
| GET | `/api/workflows/runs?task_id=X` | 按 Task 查询运行记录 |
| POST | `/api/workflows/runs/:id/cancel` | 取消运行中的工作流 |
| GET | `/api/workflows/runs/:id/steps` | 查询各 step 详细状态 |

### 进度查询

前端通过轮询 API 获取 workflow 运行进度（不使用 WebSocket）：

```
GET /api/workflows/runs/:id          → 获取整体状态 + 当前 step
GET /api/workflows/runs/:id/steps    → 获取各 step 详细状态和输出
```

前端可按需轮询（如每 5 秒），根据 `status` 字段判断是否完成。

## 6. 执行流程

```
用户点击"运行工作流"
    │
    ▼
POST /api/workflows/run { task_id: 123 }
    │
    ▼
WorkflowService.startWorkflow(123)
    ├── 1. 获取 Task 信息 + 关联的 Requirement
    ├── 2. 创建 Git Worktree（复用 git.js）
    ├── 3. 创建 WorkflowRun 记录（status: RUNNING）
    ├── 4. 更新 Task.workflow_run_id
    ├── 5. 构建 Mastra workflow inputData
    └── 6. 异步启动 workflow（不阻塞请求）
              │
              ▼
        Mastra Workflow 执行
              │
    ┌─────────┴─────────────────────────────────┐
    │  Step 1: requirement-design               │
    │  - 构建 prompt（含 Task + Requirement）     │
    │  - spawn claude code CLI (--print)        │
    │  - 等待完成，收集输出                       │
    │  - 输出: 设计文档路径 + 内容                │
    │  - 失败: 自动重试最多 2 次                  │
    ├───────────────────────────────────────────┤
    │  Step 2: code-development                 │
    │  - 读取 Step 1 设计文档（上下文传递）        │
    │  - spawn claude code CLI                  │
    │  - 输出: 变更文件列表 + commit hash         │
    ├───────────────────────────────────────────┤
    │  Step 3: testing                          │
    │  - 读取 Step 2 变更信息 + 设计文档          │
    │  - spawn claude code CLI                  │
    │  - 输出: 测试结果                           │
    ├───────────────────────────────────────────┤
    │  Step 4: code-review                      │
    │  - 读取所有前序 step 的输出                  │
    │  - spawn claude code CLI                  │
    │  - 输出: Review 报告                       │
    └───────────────────────────────────────────┘
              │
              ▼
    WorkflowRun.status = COMPLETED
    Task.status = DONE（或保持不变，由用户决定）
```

## 7. 依赖安装

```bash
cd backend
npm install @mastra/core @mastra/libsql
```

- `@mastra/core` — 核心包，包含 `createStep`、`createWorkflow`、`Mastra` 实例等 API
- `@mastra/libsql` — LibSQL/SQLite 存储适配器，用于 workflow 状态持久化

不需要安装 `@mastra/fastify`（我们不使用 Mastra 自动生成的 HTTP 端点）。

## 8. 风险和注意事项

1. **长时间运行**：每个 step 的 Claude Code 执行可能耗时数分钟。Workflow 异步执行，前端通过轮询 API 获取进度。
2. **进程管理**：服务器重启时，正在运行的子进程会丢失。但 Mastra 通过 LibSQLStore 持久化了 workflow snapshot，重启后可从中断的 step 重新执行。
3. **worktree 共享**：所有 step 共享同一个 worktree，Step 之间的文件操作会互相影响（这是预期行为）。
4. **`--print` 模式**：Claude Code 在 `--print` 模式下非交互运行，执行完自动退出。如果任务复杂可能需要较长的 max tokens。
5. **重试幂等性**：重试时 step 在同一个 worktree 上重新执行，需要确保 prompt 设计能处理"部分完成"的状态。

## 9. 未来扩展（不在第一版范围）

- **用户自定义工作流编排**：前端提供拖拽式 workflow 编辑器，保存为 JSON 定义，后端动态构建 Mastra workflow
- **并行 step**：利用 Mastra 的 `.parallel()` 能力，支持多个独立 step 同时执行
- **条件分支**：利用 Mastra 的 `.branch()` 能力，根据 step 输出决定下一步走向
- **Human-in-the-loop**：利用 Mastra 的 suspend/resume，在关键节点暂停等待人工审批
- **Workflow 模板市场**：预置多种工作流模板（bug 修复流、紧急修复流、重构流等）
