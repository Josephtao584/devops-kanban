# DevOps Kanban

<p align="center">
  <strong>让 AI Agent 成为可靠的生产力</strong>
</p>

<p align="center">
  单个 Agent 跑一次 demo 很惊艳，但到了生产——<br>
  多 Agent 协调、中断恢复、结果验证，全靠人工衔接。<br>
  DevOps Kanban 为 AI Agent 构建工程纪律——上下文架构、Agent 专业化、<br>
  持久化记忆、结构化执行——让每一次交付都稳定、可观测、可恢复。
</p>

---

## 为什么 AI First 需要 Harness

大多数公司说"AI First"，实际做的是在旧有流程里嵌入 AI 工具——效率可能提升 10-20%，但**瓶颈和结构未变**。

真正的 AI First 不是"AI 辅助"，而是**AI 是默认执行者，人类提供方向、判断和约束**。这需要对整个工作系统进行根本性重构。

### 瓶颈转移：AI First 的工程现实

当执行不再是瓶颈，瓶颈会转移到其他环节：

| 新瓶颈 | Harness 应对 |
| --- | --- |
| 任务规划 / 需求澄清跟不上 AI 产出速度 | 外部源同步 + Epic 拆解 + 需求澄清 Workflow |
| 结果验证和质量保障成为交付天花板 | 自动测试 + 质量扫描 + 用例生成 |
| 产出审查压力随 AI 产出频率暴增 | AI 审查 + 安全扫描 + 规范检查 |
| 多 Agent 并行导致工作区冲突 | Worktree 隔离 + 冲突检测 + 写队列串行化 |
| 问题发现到修复的循环太慢 | 自愈闭环：监控 → 分诊 → 工单 → 修复 → 验证 |

Kanban 的定位：**将 AI First 从口号落地为可操作的 Harness 系统**——持续识别瓶颈，用工程框架逐一突破。

### Harness 四大支柱

AI First 不是放任 AI，而是让 AI 在工程框架内释放最大生产力。DevOps Kanban 把 Harness Engineering 落地为四大支柱：

#### ① 上下文架构（Context Architecture）

AI 的输出质量取决于输入的上下文质量。零散的提示词产出不可预测，结构化的上下文才能让 AI 稳定地产出工程级结果。

- Workflow 模板定义每一步的指令和上下文传递规则
- MCP/Skill 系统为 Agent 注入专业能力
- 任务卡片承载结构化的需求上下文

#### ② Agent 专业化（Agent Specialization）

没有 Agent 能做好所有事。不同任务需要不同能力——设计、编码、测试、审查各有最佳 Agent。专业化才能让每个环节都达到最高质量。

- 多执行器支持（Claude Code / Codex / OpenCode）
- 每个 Workflow 步骤独立分配 Agent
- 模板预置角色配置，开箱即用

#### ③ 持久化记忆（Persistent Memory）

AI 没有记忆就没有积累——每次从零开始是最昂贵的浪费。记忆让 AI 能从失败中学习，让历史经验成为下一次的起点。

- Session / Segment / Event 三层模型保留完整执行链
- Segment 链式 Retry——断点续接，失败仅重跑失败步骤
- Template Snapshot 冻结运行时状态，历史可精确复现

#### ④ 结构化执行（Structured Execution）

AI 在野环境里横冲直撞是灾难。结构化执行给 AI 划定边界——隔离的执行环境、确定性的流程、人工介入的安全阀。

- Git Worktree 隔离——每任务独立分支和目录，多 Agent 并行互不干扰
- Workflow 步骤编排——把"跑一次 Agent"变成结构化的工程流程
- Suspend/Resume——关键节点人工确认后继续，人不卡流程，只在决策点升华
- 写队列串行化——防止并发竞态，保证确定性

> 四大支柱不是理论——每一个都通过 **Workflow 系统** 落地为代码。Workflow 是 Harness 的执行骨架：它把"启动一个 Agent"从一个单一动作变成一个**结构化的工程流程**。

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

这些模板不是固定的——你可以通过界面或 API 创建自定义模板（最小 1 步即可），定义自己的工程流程。

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

