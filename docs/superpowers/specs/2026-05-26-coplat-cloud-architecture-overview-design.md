# Coplat 云端化架构总体设计（方案 A · 渐进 MVP）

> 文档定位：**总体功能与微服务划分**。仅描述系统由哪些服务组成、每个服务负责什么、它们之间如何交互。不包含数据表、API 字段、内部状态机等实现细节，这些将在后续分节设计文档中展开。

## 1. 背景与目标

### 1.1 现状

Coplat 当前是单机部署：Fastify backend + LibSQL（`data/kanban.db` 业务库、`data/mastra.db` 工作流引擎库），AI Agent 通过 `cross-spawn` 直接在主机上调用 `claude` / `codex` / `opencode` CLI，每个任务在主机本地的 git worktree 中执行。

### 1.2 云端化要解决的核心问题

| 问题 | 单机现状 | 云端目标 | 关键挑战               |
|---|---|---|--------------------|
| 多用户使用 | 仅当前用户 | 多团队，团队拥有项目 | —                  |
| Agent 运行 | 本地交互 | K8s Pod-per-step | K8s生命周期管理；大模型资源    |
| 工作流引擎 | Mastra | 自研 Orchestrator 微服务 | 自研状态机；事件回流；可扩展     |
| 任务工作目录：step 间共享 | 主机本地目录 | 跨 Pod 看到彼此改动 | Pod 销毁即丢；打包 vs 共享盘 |
| 任务工作目录：生命周期 | 主机目录长期存在 | 绑定 task，可归档可恢复 | 状态机；闲置归档规则 |
| 任务工作目录：在线编辑 | 本地 IDE | 网页内改代码、跑 git | 编辑器与 step 共享卷；并发互斥 |
| 任务工作目录：容量性能 | 主机硬盘 | 多团队共用云存储 | 大仓库慢；配额；同 AZ 调度 |
| 流式输出 | 子进程 stdout | 消息总线分发 | 吞吐；断线回放            |
| 高并发 | 单进程串行 | Step 级并发 | 集群容量；LLM 限速；调度热点   |
| 代码仓库接入 | 主机本地 git | 内网 Git 服务器 | SSO 共享身份；短期凭证派生 |

### 1.3 功能清单

> 工作量单位：**人日**（按一名熟悉现有代码的全栈工程师计）。范围反映"顺利"到"踩坑"的差异。"沿用"指现有代码可直接复用，仅做云端适配。

**账号与团队**
- 用户注册 / 登录（JWT）— 3~5
- 团队创建、成员邀请与角色（owner / admin / member）— 5~8
- 用户加入多个团队、前端切换当前团队 — 3~5
- 业务数据按 `team_id` 隔离（所有表 + 查询改造）— 8~12

**项目与任务**（沿用现有能力，下沉到云端）
- 项目 / 任务 / 迭代 / 看板 CRUD — 沿用（云端适配 2~3）
- 任务源同步（Issues、RR、Story）— 沿用（云端适配 1~2）
- 通知、定时调度、Bundle 导入导出 — 沿用（云端适配 2~3）

**Agent 资产**（沿用现有能力，归团队所有）
- Workflow 模板 CRUD、模板快照 — 沿用（云端适配 2~3）
- Agent / Skill / MCP Server 配置 — 沿用（云端适配 2~3）
- Agent Chat 测试面板（改走 Pod 执行）— 5~8

**Workflow 执行**
- 启动 / 取消 / 重试整 run（Orchestrator 状态机核心）— 8~12
- 单步重试、早退（canEarlyExit）— 3~5
- 人工确认（requiresConfirmation）→ suspend-resume — 5~8
- 自动重试（按模板的 maxRetries）— 2~3
- step 级并发调度（DAG 依赖）— 5~8
- 实时流式输出到前端（总线 + WebSocket 网关）— 5~8

**任务工作目录**（绑定 task，每个 task 最多一块 PVC）
- task 上加 PVC 状态字段：`pvc_status = none | active | archived`、`pvc_last_active_at` — 3~5
- step 间共享代码与 .git（同一 PVC）— 5~8
- CLI 会话目录软链到 PVC（`~/.claude/projects` 等 → `/work/.coplat/cli-sessions/`），保证 `--resume` 续聊在云端可用 — 2~4
- 浏览器内编辑器：看文件、改代码、跑 git — 15~20
- 编辑器只读 vs 写模式切换；run 进行中编辑器只读，显式"暂停 run"才能编辑 — 5~8
- Editor Pod 高可用：异常退出 5 分钟内重连恢复；自动 git stash 落盘；前端落盘状态显示 — 5~8
- 用户主动归档 / 丢弃 / 恢复 / 重置 — 5~8
- 闲置自动归档（保活信号 + 可恢复）— 3~5
- 团队级容量配额；同 AZ 调度约束；RWO 多挂载只读 CSI 验证 — 5~8
- 大仓库（>200 MB）传输性能优化 — 演进项，本期不计

