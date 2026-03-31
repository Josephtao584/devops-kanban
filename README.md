# DevOps Kanban

<p align="center">
  <strong>让 AI Agent 在真实工程流程中稳定工作的任务编排平台</strong>
</p>

<p align="center">
  AI coding agent 正在改变软件工程——但 demo 和生产之间有一道鸿沟。<br>
  DevOps Kanban 是为跨越这道鸿沟而构建的 Harness：一个让 AI Agent<br>
  在隔离、可观测、可恢复、可审查的框架下稳定运行的开源工作台。
</p>

---

## Harness Engineering

大多数 AI coding demo 关注的是"模型能不能写代码"。但在真实工程场景中，问题完全不同：

- 一个 Agent 写完的代码，你怎么知道能不能合？
- 三个 Agent 同时跑，工作区冲突怎么办？
- 跑到一半挂了，上下文怎么接上？
- 你什么时候该介入，怎么介入？

这些问题不是模型能力问题，是**工程框架问题**。Harness Engineering 就是回答这些问题的实践——为 AI Coding Agent 构建一个安全、可控的执行框架（harness），让 Agent 在约束下工作，而不是在野环境里横冲直撞。

DevOps Kanban 把 Harness Engineering 落地为五个核心原则：

| 原则 | 含义 | 项目实现 |
| --- | --- | --- |
| **隔离性 Isolation** | 每个 Agent 任务在独立环境中运行，互不污染 | Git Worktree —— 每个任务创建独立工作目录和分支 |
| **可观测性 Observability** | Agent 在做什么，实时可见，不是黑盒 | Session/Event + WebSocket 实时流——每个动作、工具调用、思考过程即时推送 |
| **可恢复性 Recovery** | 失败后能从断点继续，不用从头来 | Session Segment + Retry Chain——重试创建新 Segment，保留完整上下文链 |
| **可控性 Control** | 人在关键节点可以介入、确认、干预 | Workflow Suspend/Resume——步骤可暂停等待人工确认后继续，且不重复执行 |
| **可追溯性 Traceability** | 每次执行有完整记录，可审计可回溯 | Template Snapshot + Event Audit Trail——运行时快照模板，事件按序号持久化 |

> 这五个原则不是理论——每一个都通过 **Workflow 系统** 落地为代码。Workflow 是 Harness 的执行骨架：它把"启动一个 Agent"从一个单一动作变成一个**结构化的工程流程**。往下看，你会看到 Workflow 是怎么把五个原则编织在一起的。

## 它解决什么问题

| 真实痛点 | 我们的回答 |
| --- | --- |
| 任务散落在各处，没有统一入口 | 结构化的项目 → 需求 → 任务层级，支持从 GitHub Issues 等外部源导入 |
| 多个 AI 任务同时跑会冲突 | 每个任务分配独立 Git Worktree 和分支，并行执行互不干扰 |
| Agent 执行过程是黑盒，不知道它在干嘛 | WebSocket 实时推送思考、工具调用、代码变更等所有事件 |
| 执行中断后只能重头再来 | Session/Segment 分层记录，支持从断点恢复和增量重试 |
| 不知道什么时候该让人介入 | Workflow 模板可配置确认节点，Agent 执行完后暂停等待人工审查 |
| Agent 改了什么代码，看不清楚 | Worktree Diff 面板，逐行查看变更，再决定是否合并 |

## 一句话理解

> 一个把任务管理、Agent 编排、隔离执行和人工审查连接起来的开源 AI 交付工作台。

## 快速开始

### 环境要求

- Node.js 22.x（`>=22 <23`）
- Git

### 一键启动

```bash
./start.sh
```

启动后访问：
- 前端：http://localhost:3000
- 后端：http://localhost:8000

`./start.sh` 会自动处理依赖安装和端口占用，适合首次运行。

### 手动启动

**后端（Node.js Fastify）：**

```bash
cd backend
npm install
npm run dev          # 开发服务器（端口 8000）
npm run build        # TypeScript 编译
npm test             # 运行测试
```

**前端（Vue 3）：**

```bash
cd frontend
npm install
npm run dev          # 开发服务器（端口 3000）
npm run build        # 生产构建
npm run test:run     # 运行测试（单次）
```

## 典型使用流程

DevOps Kanban 的核心不是一个"自动生成代码"的工具，而是一个 **Harness Loop**——以 Workflow 为驱动的人机协作工程循环：