### Workflow 如何实现四大支柱

| 支柱 | Workflow 实现 |
| --- | --- |
| **上下文架构** | 模板定义每步指令和上下文传递规则，Skill/MCP 注入专业能力，上游摘要自动传递给下游 |
| **Agent 专业化** | 每步独立分配 Agent（Claude Code / Codex / OpenCode），模板预置角色配置 |
| **持久化记忆** | Session/Segment/Event 三层记录，Step 级重试从断点恢复，Template Snapshot 冻结运行时状态 |
| **结构化执行** | Worktree 隔离 + 步骤编排 + Suspend/Resume + 写队列串行化——AI 在框架内确定性执行 |

## 它解决什么问题

| 真实痛点 | 我们的回答 |
| --- | --- |
| 任务散落在各处，没有统一入口 | 结构化的项目 → 需求 → 任务层级，支持从 GitHub Issues 等外部源导入 |
| 多个 AI 任务同时跑会冲突 | 每个任务分配独立 Git Worktree 和分支，并行执行互不干扰 |
| Agent 执行过程是黑盒，不知道它在干嘛 | WebSocket 实时推送思考、工具调用、代码变更等所有事件 |
| 执行中断后只能重头再来 | Session/Segment 分层记录，支持从断点恢复和增量重试 |
| 不知道什么时候该让人介入 | Workflow 模板可配置确认节点，Agent 执行完后暂停等待人工审查 |
| Agent 改了什么代码，看不清楚 | Worktree Diff 面板，逐行查看变更，再决定是否合并 |
| AI 加速后验证/审查成了新瓶颈 | 瓶颈转移后持续识别，自愈闭环 + AI 审查 + 自动验证逐一突破 |
| 问题发现到修复循环太慢 | 自愈反馈闭环：监控 → AI 分诊 → 自动修复 → 验证，MTTR 从天级降至小时级 |

## 一句话理解

> 一个把任务管理、Agent 编排、隔离执行和人工审查连接起来的开源 AI 交付工作台——以 Harness Engineering 为框架，让 AI Agent 成为可靠的生产力。

### 自愈反馈闭环（Self-Healing Loop）

AI First 工程平台的终极形态不是"AI 写代码"，而是形成从问题发现到修复的自动化闭环：

```text
监控告警 → AI 自动分诊（分析/评估严重性） → 创建调查工单 → AI 定位根因 → 自动修复 → 验证 → 关闭
                                                    ↑                                            │
                                                    └──────── 关键问题人工确认 ←──────────────────┘
```

目标：问题发现到修复的闭环时间从天级缩短至小时级（MTTR 从天级降至小时级）。

### 角色重构：架构师与操作员

AI First 不是消灭工程师，而是重新定义角色：

| 架构师（Architect） | 操作员（Operator） |
| --- | --- |
| 设计系统、定义标准 | 执行 AI 分配的具体任务 |
| 发现 AI 的盲点与失败模式 | 调查 Bug、优化 UI |
| 在关键节点做判断和决策 | 进行最终验证和确认 |
| 维护 Harness 框架（模板/流程/规则） | 响应 AI 无法自主解决的问题 |
| 人数较少但至关重要 | AI First 模式下的主力 |

Kanban 对两种角色的支持：Workflow 模板定义工程流程（架构师），Worktree Diff + 实时观测审查 AI 产出（操作员），Suspend/Resume 在关键节点介入（人机协同）。

## 快速开始

### 环境要求

- Node.js 22.x（`>=22 <23`）
- Git

### 一键启动

**macOS / Linux：**

```bash
./start.sh
```

**Windows：**

```cmd
start.bat
```

启动后访问：
- 前端：http://localhost:3000
- 后端：http://localhost:8000

启动脚本会自动处理依赖安装、端口占用和 Node.js 版本校验（要求 22+），运行日志存储到 `log/` 目录。

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

## 最近更新

### 自动调度引擎

新增完整的自动化调度能力，让 Kanban 从"手动触发"升级为"自动运转"：