**代码仓库接入**
- 与企业 SSO 共享身份体系，用户登录 Coplat 即获得 Git 访问能力 — 3~5
- Backend 在启动 run 时从 SSO 会话派生短期 Git 凭证，注入 Pod — 5~8
- 项目级 repo URL 配置；commit author 自动取登录用户 — 3~5

**运行时基础设施**
- 每个 step 在独立 K8s Pod 中执行（claude / opencode 镜像 + K8s client）— 8~12
- Pod 冷启动优化（镜像预热、init container 并行拉取）— 3~5
- 凭证临时下发（K8s Secret，Job GC 自动清理）— 3~5
- Pod 异常退出后的清理与重试 — 3~5
- 全局 / 团队级并发上限控制 — 3~5
- 用量埋点（LLM token、Pod 分钟、存储 GB），仅记录不限流 — 3~5
- Step 硬超时（默认 30 分钟，模板可覆盖）；Pod 心跳（30 秒一次，连续 10 次缺失视为僵死，Orchestrator 主动 kill）— 5~8
- 僵死 task 自愈（Backend 周期扫描，run 已不在 flight 但 task 仍 running 时切回 idle 并解锁 PVC）— 3~5

**汇总**

| 模块 | 工作量（人日） |
|---|---|
| 账号与团队 | 19~30 |
| 项目与任务（适配） | 5~8 |
| Agent 资产（适配 + Chat 改造） | 9~14 |
| Workflow 执行 | 28~44 |
| 任务工作目录 | 51~78 |
| 代码仓库接入 | 11~18 |
| 运行时基础设施 | 31~47 |
| 合计 | 154~239 人日 ≈ 7~12 人月 |

> 不含联调、压测、文档、CI/CD、生产部署、灰度迁移。整体项目以 2-3 人团队估算约 4-6 个月可发布 MVP。

## 2. 顶层架构

```
                ┌─────────────┐
   浏览器 ──────▶│  Backend    │  REST + WebSocket
                │  (Fastify)  │  控制面 / 业务数据 / 流量入口
                └──┬───────┬──┘
                   │       │
            启动/取消│       │订阅流式事件
                   │       │
                   ▼       │
            ┌──────────────┴───┐                ┌──────────────┐
            │  Orchestrator    │ ◀──Pod 事件──▶ │ Message Bus  │
            │  (microservice)  │                │ (Redis Streams)│
            │  自研工作流引擎   │                └──────┬───────┘
            └──┬───────────────┘                       ▲
               │ K8s API                                │
               ▼                                        │
       ┌─────────────────────────────┐                 │
       │  Kubernetes Cluster          │                 │
       │  ┌─ Pod (step) ──────────┐  │── 推流式输出 ───┘
       │  │ init: 拉 worktree     │  │
       │  │ main: claude/opencode CLI│  │
       │  │ post: 上传 worktree   │  │
       │  └────────────────────────┘  │
       └─────────────────────────────┘

       ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
       │ Object Storage │    │  MySQL         │    │  Container     │
       │ (worktree、    │    │  (业务库 +     │    │  Registry      │
       │  artifact)     │    │   编排库)      │    │  (executor 镜像)│
       └────────────────┘    └────────────────┘    └────────────────┘
```

## 3. 领域概念与实体关系

### 3.1 实体关系总览

```
Team ──┬── User （多对多，team_members 带角色）
       │
       ├── Project ──┬── Task ──┬── WorkflowRun ──┬── WorkflowStep ──┬── Session ──┬── Segment ── Event
       │             │          │                 │                  │
       │             │          │                 │                  └─ 沿用单机版三层会话模型
       │             │          │
       │             │          └─ TaskPVC（绑 task，0..1）
       │             │
       │             └─ 项目级 repo URL 配置
       │
       ├── WorkflowTemplate ── (运行时拍模板快照)
       ├── Agent
       ├── Skill
       └── McpServer

  运行时短期资源（不持久化）：
  - GitCredential：从用户 SSO 会话派生，注入 Pod 临时 Secret
  - LLM Credential：动态获取，注入 Pod 临时 Secret
```

### 3.2 实体职责一览