```text
┌───────────────────────────────────────────────────────────────────┐
│                        Harness Loop                                │
│                                                                    │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐              │
│  │ 任务建模  │──→│ 选择 Workflow │──→│ 模板 → 流程   │              │
│  └──────────┘   └──────────────┘   └──────┬───────┘              │
│                                            │                      │
│                              ┌─────────────┴─────────────┐        │
│                              │     Workflow Engine        │        │
│                              │                            │        │
│                              │  Step 1 ──→ Step 2 ──→ ... │        │
│                              │    │           │           │        │
│                              │  Worktree   Suspend?       │        │
│                              │  隔离执行    人工确认?      │        │
│                              └─────────────┬─────────────┘        │
│                                            │                      │
│       ┌─────────────┐    ┌────────────┐    │                      │
│       │ 继续执行     │←───│ 人工反馈    │←───┘                      │
│       └──────┬──────┘    └────────────┘                           │
│              │                                                     │
│       ┌──────┴──────┐                                              │
│       │ 审查合并     │                                              │
│       └─────────────┘                                              │
└───────────────────────────────────────────────────────────────────┘
```

1. **创建项目并关联仓库**：在项目列表中创建项目，填写本地仓库路径或远程仓库信息。
2. **配置 Agent**：在 Agent 管理页面配置 Claude Code 等执行器。
3. **创建需求和任务**：将要交付的工作组织成需求和任务卡片，设置优先级与状态。
4. **启动 Workflow 执行**：选择任务和 Workflow 模板，开始在隔离环境中执行。
5. **实时观察**：通过 WebSocket 查看实时输出——Agent 的思考、工具调用、代码变更即时可见。
6. **人工反馈**：在确认节点审查结果，给出反馈继续对话，或直接批准进入下一步。
7. **审查与合并**：检查 Worktree 中的代码变更，必要时继续对话修改，再决定是否合并。

## Workflow：Harness 的执行骨架

Workflow 不是"编排步骤"那么简单。在 Harness Engineering 的框架下，Workflow 是让 AI Agent 在真实工程流程中**稳定、可控、可追溯**运行的核心机制。它回答的是：**不是 Agent 能不能写代码，而是 Agent 写的代码怎么变成可交付的工程产物。**

### 从"跑一次 Agent"到"执行一个工程流程"

没有 Workflow，你只能对 Agent 说"帮我实现这个功能"——然后祈祷结果能直接用。

有了 Workflow，"实现一个功能"变成了一个结构化的工程流程：

```text
需求澄清 → 方案设计 → 测试设计 → 最小实现 → 自动验证 → 人工确认 → 交付审查
    ↑          ↑          ↑                                     ↑
    └── 思考 ──┘  └── 设计 ──┘          └──────── 人工介入 ────────┘
```

每一步都是一个独立的 Workflow Step，有自己的：
- **执行提示词**（Instruction Prompt）——告诉 Agent 这一步该做什么
- **Agent 分配**——不同步骤可以用不同的 Agent
- **确认控制**——需要人工审查的步骤会自动暂停
- **上下文传递**——上游步骤的摘要自动传递给下游

### 内置的工程方法论

Workflow 模板不只是步骤列表——它们编码了经过验证的工程方法论：

| 模板 | 步骤数 | 工程方法 |
| --- | --- | --- |
| **Default Workflow** | 4 | 设计 → 实现 → 验证 → 审查——最小可行的工程闭环 |
| **SDD+TDD 标准开发** | 7 | 软件设计文档 → 测试驱动开发——先设计后编码，先测试后实现 |
| **前端交付** | 7 | 场景定义 → UI 设计 → 页面实现 → 视觉验证——面向 UI 交付的完整流程 |
| **Bug 修复** | 7 | 根因分析 → 修复 → 回归测试——定位问题、修复、防止复发 |

这些模板不是固定的——你可以通过界面或 API 创建自定义模板，定义自己的工程流程。

### Suspend/Resume：人在回路中的优雅控制

Workflow 最关键的设计是 **Suspend/Resume** 机制。它不是简单的"暂停/继续"：

- Agent 执行完一个步骤后，如果配置了确认节点，Workflow **自动挂起**
- 挂起时，Agent 的执行摘要和产出物被保存——你看到的是完整的执行结果
- 你审查后给出反馈或直接批准，Workflow **从挂起点恢复**——且**不会重复执行已完成的 Agent 调用**
- 关键点：Agent 的执行结果被**不可变地保存**了，恢复时直接跳过已完成的步骤

```text
Step 1: 方案设计 ──→ 完成 ✓
Step 2: 编码实现 ──→ 完成 ✓
Step 3: 代码审查 ──→ 📋 暂停，等待人工确认
                        │
                    人工审查 + 反馈
                        │
                        ↓
Step 3: 恢复 ──→ 用反馈继续 ──→ 完成 ✓
Step 4: 测试验证 ──→ 开始执行
```

### Workflow 如何实现五个 Harness 原则

