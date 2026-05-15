# 代码仓库分析报告

> 生成时间：2026-05-13
> 代理角色：架构师 (ARCHITECT)
> 需求编码：4092199034

---

## 1. 项目概览

### 1.1 项目名称
**Coplat** — 为 AI Agent 构建工程纪律的 AI-First 研发协作平台

### 1.2 项目定位
Coplat 是一个面向 AI-First 软件工程的项目管理看板系统，核心理念是将 AI Agent 从"辅助工具"转变为"主要交付执行者"。通过 Workflow 编排、Git Worktree 隔离、持久化记忆和结构化执行四大实践，实现端到端的 AI 驱动交付链。

### 1.3 目录结构

```
devops-kanban/
├── backend/                    # 后端服务 (Fastify + TypeScript)
│   ├── src/
│   │   ├── main.ts             # 应用入口
│   │   ├── app.ts              # Fastify 应用构建
│   │   ├── config/             # 配置管理
│   │   ├── db/                 # LibSQL 数据库层
│   │   ├── middleware/         # 中间件 (CORS, 错误处理)
│   │   ├── routes/             # REST API 路由 (19 个资源路由)
│   │   ├── services/           # 业务逻辑层 (20+ 服务)
│   │   │   └── workflow/       # Workflow 引擎子系统 (18 个模块)
│   │   ├── repositories/       # 数据访问层 (18 个 Repository)
│   │   ├── sources/            # 任务源适配器
│   │   ├── types/              # TypeScript 类型定义
│   │   └── utils/              # 工具函数
│   ├── test/                   # 测试套件
│   └── scripts/                # 数据库迁移/种子脚本
├── frontend/                   # 前端应用 (Vue 3 + Vite)
│   ├── src/
│   │   ├── main.js             # 应用入口
│   │   ├── App.vue             # 根组件
│   │   ├── views/              # 页面视图 (7 个)
│   │   ├── components/         # 组件库 (25+ 目录/组件)
│   │   ├── stores/             # Pinia 状态管理 (8 个 store)
│   │   ├── api/                # Axios API 客户端 (20 个模块)
│   │   ├── router/             # Vue Router 路由
│   │   ├── locales/            # 国际化 (zh-CN / en)
│   │   ├── composables/        # 组合式函数
│   │   └── services/           # WebSocket 客户端等
│   ├── e2e/                    # Playwright E2E 测试
│   └── tests/                  # Vitest 单元测试
├── data/                       # 数据存储 (JSON + LibSQL)
├── workflows/                  # Workflow 定义
├── scripts/                    # 根级别脚本
├── docs/                       # 文档
├── start.sh / start.bat        # 一键启动脚本
├── README.md                   # 项目说明
└── CLAUDE.md                   # AI 辅助开发指南
```

### 1.4 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **运行时** | Node.js | 22.x |
| **后端框架** | Fastify | 4.26+ |
| **后端语言** | TypeScript | 5.8+ |
| **参数校验** | Zod | 3.22+ |
| **Workflow 引擎** | Mastra | 1.14+ |
| **数据库** | LibSQL (@libsql/client) | 0.17+ |
| **实时通信** | @fastify/websocket + ws | 8.3+ / 8.16+ |
| **日志** | Pino + pino-pretty | 8.19+ |
| **定时任务** | node-cron | 4.2+ |
| **前端框架** | Vue 3 | 3.4+ |
| **构建工具** | Vite | 5.0+ |
| **UI 组件库** | Element Plus | 2.13+ |
| **状态管理** | Pinia | 3.0+ |
| **路由** | Vue Router | 4.2+ |
| **HTTP 客户端** | Axios | 1.6+ |
| **代码编辑器** | CodeMirror 6 | 6.0+ |
| **测试框架** | Vitest + Playwright | 4.0+ / 1.54+ |
| **国际化** | Vue I18n | 9.14+ |
| **拖拽** | vuedraggable | 4.1+ |

### 1.5 语言统计
- **TypeScript**：后端核心业务逻辑、类型系统、Workflow 引擎
- **JavaScript**：前端 Vue 组件、API 客户端、状态管理
- **Vue SFC**：前端视图和组件
- **YAML/JSON**：配置、Workflow 定义、数据文件

---

## 2. 核心模块

### 2.1 后端核心模块

#### 2.1.1 应用入口 (`backend/src/main.ts` + `app.ts`)
- **职责**：Fastify 应用构建、插件注册、路由挂载、生命周期管理
- **关键流程**：数据库初始化 → Workflow 引擎初始化 → 模板引导 → 调度器启动 → 路由注册 → 服务监听
- **生命周期钩子**：SIGTERM 优雅关闭、uncaughtException/unhandledRejection 全局错误捕获