| 实体 | 归属 | 核心职责 | 生命周期 |
|---|---|---|---|
| **User** | 全局 | 登录身份，与 SSO 一一对应 | 永久（注销除外） |
| **Team** | 全局 | 顶层租户，所有业务数据归属 | 永久 |
| **TeamMember** | Team + User | 多对多关系 + 角色（owner / admin / member） | 用户进/退团队 |
| **Project** | Team | 业务上下文容器；持有 repo URL | 永久（除非删除） |
| **Task** | Project | AI 工作单元；持有 PVC 状态字段 | 永久 |
| **TaskPVC** | Task | 任务工作目录的 K8s 卷 + 状态机；不是独立实体，是 task 上的扩展字段 | 与 task 共生，但可独立归档/丢弃/重建 |
| **WorkflowTemplate** | Team | 步骤编排定义；可发布、可 fork | 永久；运行时拍快照 |
| **Agent** | Team | AI 角色配置（executor 类型、settings、提示词） | 永久 |
| **Skill** | Team | Agent 可加载的能力包 | 永久 |
| **McpServer** | Team | Agent 可调用的 MCP 服务配置 | 永久 |
| **WorkflowRun** | Task | 一次执行实例；持有模板快照 | 跟 run 状态机生灭 |
| **WorkflowStep** | WorkflowRun | run 内的步骤，对应一个 K8s Pod | 跟 step 状态机生灭 |
| **Session / Segment / Event** | WorkflowStep | 三层会话模型，记录 AI 输出 | 持久化在 MySQL，可历史回放 |
| **GitCredential** | 运行时派生 | Pod 启动时从用户 SSO 派生短期凭证 | 短（随 Pod 退出销毁） |

### 3.3 关键状态机

**TaskPVC 状态机** —— 见 §7.7

**WorkflowRun 状态机**
```
   pending ──► running ──┬─► completed
                         ├─► cancelled
                         ├─► failed
                         └─► paused（用户手动暂停以编辑）── continue ──► running
```

**WorkflowStep 状态机**
```
   pending ──► running ──┬─► completed
                         ├─► failed ── retry ──► running（在 maxRetries 内）
                         ├─► cancelled
                         └─► suspended（requiresConfirmation）── resume ──► completed
```

**编辑会话生命周期**
```
   未连接 ──► editor Pod 启动（ro 或 rw 挂载）
            ↓
         WebSocket 连上 → 用户读写 / 跑 git
            ↓
         用户关页面 ──► 5 分钟重连窗口 ──► 重连：复用 PVC 启新 Pod / 超时：终止 Pod，rw 锁释放
            ↓
         editor Pod 终止
```

### 3.4 概念边界澄清

**Task vs Run vs Step**
- 一个 task 在生命周期里可以**多次启动 run**（重跑、换模板跑、改提示词跑）
- 多次 run 共享同一个 task PVC（除非用户显式重置）
- 一个 run 包含**多个 step**（按模板 DAG 编排）
- 一个 step 对应**一个 K8s Pod**

**Project vs Team 谁拥有 Agent / Skill / Template**
- 三者全都归 **Team**，不归 Project
- 同团队内多个项目可共享 Agent / Skill / Template
- 跨团队不共享；要复用就 fork 一份到目标团队

**WorkflowTemplate vs WorkflowRun 的快照关系**
- Template 是"配方"，可以随时改
- Run 启动时把当时的 Template 整个拷一份成"快照"绑到 run
- 之后 owner 改 Template 不影响在跑的 run，只影响下次启动的 run

**TaskPVC 不是独立实体**
- 它是 task 上的几个字段（`pvc_status`、`pvc_last_active_at`、`pvc_handle` 等）+ K8s 中的一块物理卷
- 不要把它当成"workspace 表"，业务模型里 task 就是工作目录的拥有者

**Session / Segment / Event 在云端的角色不变**
- 沿用单机版的三层会话模型
- 持久化在 MySQL，是历史回放的真实数据源
- Redis Streams 只是实时分发管道，不是数据源

**CLI 会话与 Coplat 会话的关系（重要）**
- Coplat 的 `sessions / segments / events` 三层表存的是 AI **输出快照**，是给前端看的
- 真正用于"续聊"的对话上下文在 **CLI 自己的本地目录**：Claude Code 在 `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`，OpenCode 类似
- Coplat 表里的 `provider_session_id` 字段只是个**指针**——指向 CLI 本地那份 jsonl
- 续聊时 Coplat 调 `claude --resume <id>` / `opencode --session <id>`，由 CLI 自己加载本机文件
- **这意味着云端必须把 CLI 会话目录也持久化下来**，否则 Pod 销毁 = 续聊上下文丢失

**云端持久化策略**
- Pod 启动脚本把 CLI 的会话目录软链到 PVC 内的 `.coplat/cli-sessions/` 子目录（具体路径按 CLI 版本）
- 这样 CLI 会话文件**天然跟着 task PVC 走**：跨 step 续聊、暂停后续聊、归档/恢复一并处理，无需额外组件
- Agent Chat 面板的会话同样以「Chat 专属 PVC + 软链 `~/.claude`」方式持久化

**恢复场景一览**

| 场景 | 行为 |
|---|---|
| 同一 run 跨 step 续对话 | 下一 step Pod 启动后软链 PVC 里的会话目录，CLI 直接 `--resume` |
| 用户暂停 run、改了代码、继续 | CLI 会话文件留在 PVC，下一 step 启动续上 |
| 整 run 失败重试 | 按模板决定从 step 1 重跑或续上；前者会清掉 CLI 会话文件 |
| Task 归档后恢复重跑 | PVC 恢复时 CLI 会话一并回来，可续聊 |
| Task 重置工作目录 | 删 PVC 同时清掉 CLI 会话，下次 run 全新开始 |

