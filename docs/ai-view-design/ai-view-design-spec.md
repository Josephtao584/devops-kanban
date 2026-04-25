# AI 视图设计规格

## 背景

领导认为产品仍采用传统交互形式（表单、按钮、手动拖拽），缺乏 AI 时代的交互感。这不是 CSS/HTML 风格问题，而是交互方式的设计问题。

参照产品：Cursor/Windsurf 模式 — AI 深度嵌入工作流，用户通过对话/指令驱动，AI 主动执行、反馈、建议。

## 设计目标

在现有"看板视图"和"列表视图"基础上，新增第三种视图模式：**AI 视图**。提供以对话为核心的项目管理交互体验，同时完整复用现有 Workflow 基础设施。

## 核心概念

### 三栏布局

```
┌──────────┬──────────────────┬──────────────────┐
│          │                  │                  │
│  任务卡片 │   主线对话        │   支线对话        │
│          │                  │  （按需打开）      │
│  左栏    │   中栏            │   右栏            │
│          │                  │                  │
└──────────┴──────────────────┴──────────────────┘
```

- **左栏 — 任务卡片**：项目所有任务的列表，带实时状态和进度，点击可打开右侧支线
- **中栏 — 主线对话**：项目全局交互（需求讨论、任务拆解、进度概览），有底部输入框
- **右栏 — 支线对话**：针对单个任务/Agent 的深度对话和执行详情，按需打开，可关闭

### 主线 vs 支线

| 维度 | 主线（中栏） | 支线（右栏） |
|------|-------------|-------------|
| 视角 | 项目全局 | 单任务/Agent |
| 内容 | 需求讨论、AI 规划、任务调度、进度汇总 | Agent 对话、执行日志、代码变更 |
| 交互 | 用户主要操作入口 | 深入查看和干预 |
| 打开方式 | 始终显示 | 点击任务卡片或主线中的「对话↗」链接 |
| 输入框 | 有 | 有 |
| 关闭 | 不可关闭 | 可关闭（✕按钮） |

### 支线三个 Tab

1. **对话** — 用户与 Agent 的实时对话，可以补充要求、提出问题
2. **执行日志** — Agent 的终端输出流（实时或历史回放）
3. **代码变更** — Worktree 中的 git diff、文件变更列表、commit 信息

## 需求流转全流程

### 阶段 1：需求输入

- 用户在主线输入框描述需求，可附带文件
- 左栏任务区为空，显示"输入需求后 AI 将自动生成任务"
- AI 发送欢迎消息引导用户

### 阶段 2：AI 规划

- AI 分析需求后，在主线中展示执行计划
- 计划包含：任务列表（标题、优先级、分配 Agent）、执行顺序（并行/串行/分批）
- 左栏实时显示 AI 生成的任务卡片（虚线边框，标记为"规划中"）
- 活动流标记"等待用户确认"
- 用户操作：确认执行 / 调整计划 / 取消

### 阶段 3：执行中

- 用户确认后，任务卡片变为实线，状态变为"执行中"
- 主线中 AI 展示执行状态卡片（Agent + 进度条 + 百分比）
- 执行中的 Agent 卡片带有「对话↗」链接，点击打开右侧支线
- 左栏任务卡片实时更新进度（进度条、状态）
- 活动流展示事件：Agent 开始、完成、异常
- 用户可在主线追问进度，AI 汇总回答

### 阶段 4：完成审核

- 所有任务完成后，左栏全部标记 ✓
- 主线中 AI 展示执行总结：总耗时、文件变更、测试结果、代码行数
- 展示主要变更文件列表
- 用户操作：确认完成并合并代码 / 查看全部变更 / 有问题回退

## 与现有 Workflow 系统的集成

### 映射关系

| AI 视图元素 | 对应现有能力 |
|------------|-------------|
| 主线中的 AI 规划建议 | 选取/动态生成 WorkflowTemplate + 创建 Task |
| 主线中的进度汇总 | WorkflowRun 状态变更事件（step started/completed/failed） |
| 支线「对话」Tab | Step 的 Session + SessionSegment（已有 AI 对话记录） |
| 支线「执行日志」Tab | Executor 终端输出流（已有 WebSocket/SSE 推送） |
| 支线「代码变更」Tab | Worktree 的 git diff |
| 主线「暂停/继续」 | 现有 suspend/resume（requiresConfirmation + AskUserQuestion） |