#### 2.1.2 数据访问层 (`backend/src/repositories/`)
- **架构**：`BaseRepository<T>` 泛型基类 + 18 个实体 Repository
- **存储引擎**：LibSQL（替代了早期的 JSON 文件存储）
- **核心能力**：CRUD 操作、重试机制 (`withRetry`)、行解析/序列化
- **Repository 列表**：
  - `projectRepository` / `taskRepository` / `iterationRepository` — 项目/任务/迭代管理
  - `sessionRepository` / `sessionEventRepository` / `sessionSegmentRepository` — 三层会话模型
  - `workflowRunRepository` / `workflowInstanceRepository` / `workflowTemplateRepository` — Workflow 管理
  - `agentRepository` / `agentChatRepository` — Agent 配置与对话
  - `executionRepository` — 执行记录
  - `taskSourceRepository` — 外部任务源
  - `skillRepository` / `mcpServerRepository` — Agent 能力扩展
  - `settingsRepository` / `splitSuggestionRepository` / `presetRepository` — 系统配置

#### 2.1.3 业务服务层 (`backend/src/services/`)
- **核心服务**：
  - `projectService` / `taskService` / `iterationService` — 项目管理核心
  - `sessionService` / `sessionEventService` / `sessionSegmentService` — 会话生命周期
  - `executionService` — 执行管理
  - `agentChatService` — Agent 对话服务
  - `taskSourceService` — 任务源同步
  - `schedulerService` — 定时调度（任务源自动同步）
  - `notificationService` / `notificationEvents` — 通知系统
  - `bundleService` — 项目打包/导出
  - `skillService` / `mcpServerService` — Agent 技能与 MCP 服务管理
  - `workflowInstanceService` — Workflow 实例管理

#### 2.1.4 Workflow 引擎子系统 (`backend/src/services/workflow/`)
- **核心模块**：
  - `workflows.ts` — 动态 Workflow 工厂（基于 Mastra `createWorkflow`）
  - `workflowService.ts` — Workflow 运行管理（启动、取消、状态查询）
  - `workflowLifecycle.ts` — 步骤生命周期钩子（onStepStart/onStepComplete/onStepError）
  - `workflowTemplateService.ts` — 模板管理（CRUD、内置模板、快照）
  - `workflowStepExecutor.ts` — 步骤执行器
  - `workflowPromptAssembler.ts` — 提示词组装
  - `workflowSkillSync.ts` / `workflowMcpSync.ts` — 技能/MCP 同步
  - `workflowSummaryWriter.ts` — 步骤摘要写入

- **执行器** (`executors/`)：
  - `ClaudeCodeExecutor` — Claude Code CLI 执行器
  - `OpenCodeExecutor` — OpenCode 执行器
  - 支持异构 Agent 在不同步骤使用不同执行器

- **关键设计**：
  - 动态构建：模板在运行时动态构建为 Mastra Workflow
  - Suspend/Resume：人工确认点挂起，状态持久化到 LibSQL
  - 模板快照：运行中的流程不受模板变更影响

#### 2.1.5 任务源适配器 (`backend/src/sources/`)
- **GitHub Issues**：GitHub 任务源适配
- **CloudDevOps RR**：企业 DevOps 平台适配
- **本地目录**：本地文件系统任务源

#### 2.1.6 API 路由层 (`backend/src/routes/`)
- **19 个资源路由**：agents, agentChat, bundle, executions, git, iterations, mcpServers, notifications, presets, projects, sessions, settings, skills, splitSuggestions, tasks, taskSources, workflows, workflowTemplate
- **统一前缀**：`/api/`
- **统一响应格式**：`{ success, message, data, error }`

### 2.2 前端核心模块

#### 2.2.1 应用入口 (`frontend/src/main.js`)
- **职责**：Vue 应用初始化、插件注册（Pinia、Router、I18n、Element Plus）
- **国际化**：支持 zh-CN / en，通过 localStorage 切换

#### 2.2.2 视图层 (`frontend/src/views/`)
- `ProjectListView.vue` — 项目列表
- `KanbanView.vue` — 看板主视图
- `WorkspaceView.vue` — 工作区视图
- `AgentConfig.vue` — Agent 配置
- `WorkflowTemplateConfig.vue` — Workflow 模板配置
- `McpServerConfig.vue` — MCP 服务器配置
- `SkillConfig.vue` — 技能配置