## 4. 用户场景与核心流程

### 4.1 新用户加入团队、第一次跑 AI 任务

**角色**：新员工小张，已有公司 SSO 账号

```
1. 小张访问 Coplat 域名 → 自动跳 SSO 登录
2. 登录后落到「我的工作台」，发现没有任何团队
3. 小张找团队 owner 老李在 Coplat 里发邀请；接受邀请后进入团队
4. 团队里已有项目 X，小张获得 member 角色（可看可跑，不能改模板/Agent）
5. 在项目 X 里挑一个 task「修复登录页报错」
6. 选一个团队已发布的 Workflow 模板「修 bug」→ 点「运行」
7. Backend 校验权限 + 给 task 创建 PVC + clone repo（用小张 SSO 派生的 Git 凭证）
8. AI Pod 启动跑 step 1，前端实时显示 stdout
9. 小张点开同一 task 的「编辑器」，进只读模式看 AI 改了哪些文件
10. 全部 step 跑完 → run 完成 → 小张点「编辑」转 rw → 手动微调 → git commit + push
```

**关键决策点**：
- 第 4 步：未加入任何团队的用户看到的是空状态 + 引导加入团队
- 第 7 步：repo 凭证从 SSO 会话派生，小张不需要单独绑 Git 账号
- 第 9 步：编辑器在 run 进行中只能看不能改

### 4.2 团队 owner 配置 Workflow 模板

**角色**：团队 owner 老李，要为团队搭一套"修 bug"标准流程

```
1. 老李在「Workflow 模板」里点新建
2. 添加第 1 步「分析问题」：选 Agent = Claude，提示词模板 = 「读 task 描述 + 看相关代码定位根因」
3. 添加第 2 步「写修复」：选 Agent = Claude，依赖第 1 步产物
4. 添加第 3 步「自检」：选 Agent = OpenCode（异构验证），requiresConfirmation = true
5. 配 Skill 与 MCP（如 git-mcp、jira-mcp）
6. 老李点「保存并发布」 → 模板对所有团队成员可见
7. 团队成员跑模板时，系统拍模板快照绑定到那次 run，老李后续改模板不影响在跑的 run
```

**关键决策点**：
- 模板归团队所有，不能跨团队复用（要复用就 fork）
- 模板快照机制保证"运行中的流程不受模板变更影响"——这是从单机版沿用过来的关键设计

### 4.3 普通成员日常用：跑、看、改、提交

**角色**：开发小张，已经熟悉系统

```
1. 进项目看板，task「优化首页加载性能」在 todo 列
2. 拖到 in_progress，点「运行」选模板
3. AI 跑 step 1（分析）期间，小张开编辑器只读模式看 AI 在改什么
4. step 1 跑完 step 2 启动（写优化代码）
5. 小张觉得 AI 改的方向不对 → 点「暂停以编辑」
6. 等当前 step 跑完 → task 切到 editing → 编辑器变可写
7. 小张手动改了几个文件、跑了下测试 → 点「继续 run」
8. AI 接着跑 step 3（自检），requiresConfirmation 触发挂起
9. 小张看 AI 写的自检报告 → 点「确认通过」 → step 3 完成
10. Run 完成 → 小张在编辑器里 git push → 走团队 PR 流程
11. PR 合并后 → 小张点「合并完成」 → task PVC 进归档
```

**关键决策点**：
- 第 5-7 步「看 → 暂停 → 改 → 继续」是云端版相对单机版的核心新体验
- 第 11 步归档触发 PVC 内容打包到对象存储，可恢复

### 4.4 Run 失败后的故障处理

**角色**：开发小张，AI 在 step 2 报错

```
场景 a：单步重试
  step 2 失败 → 系统按模板的 maxRetries 自动重试 N 次
  仍失败 → run 暂停在 step 2 失败态 → 小张手动调整提示词 → 点「重试此步」

场景 b：整 run 重启
  小张觉得方向错了 → 点「重启 run」 → 系统重置 step 状态 → 从 step 1 重跑
  task PVC 不变（沿用之前的代码状态）

场景 c：抛弃工作目录重来
  小张觉得 PVC 已经被 AI 改乱了 → 点「重置工作目录」
  → PVC 删除 → 下次 run 时从 base repo 重新 clone

场景 d：Pod 卡死
  AI Pod 心跳缺失 10 次 → Orchestrator 主动 kill → step 标 failed
  task PVC 进 idle，小张可以选「重试」或「重置」
```

### 4.5 任务结束、归档与清理

**角色**：用户主动归档 / 系统自动归档

