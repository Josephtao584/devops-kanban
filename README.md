# DevOps Kanban

<p align="center">
  <strong>让 AI agent 在真实工程流程中稳定工作的任务编排平台</strong>
</p>

<p align="center">
  面向 Harness Engineering 的开源 DevOps Kanban，连接项目、需求、任务、Agent 执行、Git Worktree 隔离与人工审查。
</p>

---

## 项目简介

DevOps Kanban 是一个面向 Harness Engineering 的开源任务编排平台，用于把项目、需求、任务、AI Agent 执行、Git Worktree 隔离和人工审查连接成完整交付流程。

它适合希望把 Claude Code 等 coding agent 接入真实研发流程的团队，也适合在本地验证 agent workflow、session resume、隔离执行和 human-in-the-loop 交付模式的开发者。

### 它解决什么问题

大多数 AI coding demo 关注的是“模型能不能写代码”，而真实团队更关心：

- 任务如何进入统一执行流程
- 多个 AI 任务如何隔离运行，避免污染工作区
- 执行过程如何实时可见，而不是变成黑盒
- 失败后如何恢复上下文，而不是从头再来
- 人类如何在关键节点介入、审查并决定是否合并

### 适合谁

- 想把 Claude Code 等 coding agent 接入日常研发流程的团队
- 想验证 agent workflow / harness engineering 产品形态的开发者
- 想把需求、任务、执行、审查串成闭环的内部平台建设者

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 项目 / 需求 / 任务看板管理 | 以结构化实体组织项目、需求、任务、优先级和状态流转 |
| AI Agent 配置与执行 | 统一管理 Agent 类型、命令和执行入口 |
| Git Worktree 隔离执行 | 为任务提供独立工作目录、分支和提交上下文 |
| Session / Execution / WebSocket | 支持实时输出、执行跟踪、多轮交互和上下文恢复 |
| Workflow 模板与执行体系 | 基于模板动态构建工作流，并通过 lifecycle / executor 协调执行 |
| Human-in-the-loop | 保留人工反馈、审查和合并决策，而不是全自动黑盒 |

### 一句话理解

> 一个把任务管理、Agent 编排、隔离执行和人工审查连接起来的开源 AI 交付工作台。

## 快速开始

### 环境要求

- Node.js 22.x（后端 `package.json` 当前限制为 `>=22 <23`）

### 一键启动（推荐）

```bash
./start.sh
```

启动后访问：
- 前端：http://localhost:3000
- 后端：http://localhost:8000

`./start.sh` 会自动处理依赖安装和端口占用，适合首次运行。

### 手动启动

#### 后端（Node.js Fastify）

```bash
cd backend
npm install
npm run dev
```

常用命令：

```bash
npm run build
node dist/src/main.js
npm test
```

#### 前端（Vue 3）

```bash
cd frontend
npm install
npm run dev
```

常用命令：

```bash
npm run build
npm run test
npm run test:run
```

## 典型使用流程

1. **创建项目并关联仓库**：在项目列表中创建项目，填写本地仓库路径或远程仓库信息。
2. **配置 Agent**：在 Agent 管理页面配置 Claude Code 等执行器。
3. **创建需求和任务**：将要交付的工作组织成需求和任务卡片，设置优先级与状态。
4. **启动执行**：选择任务和 Agent，开始在隔离环境中执行。
5. **执行中交互**：通过 WebSocket 查看实时输出，并在执行过程中继续给出反馈。
6. **审查与合并**：检查 worktree 中的代码变更，必要时继续对话修改，再决定是否合并。

这个流程强调的不是“自动生成代码”，而是一个可观察、可恢复、可审查的 agent harness loop：

```text
任务建模 → 代理选择 → 隔离执行 → 实时观察 → 人工反馈 → 继续执行 → 审查合并
```

## 架构概览

### 后端：`backend/`

后端基于 Fastify 4.x、Zod 和 JSON 文件存储，采用分层结构：

```text
Routes → Services → Repositories → JSON files
```