#### 2.2.3 组件库 (`frontend/src/components/`)
- **基础组件**：`BaseDialog.vue` — 统一对话框
- **看板组件**：`kanban/` — 看板相关组件
- **任务组件**：`task/` — 任务卡片、表单等
- **会话组件**：`session/` — 会话事件渲染、时间线
- **Workflow 组件**：`workflow/` — 时间线、步骤面板、进度对话框
- **迭代组件**：`iteration/` — 迭代管理
- **编辑器组件**：`editor/` — 代码编辑器
- **差异查看器**：`DiffViewer.vue` / `GitDiffViewer.vue` / `DiffSelectDialog.vue`
- **Agent 组件**：`AgentChatPanel.vue` / `AgentSelector.vue`
- **工作区组件**：`workspace/` — 工作区布局
- **合并组件**：`MergeDialog.vue` / `CommitDialog.vue`
- **Bundle 组件**：`bundle/` — 打包管理
- **MCP 组件**：`mcp/` — MCP 服务器配置
- **通知**：`NotificationBell.vue`
- **调度配置**：`SchedulerConfig.vue`

#### 2.2.4 状态管理 (`frontend/src/stores/`)
- 8 个 Pinia Store：agent, iteration, mcpServer, project, skill, splitSuggestions, taskSource, task

#### 2.2.5 API 客户端 (`frontend/src/api/`)
- `createCrudApi.js` — CRUD API 工厂函数
- 20 个 API 模块，与后端路由一一对应
- WebSocket 客户端：`services/websocket.js`

---

## 3. 依赖关系

### 3.1 后端依赖关系

```
main.ts
  └── app.ts
        ├── config/                    # 配置读取 (.env)
        ├── db/                        # LibSQL 数据库连接
        ├── middleware/                # CORS + 错误处理
        ├── routes/ (19 个)            # REST API 路由
        │     └── services/            # 业务服务
        │           ├── repositories/  # 数据访问
        │           │     └── db/      # LibSQL 客户端
        │           ├── workflow/      # Workflow 子系统
        │           │     ├── executors/ # 执行器
        │           │     └── db/      # WorkflowRunRepository
        │           └── sources/       # 任务源适配器
        └── @fastify/websocket         # WebSocket 插件
```

**关键依赖用途**：
- `@mastra/core` + `@mastra/libsql` — Workflow 引擎及状态持久化
- `fastify` + `@fastify/cors` + `@fastify/websocket` — HTTP 服务器及插件
- `zod` — 请求参数校验
- `@libsql/client` — LibSQL 数据库驱动
- `pino` — 结构化日志
- `node-cron` — 定时任务调度
- `cross-spawn` — 子进程管理（Agent 执行）
- `ws` — WebSocket 底层实现
- `uuid` — 唯一 ID 生成
- `adm-zip` — ZIP 打包（bundle 导出）
- `yaml` — YAML 解析
- `iconv-lite` — 编码转换

### 3.2 前端依赖关系

```
main.js
  └── App.vue
        ├── router/                    # 路由定义
        ├── stores/ (8 Pinia)          # 状态管理
        │     └── api/ (20 模块)       # HTTP 客户端
        │           └── services/      # WebSocket 客户端
        ├── views/ (7 视图)            # 页面组件
        │     └── components/ (25+)    # 子组件
        ├── locales/                   # 国际化
        └── composables/               # 组合式函数
```

**关键依赖用途**：
- `vue` + `vue-router` + `pinia` — Vue 3 核心生态
- `element-plus` + `@element-plus/icons-vue` — UI 组件库及图标
- `axios` — HTTP 请求
- `@stomp/stompjs` + `sockjs-client` — WebSocket/STOMP 协议
- `codemirror` + `@codemirror/*` — 代码编辑器及语言支持
- `@codemirror/merge` — 代码差异对比
- `marked` — Markdown 渲染
- `vuedraggable` — 拖拽排序
- `@vueuse/core` — Vue 组合式工具库
- `vue-i18n` — 国际化
- `glob` — 文件模式匹配

### 3.3 模块间依赖

| 上游模块 | 下游模块 | 依赖类型 |
|----------|----------|----------|
| Repositories | Services | 数据访问 |
| Services | Routes | 业务逻辑 |
| Workflow Engine | Executors | 执行器注册 |
| Task Sources | TaskService | 任务同步 |
| Scheduler | TaskSourceService | 定时同步 |
| API Clients | Stores | 数据获取 |
| Stores | Views/Components | 状态驱动 |
| WebSocket | Session/Workflow | 实时通信 |

---

## 4. 架构模式

### 4.1 整体架构：分层架构 (Layered Architecture)

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Vue 3)                        │
│  Views → Components → Stores → API Clients → WebSocket       │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST API + WebSocket
┌───────────────────────────┴──────────────────────────────────┐
│                      Backend (Fastify 4.x)                    │
│                                                               │
│  Routes → Services → Repositories → LibSQL                   │
│                            │                                  │
│         ┌──────────────────┴──────────────────┐              │
│         │        Workflow Engine (Mastra)       │              │
│         │  Templates → Steps → Executors       │              │
│         └──────────────────┬──────────────────┘              │
│                     Git Worktree (per-task isolation)          │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 后端架构模式