```
路径 a：合并完成自动归档
  小张点「合并完成」（已推 PR 并被合）→ task PVC 打包推对象存储 → 删 PVC → archived

路径 b：用户主动「归档」
  小张觉得 task 暂时不动了但以后可能恢复 → 点「归档」 → 同 a

路径 c：用户主动「丢弃」
  task 是探索性的、不要了 → 点「丢弃」 → 直接删 PVC，不留备份

路径 d：闲置自动归档
  task 处于 idle 状态超过 N 天（默认 7 天）→ 系统自动按路径 a 归档
  → 用户下次进入 task 看到「已归档，点击恢复」
```

**关键决策点**：
- 归档前置条件：task 必须 idle（编辑器关闭、无 run 在跑）
- 归档保留对象存储里的 tar，可恢复；丢弃不可恢复
- 自动归档窗口 7 天可由 team owner 配（3-30 天）

## 5. 微服务划分

方案 A 一开始**只新增一个微服务**（Orchestrator）。其它能力以共享中间件形式存在，不拆服务。原则：先把现有能力下沉、新职责单独成服务，避免一次拆得太碎。

| # | 服务/组件 | 类型 | 是否新建 | 职责 |
|---|---|---|---|---|
| 1 | **Backend** | 微服务 | 改造现有 | 用户/团队/权限、业务数据 CRUD、前端 WebSocket 网关、对外 API 入口 |
| 2 | **Orchestrator** | 微服务 | **新建** | 自研工作流引擎、step 调度、Pod 生命周期管理（直调 K8s API） |
| 3 | Frontend | 静态资源 | 改造现有 | Vue 3 SPA，登录态、团队切换、看板/工作流 UI |
| 4 | MySQL | 中间件 | 新建 | 业务库（backend 独占 schema）+ 编排库（orchestrator 独占 schema），物理同库逻辑分库 |
| 5 | Redis Streams | 中间件 | 新建 | Pod → backend 的流式输出总线、Pod 状态事件总线 |
| 6 | Object Storage | 中间件 | 新建 | git worktree tarball、artifact、模板/Skill/MCP 快照 |
| 7 | Container Registry | 中间件 | 新建 | claude / opencode 两个 executor 镜像 |
| 8 | Kubernetes | 基础设施 | 新建 | 单集群、单 namespace（`coplat-runs`）跑 Job |

## 6. 各服务功能详述

### 6.1 Backend（控制面）

**保留现有职责**
- 项目 / 任务 / 迭代 / 看板的 CRUD
- Agent 配置、Workflow 模板、Skill、MCP Server 管理
- Agent Chat（独立测试 Agent 的对话面板）
- Bundle 导入导出
- 任务源同步（Issues、RR、Story）
- 通知、调度（node-cron 定时同步任务源）

**新增职责**
- **多租户与权限**：用户、团队、成员关系；JWT 鉴权中间件；所有业务数据按 `team_id` 隔离
- **代码仓库接入**：项目级 repo URL 配置；从用户 SSO 会话派生短期 Git 凭证，Pod 启动时注入临时 Secret
- **任务工作目录管理**：在 `tasks` 表上扩展 PVC 状态机（none / active / editing / running / archiving / archived）；PVC 创建、归档、恢复、丢弃、重置；保活信号（step 启动、编辑器在线、用户操作）维护 `pvc_last_active_at`
- **浏览器编辑器后端**：用户打开任务工作目录时启动 editor Pod 挂载 PVC（run 进行中以 readOnly 挂载，否则以 rw 挂载）；提供文件读写、git 操作、终端的 WebSocket 代理；用户离线/超时回收 Pod
- **Editor Pod 高可用**：editor Pod 异常退出后保留会话上下文 5 分钟，用户重连即重启同一 PVC 的新 Pod；editor 后端每 30 秒（或编辑暂停 2 秒）自动 `git stash -u` 落盘，新 Pod 启动自动 `git stash pop`；前端区分「已落盘 / 未落盘」状态
- **PVC 并发互斥**：任意时刻 PVC 只能有一个 rw 挂载者（step Pod 或 editor Pod）；状态变更走应用层锁
- **工作流启动入口**：拍快照（模板 + agent + skill + MCP）上传对象存储 → 调 Orchestrator HTTP API
- **流式输出网关**：订阅 Redis Streams 上对应 run 的 channel，转发到前端 WebSocket
- **Pod 状态同步**：消费 Orchestrator 的 step 状态事件，更新业务侧 session/segment/event 视图
- **用量埋点**：聚合 Pod 上报的 LLM token、运行分钟、存储 GB，仅记录不限流

**移除职责**
- 不再直接 `cross-spawn` Executor
- 不再持有 Mastra 引擎，`data/mastra.db` 不再使用

### 6.2 Orchestrator（新建工作流微服务）