- **自动同步**：定时从外部任务源（GitHub Issues、CloudDevOps RR 等）拉取最新任务，无需人工导入
- **自动匹配 Workflow**：新任务到达后，根据任务类型、标签、来源自动匹配最合适的 Workflow 模板
- **自动调度**：按预设规则自动启动 Workflow 执行，无需人工点击——任务来了就自动跑
- **自动通知**：Workflow 执行完成、失败、挂起等待人工确认时，自动通过 Webhook 通知相关人员

> 目标：从"任务进来到交付出去"全链路无人工干预，架构师定义规则，操作员处理异常和确认节点。

### 多 Agent 执行器支持

除了内置的 Claude Code 执行器，现已支持更多 AI Coding Agent：

| 执行器 | 状态 | 说明 |
| --- | --- | --- |
| **Claude Code** | 稳定 | Anthropic 官方 CLI，支持 Session 续接 |
| **OpenCode** | 可用 | 开源 AI 编程助手，支持 Session 续接和事件流 |
| **Codex** | 可用 | OpenAI Codex CLI |

每个 Workflow Step 可以分配不同的 Agent 执行，充分利用各 Agent 的优势。

### 统一错误处理与结构化日志

后端引入了统一的错误处理框架和结构化日志系统：

- **自定义错误类型**：`ValidationError`、`NotFoundError`、`ConflictError`、`BusinessError`、`InternalError`，每种错误携带状态码、用户消息、内部消息和上下文信息
- **全局错误中间件**：Fastify 错误处理器自动将异常转换为一致的 API 响应格式
- **结构化日志**：按组件分类的日志输出，支持上下文数据，格式为 `timestamp [LEVEL] [COMPONENT] message {context}`

### CloudDevOps RR 任务源适配器

新增 CloudDevOps RR（需求请求）适配器，支持从企业内部 DevOps 平台导入需求：

- 支持分页获取 RR 列表（最多 20 页安全限制）
- 解析复杂的 RR 描述结构
- 按用户状态和当前负责人过滤
- 支持自定义 API 路径（列表和详情端点）
- 提供连接测试功能

### 任务源内嵌面板

任务源配置从独立页面重构为项目看板内的可折叠面板：

- 与项目视图无缝集成，无需切换页面
- 支持内联添加、编辑、删除任务源
- 同步预览可选择要导入的任务
- 实时状态指示器和最近同步时间

### 统一主题与 UI 设计

- **统一主题色**：全局使用 Teal 色 `#25C6C9` 作为主题色，替换了之前分散的 indigo/purple 色系
- **BaseDialog 组件**：统一的对话框基础组件，一致的圆角、阴影、渐变头部和操作按钮样式
- **聊天时间戳**：消息气泡上方显示发送时间（精确到毫秒）
- **工具消息过滤**：可一键隐藏 `tool_call` 和 `tool_result` 事件，聚焦 Agent 的核心输出

### 数据库与可靠性改进

- **SQLite WAL 模式**：Workflow 状态数据库启用 WAL（Write-Ahead Logging），显著提升并发读写性能
- **Busy Timeout 自动重试**：30 秒忙等超时，避免 `SQLITE_BUSY` 导致的数据库锁死
- **WorkflowRunRepository 写队列**：所有变更操作通过 `_serializeMutation` 队列串行化，防止竞态条件

### Workflow 模板改进

- 最小步骤数从 2 降为 1，支持单步骤的简单 Workflow
- Workflow 步骤节点显示 Session ID，方便定位具体执行会话

### 启动脚本增强

- 日志按日期时间戳存储到 `log/` 目录（`kanban-frontend-YYYYMMDD-HHMMSS.log`）
- 自动校验 Node.js 版本（要求 22+）
- 前后端健康检查轮询，确保服务就绪
- 支持 Ctrl+C 优雅关闭

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

## 架构深度解析

DevOps Kanban 的架构不是随意拼凑的——每一个模块都对应 Harness Engineering 的一个原则。

### 竞争力与爆点

