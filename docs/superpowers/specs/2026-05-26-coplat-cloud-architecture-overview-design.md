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
| 任务工作目录 | 49~74 |
| 代码仓库接入 | 11~18 |
| 运行时基础设施 | 31~47 |
| **合计** | **152~235 人日 ≈ 7~12 人月** |

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

## 3. 微服务划分

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

## 4. 各服务功能详述

### 4.1 Backend（控制面）

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

### 4.2 Orchestrator（新建工作流微服务）

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

### 4.3 Frontend（改造）

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

### 4.4 中间件与基础设施

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
- 利用 CSI 的 RWO 多挂载只读能力：run 进行中 editor Pod 以 `readOnly: true` 挂载实现实时观察（上线前需在目标环境验证）
- ServiceAccount 仅授予 Job / Pod / PVC / Secret / ConfigMap 的 CRUD 权限

## 5. 关键交互流程

### 5.1 启动一个 Workflow Run（Happy Path）

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

### 5.2 取消运行中的 Run

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

### 5.3 Suspend-Resume（人工确认）

```
Pod 跑到 requiresConfirmation 步骤 → 退出码标识 awaiting
   ↓
Orchestrator 标记 step suspended，不再调度后续 step
   ↓
前端展示「需要确认」→ 用户点击 → Backend → Orchestrator /resume
   ↓
Orchestrator 重新调度该 step
```

### 5.4 打开浏览器编辑器（只读 vs 编辑）

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

### 5.5 暂停 Run 进入编辑模式

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

### 5.6 归档 / 恢复 / 丢弃 / 重置

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

### 5.7 Task PVC 状态机（汇总）

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