**核心职责**
- **工作流状态机**：管理 `workflow_run`、`workflow_step` 生命周期（pending → running → suspended/completed/failed/cancelled）
- **步骤调度**：根据模板 DAG 挑出"就绪 step"，按团队/全局并发上限放行
- **Pod 生命周期**：直接调 K8s API 创建 Job、挂载 backend 提供的工作区卷、注入临时 Secret 与总线 channel；监听 Pod 终态事件
- **凭证下发**：动态凭证组装为临时 K8s Secret，与 Job 绑定 `ownerReferences`，Job GC 时自动清理
- **取消、重试、恢复**：整 run 取消、单步重试、整 run 重启、自动重试（按模板 maxRetries）、suspend-resume（人工确认）
- **超时与僵死检测**：每 step 硬超时（默认 30 分钟，模板可覆盖）；监听 Pod 心跳，连续 10 次缺失（≈5 分钟）判定僵死并主动 kill Job
- **回调 backend**：通过总线把 step 状态变化推回 backend；run 完成事件通知 backend

**对外接口**
- HTTP：`POST /runs` 启动、`POST /runs/:id/cancel` 取消、`POST /runs/:id/steps/:stepId/resume` 恢复挂起、`GET /runs/:id` 查状态
- 事件输出：step 状态变化、run 完成事件

**独立性**
- 独占 `orchestrator` schema，表结构不与 backend 共享
- 不直接读 backend 业务表；启动 run 时由 backend 推送所需快照
- 不持有 PVC（task PVC 归 backend 管理），只在创建 Pod 时引用
- 不负责前端 WebSocket，不直接面向用户流量

### 6.3 Frontend（改造）

**新增**
- 登录页 + JWT 持久化
- 顶部团队切换器，切换后清空本地状态重新拉取
- 团队成员管理页（邀请、移除、角色）
- 浏览器内代码编辑器（文件树、diff 视图、git 操作面板、终端）
- 任务工作目录的「只读 / 编辑 / 暂停 run / 继续 run」操作面板
- 任务工作目录归档/恢复/丢弃/重置入口

**保留**
- 看板、工作流配置、Agent 配置、Skill、MCP、Chat 等所有现有页面
- WebSocket 客户端协议保持不变（backend 屏蔽云端总线细节）

### 6.4 中间件与基础设施

**MySQL**
- 一个物理实例，两个 schema：`backend` 与 `orchestrator`
- 各自的 migration 工具独立运行，互不依赖
- 后期分库时只需把 schema 拆到不同实例

**Redis Streams**
- 流式输出 stream key：`stream:{runId}:{stepId}`，Pod XADD 写入，backend XREAD 消费
- Pod 事件 stream key：`pod-events:{runId}`，Orchestrator 消费用于状态推进
- 配置 maxlen 上限做自然过期，不做长期归档

**Object Storage**
- bucket 划分：`snapshots`（运行时快照：模板/Skill/MCP）、`artifacts`（执行产物）、`task-archives`（归档的 task 工作目录 tar）
- 对象路径以 `team_id/` 开头便于配额与清理

**Container Registry**
- 镜像：`coplat/executor-claude`、`coplat/executor-opencode`
- 每个镜像内置对应 CLI、Node.js 运行时、git
- 不内置 Skill/MCP，Pod 启动时从对象存储拉

**Kubernetes**
- 单 namespace `coplat-runs` 承载 step Job、editor Pod、归档 Job
- 每个 task 一块 PVC（同 AZ 调度），由 backend 创建/删除；step Pod 与 editor Pod 共享挂载，但 rw 互斥
- Pod 启动脚本把 CLI 会话目录（如 `~/.claude/projects`）软链到 PVC 内 `.coplat/cli-sessions/`，确保续聊上下文跟随 task PVC 持久化
- 利用 CSI 的 RWO 多挂载只读能力：run 进行中 editor Pod 以 `readOnly: true` 挂载实现实时观察（上线前需在目标环境验证）
- ServiceAccount 仅授予 Job / Pod / PVC / Secret / ConfigMap 的 CRUD 权限

## 7. 关键交互流程

### 7.1 启动一个 Workflow Run（Happy Path）

```
1. 用户在前端点击「运行」
   ↓
2. Backend 校验权限 + task PVC 状态前置检查（idle 或 editing 已退出才允许）
   ↓
3. 若 task 未绑 PVC：创建 PVC，clone repo 进 PVC；否则复用
   ↓
4. Backend 标记 task 状态 running，拍快照 → 上传对象存储
   ↓
5. Backend 调 Orchestrator: POST /runs { snapshotRefs, taskId, pvcRef, ... }
   ↓
6. Orchestrator 写 run 状态、计算 DAG、调度首批 ready step
   ↓
7. Orchestrator 调 K8s API 创建 Job：rw 挂载 task PVC + 临时 Secret
   ↓
8. Pod init container 从对象存储拉 skill/MCP，main 跑 CLI（直接读写 PVC）
   ↓
9. Pod stdout 推 Redis Streams → Backend XREAD → 前端 WebSocket
   ↓
10. Pod 完成 → 退出（修改已落 PVC）
   ↓
11. Orchestrator 收 Pod 终态 → 更新 step 状态 → 推进下一 step
   ↓
12. 全部 step 完成 → Orchestrator 标记 run 完成 → Backend 把 task 切回 idle → 通知前端
```