### 替代关系

- **主线替代 WorkflowProgressDialog** — 不再弹出独立对话框，工作流状态融入主线对话
- **支线替代 StepSessionPanel** — 不再是弹窗内的子面板，而是独立的支线对话界面

### 集成流程

```
用户在主线输入需求
    ↓
AI Planner 服务分析需求
    ↓
生成：任务列表 + WorkflowTemplate（步骤 + Agent 绑定 + instructionPrompt）
    ↓
在主线展示计划，等待用户确认
    ↓
确认 → 调用 WorkflowService.startWorkflow（复用现有链路）
    ↓
WorkflowLifecycle 事件（onStepStart/Complete/Error）
    ↓ 推送为
主线消息（"Agent A 开始执行 xxx"、"完成 xxx"）
    ↓
用户点击任务卡片 → 打开支线
    ↓
支线加载 Step Session 数据
    ↓
用户可在支线对话（SUSPENDED 步骤 → resume；运行中 → WebSocket 实时注入）
```

### 新增组件

**AI Planner 服务**（后端）：
- 分析用户自然语言需求
- 决定：复用已有 WorkflowTemplate 或动态构建工作流步骤
- 输出：任务拆解（标题、描述、优先级）+ 工作流配置（步骤、Agent、instructionPrompt）
- 可调用 LLM 进行需求分析

### 复用组件（不改动）

- WorkflowService（startWorkflow、cancel、retry、resume）
- WorkflowLifecycle（步骤生命周期管理）
- WorkflowStepExecutor（Agent 执行）
- WorkflowRunRepository（数据持久化，含 _serializeMutation 队列）
- Mastra 工作流引擎（动态工作流构建、suspend/resume、LibSQL 持久化）
- Executor 系统（ClaudeCodeExecutor、OpenCodeExecutor）
- Git Worktree 管理

### 前端新增

- `AiView.vue` — AI 视图主页面，三栏布局
- `TaskCardList.vue` — 左栏任务卡片列表组件
- `MainLineChat.vue` — 中栏主线对话组件
- `SideLineChat.vue` — 右栏支线对话组件（含三个 Tab）
- `ExecutionLogTab.vue` — 支线执行日志 Tab
- `CodeChangesTab.vue` — 支线代码变更 Tab
- `AiPlanCard.vue` — 主线中的 AI 规划建议卡片
- `AgentStatusCard.vue` — 主线中的 Agent 执行状态卡片
- `CompletionSummary.vue` — 完成审核阶段的总结卡片

### 后端新增

- `POST /api/ai/planning` — AI 分析需求，生成任务+工作流计划
- `POST /api/ai/planning/{id}/confirm` — 确认 AI 规划，自动创建任务并启动工作流
- `WebSocket 事件扩展` — WorkflowLifecycle 事件推送为主线消息格式

## 设计 Mockup

设计过程中产出的交互原型（HTML 文件）：

1. `mockups/approach-comparison.html` — 三种方案对比
2. `mockups/ai-view-design.html` — 第一版 AI 视图原型
3. `mockups/ai-view-split-layout.html` — 左右分栏布局
4. `mockups/ai-view-detail-panel.html` — 三栏 + 详情面板
5. `mockups/ai-view-chat-panel.html` — 三栏 + 对话面板
6. `mockups/main-side-line.html` — 主线+支线最终方案 ★
7. `mockups/requirement-lifecycle.html` — 需求流转全流程页面

## 实施建议

1. **Phase 1 — AI 视图框架**：三栏布局 + 主线/支线对话框架 + 视图切换
2. **Phase 2 — AI Planner**：需求分析 → 任务拆解 → 工作流生成的后端服务
3. **Phase 3 — Workflow 集成**：主线替代 WorkflowProgressDialog，支线替代 StepSessionPanel
4. **Phase 4 — 实时推送**：WorkflowLifecycle 事件 → 主线消息，Executor 输出 → 支线日志
5. **Phase 5 — 支线深度交互**：支线对话影响 Agent 执行（resume、指令注入）