| 竞争力 | 价值 |
| --- | --- |
| **AI 原生任务执行** | 编码工作量减少 50-70%，需求→交付周期从天级缩短至小时级 |
| **多 Agent 编排引擎** | 复杂任务自动拆解多步骤执行，消除串行等待，端到端耗时缩短 60%+ |
| **Git Worktree 并行** | 多任务同时开发互不干扰，团队吞吐量线性提升 |
| **人机协同中断** | AI 自动执行 + 关键决策人工确认，返工率降低，一次通过率提升 |
| **工作流即代码** | 对比手动配 Skill/MCP，Kanban 模板预置一切，开箱即用 |
| **外部系统对接** | 需求从外部系统同步到任务执行零人工搬运，需求漏单率降低 |
| **CVE 一键修复** | 安全漏洞响应时间从天级缩短至小时级，告警→验证全自动化 |
| **Time Travel 重试** | 失败重试仅重跑失败步骤，Token 消耗节省 50%+ |
| **全链路可视化** | AI 执行过程完全透明，问题定位时间从小时级缩短至分钟级 |
| **自愈反馈闭环** | 生产问题从发现到修复形成自动化闭环，MTTR 从天级降至小时级 |
| **瓶颈转移突破** | 当执行不再是瓶颈，持续识别并重构下一个瓶颈（验证/审查/部署） |

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
│         │  │ Executors (Claude Code / Codex / OpenCode)  │    │
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

`BaseRepository` 使用静态 Promise 链序列化所有 JSON 文件写入操作。`WorkflowRunRepository` 同样通过 `_serializeMutation` 队列串行化所有变更操作，防止 Workflow Step 并发执行时的竞态条件：

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
| 任务源适配器 | GitHub Issues / CloudDevOps RR |
| 错误处理 | 自定义错误类型 + 全局错误中间件 |
| 日志 | 结构化日志（按组件分类，支持上下文） |

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
├── sources/                   # 任务源适配器（GitHub / CloudDevOps RR）
├── middleware/
│   └── errorHandler.ts        # 全局错误处理中间件
├── repositories/              # 数据访问层（BaseRepository + JSON 文件）
├── types/                     # 类型定义
└── utils/
    ├── response.ts            # 统一响应格式
    ├── errors.ts              # 自定义错误类型
    ├── logger.ts              # 结构化日志
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
│   ├── BaseDialog.vue         # 统一对话框基础组件
│   ├── taskSource/
│   │   └── TaskSourcePanel.vue # 任务源内嵌面板
│   ├── workflow/
│   │   ├── WorkflowTimeline.vue    # Workflow 时间线
│   │   └── StepSessionPanel.vue    # 步骤会话面板（含工具消息过滤）
│   └── session/
│       └── SessionEventRenderer.vue # 会话事件渲染（含时间戳）
├── stores/                    # Pinia 状态管理
├── api/                       # Axios API 客户端
├── services/
│   └── websocket.js           # WebSocket 客户端
└── locales/                   # 中英文国际化资源
```

### 数据存储

项目使用 JSON 文件存储业务数据（`data/` 目录），Workflow 状态存储在 `data/mastra.db`（LibSQL，已启用 WAL 模式）。

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
- **Workflow 模板**：通过模板定义新的多步骤执行流，配置确认节点和步骤编排（最小 1 步，最大不限）
- **任务源（Task Sources）**：通过适配器接入外部任务系统（已支持 GitHub Issues、CloudDevOps RR）
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
2. **数据目录**：后端默认通过 `STORAGE_PATH=../data` 读取项目根目录下的数据文件。建议使用启动脚本（macOS/Linux: `./start.sh`，Windows: `start.bat`）。
3. **端口约定**：前端默认 `3000`，后端默认 `8000`。启动脚本会自动处理端口冲突。
4. **Git Worktree 路径**：Worktree 存储在仓库的 `.worktrees/` 目录下（已自动添加到 `.gitignore`）。

## 贡献与许可

欢迎提交 Issue、改进建议和代码贡献。

### License

MIT License

### 致谢

- 灵感来源：[vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- AI 代理：[Claude Code](https://claude.ai/code)
- Workflow 引擎：[Mastra](https://mastra.ai)