| 原则 | Workflow 实现 |
| --- | --- |
| **隔离性** | 每个 Workflow Run 在独立的 Git Worktree 中执行，多任务并行互不干扰 |
| **可观测性** | 每个 Step 创建独立的 Session，所有事件通过 WebSocket 实时推送 |
| **可恢复性** | Step 级别的重试——失败的步骤可以单独重试，不需要从头开始整个 Workflow |
| **可控性** | Suspend/Resume 机制——在任何步骤暂停等待人工确认，恢复时跳过已完成步骤 |
| **可追溯性** | 模板快照（Template Snapshot）——运行时冻结模板定义，模板修改不影响运行中的流程 |

## 架构深度解析

DevOps Kanban 的架构不是随意拼凑的——每一个模块都对应 Harness Engineering 的一个原则。

### 整体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Vue 3)                        │
│  Kanban Board │ Workflow Timeline │ Session Panel │ Diff View │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API + WebSocket
┌───────────────────────────┴──────────────────────────────────┐
│                      Backend (Fastify 4.x)                    │
│                                                               │
│  Routes ──→ Services ──→ Repositories ──→ JSON Files          │
│                            │                                  │
│         ┌──────────────────┴──────────────────┐              │
│         │        Workflow Engine (Mastra)       │              │
│         │  ┌──────────────────────────────┐    │              │
│         │  │ WorkflowService (运行管理)      │    │              │
│         │  │ WorkflowLifecycle (步骤钩子)    │    │              │
│         │  │ WorkflowTemplate (模板工厂)     │    │              │
│         │  └──────────────┬───────────────┘    │              │
│         │          Step Execution               │              │
│         │  ┌──────────────┴───────────────┐    │              │
│         │  │ Executors (Claude Code / Codex / OpenCode) │      │
│         │  └──────────────┬───────────────┘    │              │
│         └──────────────────┼──────────────────┘              │
│                     Git Worktree (per-task isolation)          │
└──────────────────────────────────────────────────────────────┘
```

### 关键设计决策

#### 为什么用 Git Worktree 而不是 Docker？

Docker 提供了更彻底的隔离，但也带来了镜像构建、环境同步、调试困难等额外复杂度。对于 AI Coding Agent 来说，Git Worktree 是更合适的选择：

- Agent 需要操作的是**代码仓库**，不是运行时环境——Worktree 天然提供代码级隔离
- 每个任务创建独立分支（`task/{project}/{taskId}`），失败不影响主分支
- 多个 Agent 可以安全并行——各自在独立的 Worktree 和分支上工作
- 合并、冲突处理直接用 Git 原生能力，不需要额外工具

#### 为什么用 Mastra 作为 Workflow 引擎？

Workflow 的核心需求不是"编排步骤"，而是**状态持久化和恢复**（详见 [Workflow：Harness 的执行骨架](#workflowharness-的执行骨架)）。Mastra 提供了关键的 Suspend/Resume 能力：

- 执行到需要人工确认的步骤时，Workflow 挂起（suspend），状态持久化到 LibSQL
- 用户审查后恢复（resume），从挂起点继续——且不会重复执行已完成的 Agent 调用
- 内置的状态机（PENDING → RUNNING → COMPLETED/FAILED/CANCELLED/SUSPENDED）省去了自己维护的复杂度
- 模板在运行时动态构建为 Mastra Workflow，每个步骤有独立的 Schema 校验

#### 为什么用 Session / Segment / Event 三层模型？

这是可恢复性和可追溯性的基础：

- **Session**：一次完整的 Agent 交互会话，关联到具体的 Workflow Step
- **Segment**：会话中的每一次交互段（START / CONTINUE / RESUME / RETRY），通过 `parent_segment_id` 形成链式结构
- **Event**：原子事件（message / tool_call / tool_result / status / error），按序号递增存储

这三层设计让系统可以：
1. 从任意断点恢复——找到最后一个成功的 Segment，以 RETRY 触发类型创建新 Segment
2. 完整回放执行过程——按 Session → Segment → Event 层级加载，精确重现每一步
3. 追踪重试历史——Segment 链记录了完整的重试路径

#### 为什么用全局写队列而不是数据库？

`BaseRepository` 使用静态 Promise 链序列化所有 JSON 文件写入操作：

```text
Write A ──→ Write B ──→ Write C ──→ ...
（所有 Repository 共享同一个写队列）
```

这个选择的原因是：单团队场景下，JSON 文件的部署成本为零（不需要数据库服务），而全局写队列解决了并发写入导致的文件损坏问题。这是一种务实的选择——用最简单的方式获得并发安全。如果未来需要多实例部署，可以替换 Repository 实现为数据库版本，上层代码无需改动。

#### 为什么 WorkflowRun 要快照模板？

WorkflowRun 存储了完整的 `template_snapshot` 而不是 `template_id` 引用。原因是模板会被修改，但运行中的流程不应该受影响。快照确保了：

- 模板变更不会破坏正在执行的 Workflow
- 历史运行记录可以准确回溯当时的步骤定义
- 这是一个"不可变性"的设计决策——运行时数据和定义数据解耦

### 技术栈

| 层级 | 技术选型 |
| --- | --- |
| 后端框架 | Fastify 4.x + TypeScript |
| 参数校验 | Zod |
| Workflow 引擎 | Mastra（状态持久化至 LibSQL） |
| 实时通信 | @fastify/websocket |
| 前端框架 | Vue 3 + Vite 5 |
| UI 组件 | Element Plus |
| 状态管理 | Pinia |
| 数据存储 | JSON 文件 + LibSQL |
| Agent 执行器 | Claude Code / Codex / OpenCode |
| 国际化 | Vue I18n（zh-CN / en） |

### 后端模块结构

```text
backend/src/
├── main.ts                    # 应用入口
├── routes/                    # 资源级路由处理
├── services/
│   ├── projectService.ts      # 项目管理
│   ├── taskService.ts         # 任务管理
│   ├── sessionService.ts      # 会话与事件管理
│   ├── workflow/
│   │   ├── workflows.ts       # 动态 Workflow 工厂
│   │   ├── workflowService.ts # Workflow 运行与取消管理
│   │   ├── workflowLifecycle.ts # 步骤生命周期钩子
│   │   ├── workflowTemplateService.ts # 模板管理
│   │   └── executors/         # Claude Code / Codex / OpenCode 执行器
│   └── ...
├── repositories/              # 数据访问层（BaseRepository + JSON 文件）
├── types/                     # 类型定义
└── utils/
    ├── response.ts            # 统一响应格式
    └── git.ts                 # Git Worktree 管理
