# Coplat Backend (Node.js)

基于 Fastify 的 Node.js 后端服务，提供 DevOps 看板管理系统的 API 接口。

## 技术栈

- **框架**: Fastify 4.x
- **WebSocket**: ws 8.x + @fastify/websocket
- **数据验证**: Zod
- **存储**: JSON 文件存储
- **协议**: 原生 WebSocket（替代 STOMP over SockJS）

## 快速开始

### 安装依赖

```bash
cd backend
npm install
```

### 配置

复制 `.env.example` 到 `.env` 并调整配置：

```bash
cp .env.example .env
```

### 启动服务

**开发模式**（支持热重载）：
```bash
npm run dev
```

**生产模式**：
```bash
npm start
```

### 使用一键启动脚本

从项目根目录运行：
```bash
./start.sh
```

## API 端点

| 资源 | 端点 |
|------|------|
| 项目 | `GET/POST/PUT/DELETE /api/projects` |
| 任务 | `GET/POST/PUT/DELETE/PATCH /api/tasks` |
| 会话 | `GET/POST/DELETE /api/sessions` |
| 任务源 | `GET/POST/PUT/DELETE /api/task-sources` |
| 执行记录 | `GET/POST/PUT/DELETE /api/executions` |
| Agent | `GET/POST/PUT/DELETE /api/agents` |
| 需求 | `GET/POST/PUT/DELETE /api/requirements` |

### WebSocket

WebSocket 端点：`ws://localhost:8000/ws`

支持的消息类型：
- **订阅**: `{ type: 'subscribe', session_id: 1, channel: 'output' }`
- **发送输入**: `{ type: 'input', session_id: 1, input: '...' }`

兼容 STOMP 格式：
- **订阅**: `{ destination: '/topic/session/1/output' }`
- **发送**: `{ destination: '/app/session/1/input', body: '{"input":"..."}' }`

## 项目结构

```
backend/
├── src/
│   ├── main.js                 # 应用入口
│   ├── config/
│   │   └── index.js            # 配置管理
│   ├── routes/
│   │   ├── projects.js         # 项目路由
│   │   ├── tasks.js            # 任务路由
│   │   ├── sessions.js         # 会话路由（含 WebSocket）
│   │   ├── taskSources.js      # 任务源路由
│   │   ├── executions.js       # 执行记录路由
│   │   ├── agents.js           # Agent 路由
│   │   ├── requirements.js     # 需求路由
│   ├── services/
│   │   ├── projectService.js   # 项目服务
│   │   ├── taskService.js      # 任务服务
│   │   ├── sessionService.js   # 会话服务
│   │   ├── executionService.js # 执行服务
│   │   └── taskSourceService.js# 任务源服务
│   ├── repositories/
│   │   ├── base.js             # 基础 Repository
│   │   ├── projectRepository.js# 项目 Repository
│   │   ├── taskRepository.js   # 任务 Repository
│   │   ├── sessionRepository.js# 会话 Repository
│   │   ├── executionRepository.js# 执行记录 Repository
│   │   ├── taskSourceRepository.js# 任务源 Repository
│   │   └── agentRepository.js  # Agent Repository
│   ├── middleware/
│   │   ├── cors.js             # CORS 中间件
│   │   └── errorHandler.js     # 错误处理中间件
│   ├── utils/
│   │   ├── response.js         # 响应格式化工具
│   │   └── git.js              # Git Worktree 工具
│   └── adapters/
│       ├── base.js             # TaskSource 适配器基类
│       └── github.js           # GitHub 适配器
├── .env                        # 环境变量配置
├── package.json
└── README.md
```

## 数据模型

### Project
```json
{
  "id": 1,
  "name": "项目名称",
  "description": "项目描述",
  "git_url": "https://github.com/...",
  "local_path": "/path/to/repo",
  "created_at": "2026-03-18T00:00:00.000Z",
  "updated_at": "2026-03-18T00:00:00.000Z"
}
```

### Task
```json
{
  "id": 1,
  "project_id": 1,
  "title": "任务标题",
  "description": "任务描述",
  "status": "TODO",
  "priority": "MEDIUM",
  "assignee": "负责人",
  "tags": ["标签 1", "标签 2"],
  "created_at": "2026-03-18T00:00:00.000Z",
  "updated_at": "2026-03-18T00:00:00.000Z"
}
```

### Session
```json
{
  "id": 1,
  "task_id": 1,
  "agent_id": 1,
  "status": "RUNNING",
  "initial_prompt": "初始提示词",
  "branch": "task/1",
  "worktree_path": "/tmp/claude-worktrees/task_1_title",
  "output": "执行输出内容",
  "created_at": "2026-03-18T00:00:00.000Z",
  "updated_at": "2026-03-18T00:00:00.000Z"
}
```

## Git Worktree 集成

系统使用 Git Worktree 为每个任务创建独立的开发环境：

1. **创建工作区**: 创建会话时自动创建 worktree
2. **运行 Claude Code**: 在 worktree 中执行 `npx @anthropic-ai/claude-code`
3. **清理工作区**: 删除会话时自动清理 worktree

## 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `SERVER_HOST` | 服务器监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 服务器端口 | `8000` |
| `STORAGE_PATH` | 数据文件存储路径 | `../data` |
| `CORS_ORIGINS` | 允许的 CORS 源 | `http://localhost:3000,http://localhost:5173` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 开发说明

### 添加新的 API 端点

1. 在 `src/routes/` 创建新的路由文件
2. 在 `src/main.js` 中注册路由
3. 如需业务逻辑，在 `src/services/` 创建服务类
4. 如需数据持久化，在 `src/repositories/` 创建 Repository 类

### 错误处理

所有路由统一返回标准格式：

**成功响应**:
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "Error message",
  "error": "Error details",
  "data": null
}
```

## 许可证

MIT