关键组成：
- `src/main.js`：应用入口，注册路由和插件
- `src/routes/`：资源级路由处理
- `src/services/`：业务逻辑层
- `src/repositories/`：基于 JSON 文件的持久化访问层
- `src/utils/response.js`：统一响应格式 `{ success, message, data, error }`
- `src/utils/git.js`：任务级 Git worktree 管理

### Workflow 系统

Workflow 子系统基于 Mastra 构建，核心链路如下：

```text
WorkflowService → Mastra Workflow Engine → WorkflowLifecycle → Executors
```

关键模块：
- `src/services/workflow/workflows.ts`：动态 workflow 工厂
- `src/services/workflow/workflowService.ts`：工作流运行与取消管理
- `src/services/workflow/workflowLifecycle.ts`：步骤生命周期管理
- `src/services/workflow/workflowTemplateService.ts`：工作流模板管理
- `src/services/workflow/executors/`：Claude Code / Codex / OpenCode 执行器
- `src/repositories/workflowRunRepository.ts`：通过序列化 mutation 避免并发更新竞争

### 前端：`frontend/`

前端基于 Vue 3、Vite 5、Element Plus 和 Pinia。

主要目录：
- `src/views/`：页面视图
- `src/components/`：通用组件
- `src/api/`：Axios API 客户端
- `src/stores/`：Pinia 状态管理
- `src/services/websocket.js`：WebSocket 客户端
- `src/locales/`：中英文国际化资源

### 数据存储：`data/`

项目使用 JSON 文件存储业务数据，包括：

- `projects.json`
- `requirements.json`
- `tasks.json`
- `agents.json`
- `sessions.json`
- `executions.json`
- `task_sources.json`

另外，Mastra workflow 状态存储在 `data/mastra.db`。

### 主要 API

所有接口均位于 `/api/` 下：

| 资源 | 关键接口 |
| --- | --- |
| Projects | `GET/POST/PUT/DELETE /api/projects` |
| Requirements | `GET/POST/PUT/DELETE /api/requirements` |
| Tasks | `GET/POST/PUT/DELETE /api/tasks`、`PATCH /api/tasks/{id}/status` |
| Sessions | `GET/POST/DELETE /api/sessions` |
| Task Sources | `GET/POST/PUT/DELETE /api/task-sources` |
| Executions | `GET/POST/PUT/DELETE /api/executions` |
| Agents | `GET/POST/PUT/DELETE /api/agents` |
| Health | `GET /health`、`GET /` |

## 开发说明

### 常用命令

**后端：**

```bash
cd backend
npm install
npm run dev
npm run build
npm test
```

**前端：**

```bash
cd frontend
npm install
npm run dev
npm run build
npm run test
npm run test:run
```

### 常见注意事项

1. **API 响应格式**：后端统一返回 `{ success, message, data, error }`，前端使用前先判断 `response.success`。
2. **数据目录**：后端默认通过 `STORAGE_PATH=../data` 读取项目根目录下的数据文件。
3. **端口约定**：前端默认 `3000`，后端默认 `8000`。
4. **启动方式**：如果只是本地试跑，优先使用 `./start.sh`。

### 可扩展点

- **任务源（Task Sources）**：通过适配器扩展外部任务系统接入。
- **执行器 / Agent**：可扩展不同 Agent 类型和命令入口。
- **Workflow 模板**：可通过模板定义新的多步骤执行流。

### 状态流转

任务状态主流程：

```text
TODO → IN_PROGRESS → DONE
```

也支持：`REQUIREMENTS`、`BLOCKED`、`CANCELLED`。

优先级包括：`LOW`、`MEDIUM`、`HIGH`、`CRITICAL`。

## 贡献与许可

欢迎提交 Issue、改进建议和代码贡献。

### 添加新的 Agent

可以通过 UI 或 API 添加新的 Agent：

```bash
curl -X POST http://localhost:8000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Claude Code",
    "type": "CLAUDE",
    "command": "claude",
    "config": {}
  }'
```

### License

MIT License

### 致谢

- 灵感来源：[vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- AI 代理：[Claude Code](https://claude.ai/code)