### 7.2 取消运行中的 Run

```
前端 → Backend POST /runs/:id/cancel → Orchestrator
   ↓
Orchestrator 标记 run cancelling → 删除所有 in-flight Job
   ↓
Job 删除 → 关联 Secret 通过 ownerReferences GC → Pod 终止
   ↓
Orchestrator 收到 Pod 终态 → 更新 step 为 cancelled → run 终态
   ↓
Backend 把 task 状态切回 idle
```

### 7.3 Suspend-Resume（人工确认）

```
Pod 跑到 requiresConfirmation 步骤 → 退出码标识 awaiting
   ↓
Orchestrator 标记 step suspended，不再调度后续 step
   ↓
前端展示「需要确认」→ 用户点击 → Backend → Orchestrator /resume
   ↓
Orchestrator 重新调度该 step
```

### 7.4 打开浏览器编辑器（只读 vs 编辑）

```
用户在前端打开 task 工作目录 → Backend 校验权限并查 task PVC 状态

  task 状态 = running：
    Backend 创建 editor Pod，以 readOnly:true 挂 PVC（实时观察 AI 改的文件）
    前端编辑器置「只读」模式；写入按钮显示"暂停 run 才能编辑"
  task 状态 = idle：
    Backend 申请 rw 锁，task → editing
    Backend 创建 editor Pod，以 rw 挂 PVC
    前端编辑器置「编辑」模式

   ↓
前端 WebSocket 连 Backend → Backend 代理到 editor Pod
   ↓
用户读写文件、跑 git；Backend 持续刷新 pvc_last_active_at
   ↓
用户关闭页面或闲置超时 → Backend 终止 editor Pod，释放 rw 锁，task → idle
```

### 7.5 暂停 Run 进入编辑模式

```
用户在 run 进行中点「暂停以编辑」
   ↓
Backend 调 Orchestrator: 等当前 step 跑完后挂起整 run（或用户选强制取消）
   ↓
Step Pod 退出 → run 状态 paused → task 状态 idle
   ↓
Backend 把 editor Pod 从 ro 重挂为 rw（重启 editor Pod）
   ↓
task 状态 editing → 用户编辑
   ↓
用户改完点「继续 run」→ 关闭 editor 写挂载 → task 回 running → Orchestrator 调度下一 step
```

### 7.6 归档 / 恢复 / 丢弃 / 重置

```
所有动作前置：task 状态必须为 idle，否则拒绝并提示

触发：用户点「合并完成」/「归档」 或 闲置 N 天
   ↓
Backend 标记 task archiving → 启动归档 Job（ro 挂 PVC）：tar PVC → 推对象存储
   ↓
归档成功 → 删除 PVC → task pvc_status=archived

触发：用户点「丢弃」
   ↓
Backend 直接删除 PVC（不留备份）→ task pvc_status=none

触发：用户点「恢复」
   ↓
Backend 创建新 PVC → 恢复 Job 从对象存储拉 tar 解压 → task pvc_status=active

触发：用户点「重置工作目录」
   ↓
Backend 删除 PVC → 下次启动 run 时按需从 base repo 重新 clone
```

### 7.7 Task PVC 状态机（汇总）

```
                   启动 run
   none ────────────────────► running
                  开编辑器
   none ────────────────────► editing
                            ↑
                run 完成 / 取消│
   running ──────────────────┘
                暂停 run + 关闭编辑器
   editing ──────────────────► running
                关闭编辑器
   editing ──────────────────► active(idle)
                归档
   active(idle) ─────────────► archived
                恢复
   archived ─────────────────► active(idle)
                丢弃 / 重置
   active(idle) ─────────────► none
```

并发约束：
- `running` 时只允许"开编辑器（只读）"和"取消 run"
- `editing` 时只允许"关闭编辑器"
- 归档 / 恢复 / 丢弃 / 重置 / 启动新 run 必须当前为 `idle` / `none` / `archived`

## 8. 资源规模估算（千人团队）

> 假设：注册用户 1000，跨多个团队混用；以下为**稳态运行**的资源测算。本节用于容量规划与硬件采购，不影响功能设计。

### 8.1 用户活跃度模型

| 指标 | 数值 | 备注 |
|---|---|---|
| 注册用户 | 1000 | 千人团队上限 |
| 日活（DAU） | 300~400 | DAU 比例 30~40% |
| 同时在线 | 100~150 | 在线峰值约 DAU 的 30~40% |
| 同时启动 run | 30~50（峰值 80~100） | 在线用户里 25~35% 在跑 AI |
| 同时开编辑器 | 60~100 | 在线用户里 50~70% 开着编辑器 |
| 单用户活跃 task 数 | 3~5 | 影响 PVC 总量 |