```

### 前端模块结构

```text
frontend/src/
├── views/
│   ├── ProjectListView.vue    # 项目列表
│   ├── KanbanView.vue         # 看板主视图
│   ├── AgentConfig.vue        # Agent 配置
│   └── WorkflowTemplateConfig.vue  # Workflow 模板配置
├── components/
│   └── workflow/
│       ├── WorkflowTimeline.vue    # Workflow 时间线
│       └── StepSessionPanel.vue    # 步骤会话面板
├── stores/                    # Pinia 状态管理
├── api/                       # Axios API 客户端
├── services/
│   └── websocket.js           # WebSocket 客户端
└── locales/                   # 中英文国际化资源
```

### 数据存储

项目使用 JSON 文件存储业务数据（`data/` 目录），Workflow 状态存储在 `data/mastra.db`（LibSQL）。

```
data/
├── projects.json          # 项目
├── requirements.json      # 需求
├── tasks.json             # 任务
├── agents.json            # Agent 配置
├── sessions.json          # 会话
├── executions.json        # 执行记录
├── task_sources.json      # 外部任务源
└── mastra.db              # Workflow 状态（LibSQL）
```

## 可扩展设计

Harness Engineering 的框架应该是开放的——任何人都可以扩展：

- **执行器（Executor）**：实现新的 Agent 类型（如 GPT Code Interpreter），只需实现 Executor 接口
- **Workflow 模板**：通过模板定义新的多步骤执行流，配置确认节点和步骤编排
- **任务源（Task Sources）**：通过适配器接入外部任务系统（已支持 GitHub Issues）
- **技能系统（Skills）**：为 Agent 配置可复用的技能，执行前同步到 Worktree

### 添加新的 Agent

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

### API 参考

所有接口均位于 `/api/` 下，统一返回格式 `{ success, message, data, error }`。

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

### 任务状态流转

```text
TODO ──→ IN_PROGRESS ──→ DONE
              │
              ├──→ BLOCKED
              ├──→ CANCELLED
              └──→ REQUIREMENTS

优先级：LOW → MEDIUM → HIGH → CRITICAL
```

## 常见注意事项

1. **API 响应格式**：后端统一返回 `{ success, message, data, error }`，前端使用前先判断 `response.success`。
2. **数据目录**：后端默认通过 `STORAGE_PATH=../data` 读取项目根目录下的数据文件。建议从 `backend/` 目录启动，或使用 `./start.sh`。
3. **端口约定**：前端默认 `3000`，后端默认 `8000`。`./start.sh` 会自动处理端口冲突。
4. **Git Worktree 路径**：Worktree 存储在仓库的 `.worktrees/` 目录下（已自动添加到 `.gitignore`）。

## 贡献与许可

欢迎提交 Issue、改进建议和代码贡献。

### License

MIT License

### 致谢

- 灵感来源：[vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- AI 代理：[Claude Code](https://claude.ai/code)
- Workflow 引擎：[Mastra](https://mastra.ai)
