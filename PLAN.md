# Vibe-Kanban Java 实现计划

## 背景

用户想要参考 [vibe-kanban](https://github.com/BloopAI/vibe-kanban) 项目，使用 Java 实现一个类似的 DevOps Kanban 系统。

## 技术选型

| 组件 | 选择 |
|------|------|
| 前端框架 | Vue 3 + Element Plus + Pinia |
| 后端框架 | Spring Boot 3.x |
| 数据存储 | 文件存储 (JSON) |
| 核心功能 | Kanban 任务管理 + Git 仓库集成 + AI 代理执行 |

## 数据模型设计

```
Project (项目)
├── id: Long
├── name: String
├── path: String (Git 仓库路径)
├── gitUrl: String
├── createdAt: LocalDateTime
└── updatedAt: LocalDateTime

Task (任务)
├── id: Long
├── title: String
├── description: String
├── status: TaskStatus (TODO, IN_PROGRESS, DONE)
├── priority: Priority
├── projectId: Long
├── branch: String (Git 分支)
├── worktreePath: String
├── createdAt: LocalDateTime
└── updatedAt: LocalDateTime

Agent (AI 代理配置)
├── id: Long
├── name: String
├── type: AgentType (CLAUDE, AMP, ECHO, etc.)
├── command: String
├── config: JSON
└── projectId: Long

Execution (执行记录)
├── id: Long
├── taskId: Long
├── agentId: Long
├── status: ExecutionStatus
├── output: String
├── startedAt: LocalDateTime
└── completedAt: LocalDateTime
```

---

## 验证方案

1. **后端**: `mvn spring-boot:run` → 访问 http://localhost:8080/api/projects
2. **前端**: `npm run dev` → 访问 http://localhost:5173
3. **功能测试**: 创建项目 → 创建任务 → 拖拽任务 → 配置代理 → 执行任务

## Sources

- [Vibe Kanban GitHub](https://github.com/BloopAI/vibe-kanban)

---

## AI Session 管理功能 - 冒烟测试用例

### 核心需求
- 每个任务可以创建一个独立的 AI session（Claude Code、Codex 等）
- 通过监听 CLI 输出的方式实现实时交互
- 支持向 AI agent 发送输入（交互式）
- 每个任务只能有一个活跃 Session

### 一、Session 生命周期测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-01 | 创建 Session | `POST /api/sessions` (taskId, agentId) | 返回 201，Session ID 生成，状态为 CREATED | P0 |
| SESS-02 | 启动 Session | `POST /api/sessions/{id}/start` | 返回 202，状态变为 RUNNING，进程启动 | P0 |
| SESS-03 | 停止 Session | `POST /api/sessions/{id}/stop` | 返回 202，状态变为 STOPPED，进程终止 | P0 |
| SESS-04 | 获取 Session 状态 | `GET /api/sessions/{id}` | 返回 Session 详情（状态、进程信息等） | P0 |
| SESS-05 | 获取任务的活跃 Session | `GET /api/sessions?taskId={id}&activeOnly=true` | 返回该任务当前活跃的 Session | P0 |
| SESS-06 | 获取 Session 历史输出 | `GET /api/sessions/{id}/output` | 返回历史输出日志 | P1 |
| SESS-07 | 重启 Session | `POST /api/sessions/{id}/stop` + `POST /api/sessions/{id}/start` | Session 正确重启 | P1 |

### 二、单任务单 Session 约束测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-10 | 任务已有活跃 Session 时创建 | 已有 RUNNING Session，再次 `POST /api/sessions` | 返回 409 Conflict，提示"任务已有活跃 Session" | P0 |
| SESS-11 | Session 停止后可创建新 Session | 停止后重新创建 | 返回 201，创建成功 | P0 |
| SESS-12 | 多任务各自独立 Session | 任务 A、B 各创建 Session | 两个 Session 独立运行，互不影响 | P1 |

### 三、实时输出流测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-20 | WebSocket 连接 | 连接 `/ws` (STOMP) | 连接成功，可订阅 topic | P0 |
| SESS-21 | 订阅输出流 | 订阅 `/topic/session/{id}/output` | 收到实时输出事件 | P0 |
| SESS-22 | 订阅状态变更 | 订阅 `/topic/session/{id}/status` | 状态变更时收到通知 | P0 |
| SESS-23 | 输出内容格式 | 检查输出事件 | 包含 timestamp、stream(stdout/stderr)、line | P1 |
| SESS-24 | 大量输出处理 | AI 输出大量内容 | 输出不丢失、不阻塞 | P2 |
| SESS-25 | 断线重连 | WebSocket 断开后重连 | 可重新订阅，继续接收输出 | P2 |

### 四、交互式输入测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-30 | 发送输入 | `SEND /app/session/{id}/input` (WebSocket) | AI agent 收到输入并响应 | P0 |
| SESS-31 | 输入框 UI | 前端输入框输入文本并发送 | 发送成功，输出区域显示响应 | P0 |
| SESS-32 | 多行输入 | 发送多行文本 | 正确处理换行符 | P1 |
| SESS-33 | 特殊字符输入 | 发送包含特殊字符的文本 | 正确转义/处理 | P2 |
| SESS-34 | Session 非运行时发送输入 | STOPPED 状态发送输入 | 返回错误或忽略 | P1 |

### 五、Agent 类型兼容性测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-40 | Claude Code Session | 使用 CLAUDE_CODE agent 创建 Session | 正常启动，输出正确 | P0 |
| SESS-41 | Codex Session | 使用 CODEX agent 创建 Session | 正常启动，输出正确 | P1 |
| SESS-42 | Local Script Session | 使用 LOCAL agent 创建 Session | 正常启动，输出正确 | P1 |
| SESS-43 | 不支持的 Agent 类型 | 使用无效 agentType | 返回 400 错误 | P2 |

### 六、Worktree 隔离测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-50 | Worktree 创建 | 创建 Session 时 | 自动在指定路径创建 worktree | P0 |
| SESS-51 | Worktree 清理 | Session 停止/完成时 | worktree 正确清理（可选保留） | P1 |
| SESS-52 | 多 Session 文件隔离 | 两个任务同时运行 | 文件修改互不影响 | P1 |

### 七、前端 UI 测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-60 | SessionTerminal 组件渲染 | 打开任务详情页 | 终端组件正确显示 | P0 |
| SESS-61 | 实时输出显示 | Session 运行中 | 输出实时滚动显示 | P0 |
| SESS-62 | 状态指示器 | Session 不同状态 | 正确显示 RUNNING/IDLE/STOPPED | P1 |
| SESS-63 | 控制按钮 | Start/Stop/Restart 按钮 | 功能正常，状态正确切换 | P0 |
| SESS-64 | 输入框交互 | 输入文本并发送 | 发送成功，有响应 | P0 |
| SESS-65 | 历史输出加载 | 刷新页面后 | 正确加载历史输出 | P1 |
| SESS-66 | 终端样式 | 检查终端样式 | 黑色背景、等宽字体、滚动条 | P2 |

### 八、异常与边界测试

| ID | 测试项 | 操作 | 验证点 | 优先级 |
|----|--------|------|--------|--------|
| SESS-70 | 访问不存在的 Session | `GET /api/sessions/non-existent-id` | 返回 404 | P1 |
| SESS-71 | 无效任务 ID 创建 | `POST /api/sessions` (无效 taskId) | 返回 400 或 404 | P1 |
| SESS-72 | 进程异常退出 | 模拟 AI agent 崩溃 | 状态变为 ERROR，错误信息记录 | P1 |
| SESS-73 | 超时处理 | Session 运行超时 | 自动停止，状态标记 TIMEOUT | P2 |
| SESS-74 | 并发启动同一 Session | 同时发送多个 start 请求 | 只有一个成功，其他返回错误 | P2 |

### 九、集成流程测试

| ID | 测试项 | 操作流程 | 验证点 | 优先级 |
|----|--------|----------|--------|--------|
| SESS-80 | 完整交互流程 | 创建项目→创建任务→配置Agent→创建Session→启动→交互→停止 | 流程完整可用 | P0 |
| SESS-81 | Session 重连流程 | 运行中刷新页面→重新连接→继续交互 | 无需重启，继续使用 | P1 |
| SESS-82 | 多任务并行执行 | 任务 A、B 同时运行各自 Session | 两个 Session 独立运行 | P1 |

### 优先级说明

| 级别 | 说明 | 通过标准 |
|------|------|----------|
| **P0** | 核心功能，必须通过 | 100% 通过 |
| **P1** | 重要功能，应该通过 | 建议 100% 通过 |
| **P2** | 次要功能，建议通过 | 可接受部分失败 |

### 冒烟测试通过标准

- 所有 **P0** 级测试用例必须通过
- **P1** 级测试用例建议全部通过
- 阻塞发布的问题必须在发布前修复