#### 4.2.1 三层架构 (Routes → Services → Repositories)
- **Routes 层**：HTTP 请求处理、参数校验（Zod）、响应格式化
- **Services 层**：业务逻辑编排、事务管理、跨模块协调
- **Repositories 层**：数据访问抽象、CRUD 操作、重试机制

#### 4.2.2 仓库模式 (Repository Pattern)
- `BaseRepository<T>` 提供通用 CRUD
- 每个实体有独立的 Repository 子类
- 支持行解析/序列化覆盖（处理 JSON 字段等）

#### 4.2.3 策略模式 (Strategy Pattern)
- **执行器策略**：`ClaudeCodeExecutor` / `OpenCodeExecutor` 实现统一执行接口
- **任务源策略**：GitHub / CloudDevOps RR / 本地目录适配器

#### 4.2.4 工厂模式 (Factory Pattern)
- **Workflow 工厂**：`workflows.ts` 动态构建 Mastra Workflow
- **API 工厂**：前端 `createCrudApi.js` 生成 CRUD API 客户端

#### 4.2.5 观察者模式 (Observer Pattern)
- **生命周期钩子**：`workflowLifecycle.ts` 提供 onStepStart/onStepComplete/onStepError 回调
- **通知系统**：`notificationService` + `notificationEvents` 事件驱动

#### 4.2.6 适配器模式 (Adapter Pattern)
- **任务源适配器**：统一外部任务源接口
- **步骤结果适配器**：`stepResultAdapter.ts` 统一不同执行器的输出格式

### 4.3 前端架构模式

#### 4.3.1 组件化架构
- **视图组件**：页面级组件，组合子组件
- **通用组件**：可复用的 UI 组件（BaseDialog、DiffViewer 等）
- **领域组件**：特定业务场景组件（task/、workflow/、session/ 等）

#### 4.3.2 状态管理模式
- **Pinia Store**：集中式状态管理，8 个独立 Store
- **API 层**：Axios 客户端封装，与后端路由对应
- **WebSocket**：原生 WebSocket 客户端，实时数据推送

#### 4.3.3 组合式 API
- **Composables**：`composables/` 目录封装可复用逻辑
- **VueUse**：使用 `@vueuse/core` 提供通用组合式函数

### 4.4 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据存储 | LibSQL | 替代 JSON 文件，支持并发、事务、WAL 模式 |
| Workflow 引擎 | Mastra | Suspend/Resume 能力、状态持久化、动态构建 |
| 任务隔离 | Git Worktree | 代码级隔离、多 Agent 并行、原生 Git 能力 |
| 实时通信 | WebSocket | 低延迟、双向通信、Session 频道订阅 |
| 前端框架 | Vue 3 + Element Plus | 组件生态丰富、开发效率高 |
| 参数校验 | Zod | TypeScript 原生支持、运行时校验 |

### 4.5 数据流架构

```
用户操作 → Vue 组件 → Pinia Store → API Client → Backend Route
                                                        ↓
                                                  Service Layer
                                                        ↓
                                                 Repository Layer
                                                        ↓
                                                     LibSQL
                                                        ↓
                                                  (Response)
                                                        ↓
用户界面 ← Vue 组件 ← Pinia Store ← API Response ← Route Response
```

**实时数据流**：
```
Agent 执行 → Session/Segment/Event → WebSocket → 前端实时更新
```

---

## 5. 总结

### 5.1 项目特点
1. **AI-First 设计**：将 AI Agent 作为主要执行者，人从执行者变为设计者
2. **工程纪律**：通过 Workflow 编排、Git Worktree 隔离、持久化记忆确保可控性
3. **异构 Agent**：支持不同步骤使用不同 Agent（Claude Code 编码、OpenCode 验证）
4. **可恢复性**：Session/Segment/Event 三层模型支持断点恢复
5. **模板快照**：运行中的流程不受模板变更影响

### 5.2 技术成熟度
- **后端**：TypeScript 类型系统完善，分层架构清晰，测试覆盖全面
- **前端**：Vue 3 组合式 API，组件化设计，E2E 测试覆盖
- **基础设施**：LibSQL 替代 JSON 文件，WAL 模式支持并发
- **开发体验**：一键启动脚本、热重载、TypeScript 编译检查

### 5.3 潜在改进方向
1. 前端 Store 部分仍使用 `.js` 文件，可迁移至 TypeScript
2. 可考虑引入 API 契约测试（OpenAPI/Swagger）
3. 前端组件库可进一步抽象为独立包
4. 可考虑引入 CI/CD 流水线自动化

---

*报告由架构师代理生成，基于代码仓库静态分析*