### 8.2 K8s 集群容量

按峰值 100 并发 step + 100 编辑器估算：

| 工作负载 | 单 Pod 规格 | 峰值并发 | 总核 | 总内存 |
|---|---|---|---|---|
| Step Pod（claude / opencode）| 4 vCPU / 4 GB | 100 | 400 core | 400 GB |
| Editor Pod | 1 vCPU / 1 GB | 100 | 100 core | 100 GB |
| 归档 / 恢复 Job | 1 vCPU / 2 GB | 10 | 10 core | 20 GB |
| **小计** | | | **510 core** | **520 GB** |
| Buffer 30% | | | 660 core | 680 GB |

**推荐节点**：16~20 台 `16 vCPU / 64 GB` 工作节点；3 台 `8 vCPU / 16 GB` 控制平面。

**调度约束**：每个 task PVC 绑定一个 AZ，相关 step Pod 与 editor Pod 必须落同 AZ；规划至少 2-3 个 AZ 各占容量 1/3，避免单 AZ 容量打满。

### 8.3 存储

**块存储（PVC）**
- 活跃 PVC 数：1000 用户 × 平均 4 个活跃 task ≈ 4000 块
- 单 PVC 平均 5 GB（中等仓库 + 临时改动）
- **总量约 20 TB 块存储**；峰值预留 30 TB

**对象存储**
- task-archives：每用户 50 task/年 × 1000 用户 × 平均 2 GB（压缩 tar）≈ **100 TB / 年**
- snapshots（运行时模板/Skill/MCP）：每 run 约 10 MB × 25 万 run/年 ≈ **2.5 TB / 年**
- artifacts：变量大，初期估算 **5~10 TB / 年**
- **首年总量预算 110~115 TB**

### 8.4 数据库

**MySQL**
- 业务表（user/team/project/task/agent 等）：< 5 GB
- workflow_run / workflow_step：每年 ~50 万记录，每条 2 KB ≈ 1 GB / 年
- **session/segment/event 三层表只保留 30 天**：
  - 每天定时 Job 删除 30 天前的 event 数据（按 task 完成时间 / event 时间）
  - 滚动 30 天总量约 18 GB
  - 历史回放只支持近 30 天；过期数据不保留也不归档
- **总量 < 30 GB**，单机 8 vCPU / 32 GB / 500 GB SSD 长期够用
- 必须做：event 表按月分区、定时清理 Job、归档 task 时同步删除其 event

**Redis**
- 流式总线：100 active stream × maxlen 10000 × 1 KB ≈ 1 GB
- 锁、心跳、临时缓存：~500 MB
- **推荐配置**：单实例 4 GB（带主从更稳）

### 8.5 应用服务副本

| 服务 | 副本数 | 单副本规格 | 备注 |
|---|---|---|---|
| Backend | 3~5 | 2 vCPU / 4 GB | 处理 100 并发 REST + WebSocket，按 CPU 弹性扩缩 |
| Orchestrator | 2~3 | 2 vCPU / 4 GB | 100 并发 step 调度，预留多副本但首期可单写 |
| Frontend（静态） | CDN / 2 副本 | — | 静态资源走 CDN 或 Nginx |

### 8.6 网络与外部依赖

**带宽**
- 流式输出：100 active stream × 平均 50 KB/s ≈ 5 MB/s
- 编辑器：100 editor × 5 KB/s ≈ 0.5 MB/s
- Pod 拉镜像 / 拉 worktree：突发可达 100 MB/s（峰值启动）
- **稳态出网 < 10 MB/s**，峰值 < 200 MB/s

**LLM API 配额**（关键外部依赖，非自建资源）
- 100 并发 step × 单 step 50K input + 5K output tokens × 跑 3-5 分钟
- 折算 **每分钟 ~5M input tokens / ~500K output tokens**
- 需要 Anthropic / OpenAI 企业级 tier，按 RPM / TPM 申请配额
- 这是**最容易撞墙的天花板**——LLM 限速比 K8s 容量更可能成为瓶颈

### 8.7 容量风险与扩展点

| 撞墙项 | 触发阈值 | 升级方向 |
|---|---|---|
| LLM API 速率 | 并发 step > 50（视厂商配额） | 多 LLM 账号轮询 / 分团队配额 |
| K8s 节点容量 | 并发 step > 150 | 加节点；上 cluster autoscaler |
| PVC 总量 > 30 TB | 块存储成本上升 | 闲置归档窗口缩短 / 大仓库差量同步 |
| MySQL event 写入压力 | 并发 step > 200 | 上分区表读写分离 / 批量写优化 |
| Backend WebSocket 连接 > 200 | 单进程不够 | 拆 stream-gateway 服务（演进项） |
| Orchestrator 调度热点 | 并发 step > 200 | 多副本 + runId 一致性哈希分片 |

