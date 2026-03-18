# DevOps Kanban

<p align="center">
  <strong>AI 驱动的智能任务管理与自动执行平台</strong>
</p>

<p align="center">
  <a href="#-项目背景">项目背景</a> •
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-使用指南">使用指南</a>
</p>

---

## 📖 项目背景

### 为什么构建这个项目？

在软件开发过程中，团队面临着许多重复性工作的挑战：

- **任务管理分散**：需求、Bug、技术债务散落在不同系统（GitHub、Jira、Linear...）
- **开发环境隔离困难**：多人协作时，不同任务的工作目录容易冲突
- **简单任务消耗时间**：许多重复性工作占用开发者大量时间

### DevOps Kanban 的解决方案

DevOps Kanban 是一个**智能化任务管理与自动执行平台**，核心理念是：

> 让 AI 代理成为你的开发助手，自动执行简单任务，让你专注于真正需要创造力的工作。

**核心特性：**
- 📋 **统一看板视图**：集中管理所有来源的任务
- 🤖 **AI 自动执行**：集成 AI 代理，自动编写代码、修复 Bug、更新文档
- 🌳 **Git Worktree 隔离**：每个任务在独立分支执行，互不干扰
- 💬 **实时交互对话**：WebSocket 实时通信，支持多轮对话引导 AI

---

## ✨ 功能特性

### 📋 项目管理

- 创建和管理多个项目
- 每个项目关联独立的 Git 仓库
- 支持本地路径和远程仓库配置

### 📊 看板任务管理

Kanban 风格的直观界面，支持完整的任务生命周期：

```
TODO → IN_PROGRESS → DONE
```

- **拖拽排序**：直观的拖拽操作
- **优先级设置**：LOW / MEDIUM / HIGH / CRITICAL
- **状态流转**：灵活的任务状态管理

### 🤖 AI 代理执行

集成多种 AI 编码代理：

| 代理 | 描述 |
|------|------|
| **Claude Code** | Anthropic 官方 CLI，强大的代码理解和生成能力 |
| **可扩展** | 通过 SPI 接口支持 Codex、Cursor 等 |

**核心能力：**
- 自动理解任务需求
- 在隔离环境中编写代码
- 支持多轮对话澄清需求
- 会话恢复（Session Resume）

### 💬 实时交互终端

- **WebSocket 双向通信**：实时查看 AI 执行过程
- **多轮对话**：随时向 AI 提供反馈和指导
- **历史记录**：保存完整的对话历史
- **终端风格输出**：清晰的代码高亮显示

### 🌳 Git Worktree 隔离

每个任务在独立的 Git Worktree 中执行：

```
project/
├── .git/
├── (main branch files)
│
.claude/worktrees/
├── task-101-xxx/    ← 任务 101 的独立工作目录
├── task-102-xxx/    ← 任务 102 的独立工作目录
└── task-103-xxx/    ← 任务 103 的独立工作目录
```

**优势：**
- 多任务并行执行，互不干扰
- 每个任务独立的分支和提交历史
- 执行完毕可轻松创建 Pull Request

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **后端框架** | Fastify 4.x + Node.js |
| **前端框架** | Vue 3.4 + Composition API |
| **构建工具** | Vite 5.0 |
| **UI 组件** | Element Plus |
| **状态管理** | Pinia |
| **国际化** | vue-i18n (中/英) |
| **数据验证** | Zod |
| **WebSocket** | ws 8.x (原生) |
| **数据存储** | JSON 文件存储 |

**注意**: 后端已从 Python FastAPI 迁移到 Node.js Fastify。如需使用旧版 Python 后端，请切换到 `python-backend` 分支。

---

## 🚀 快速开始

### 环境要求

- **Python 3.10+**
- **Node.js 18+**

### 一键启动（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd devops-kanban

# 启动所有服务
./start.sh
```

**启动后访问：**
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

**提示：** `./start.sh` 会自动检测并清理端口占用，直接运行即可。

### 手动启动

#### 启动后端

```bash
cd backend-nodejs

# 安装依赖
npm install

# 启动服务（开发模式）
npm run dev

# 启动服务（生产模式）
npm start
```

#### 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

---

## 📚 使用指南

### 第一步：创建项目

1. 访问 **项目列表** 页面
2. 点击 **新建项目**
3. 填写项目信息：

| 字段 | 说明 |
|------|------|
| 项目名称 | 显示名称 |
| 描述 | 项目描述（可选） |
| 本地路径 | Git 仓库的本地路径 |
| 仓库地址 | 远程仓库 URL（可选） |

### 第二步：配置 AI 代理

1. 进入 **智能代理** 页面
2. 点击 **添加代理**
3. 配置 Claude Code：

```
名称：Claude Code
类型：CLAUDE
命令：claude
```

### 第三步：创建任务

在看板页面点击 **新建任务**：

```
标题：添加用户登录功能
描述：
  实现用户登录功能，包括：
  1. 用户名密码登录表单
  2. JWT Token 认证
  3. 登录状态持久化

优先级：HIGH
状态：TODO
```

### 第四步：执行任务

1. 点击任务卡片，右侧打开 **聊天面板**
2. 选择 AI 代理
3. 点击 **启动** 开始执行
4. 实时查看 AI 输出，可随时输入指导

### 第五步：审查和合并

1. 查看 Worktree 中的代码变更
2. 与 AI 对话进行修改
3. 在 Git 管理页面提交代码
4. 创建 Pull Request 合并到主分支

---

## 🎯 最佳实践

### 任务描述技巧

好的任务描述能帮助 AI 更好地理解需求：

```markdown
# 好的描述 ✅
实现用户注册功能：
1. 创建 RegistrationForm 组件
2. 添加表单验证（邮箱格式、密码强度）
3. 调用 /api/register 接口
4. 注册成功后跳转到登录页

文件位置：src/components/auth/RegistrationForm.vue
参考样式：src/components/auth/LoginForm.vue
```

```markdown
# 不好的描述 ❌
做一个注册功能
```

### 多任务并行

利用 Worktree 隔离特性：

1. 同时启动多个任务
2. 每个任务在独立分支工作
3. 互不干扰，提高效率

---

## 📁 项目结构

```
devops-kanban/
├── data/                    # 数据存储目录
│   ├── projects.json        # 项目数据
│   ├── tasks.json           # 任务数据
│   ├── requirements.json    # 需求数据
│   ├── roles.json           # 角色数据
│   ├── members.json         # 团队成员数据
│   ├── sessions.json        # 会话数据
│   ├── executions.json      # 执行记录数据
│   ├── agents.json          # AI 代理数据
│   └── task_sources.json    # 任务源数据
│
├── backend-nodejs/          # Node.js Fastify 后端
│   ├── src/
│   │   ├── main.js          # 应用入口
│   │   ├── config/          # 配置管理
│   │   ├── routes/          # API 路由
│   │   │   ├── projects.js
│   │   │   ├── tasks.js
│   │   │   ├── sessions.js  # 含 WebSocket 端点
│   │   │   ├── taskSources.js
│   │   │   ├── executions.js
│   │   │   ├── agents.js
│   │   │   ├── requirements.js
│   │   │   ├── roles.js
│   │   │   └── members.js
│   │   ├── services/        # 业务逻辑层
│   │   ├── repositories/    # 数据访问层
│   │   ├── middleware/      # 中间件
│   │   ├── utils/           # 工具函数（Git Worktree）
│   │   └── adapters/        # TaskSource 适配器
│   ├── .env                 # 环境变量配置
│   └── package.json
│
├── frontend/                # Vue 3 前端
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── api/             # API 模块
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── services/        # WebSocket 等服务
│   │   ├── composables/     # 组合式函数
│   │   └── locales/         # 国际化文件
│   └── vite.config.js
│
├── start.sh                 # 一键启动脚本
└── README.md
```

---

## 🔧 高级配置

### 环境变量

在 `backend-nodejs/.env` 中配置：

```env
# 数据存储路径
STORAGE_PATH=../data

# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# CORS 配置
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# 日志级别
LOG_LEVEL=info
```

---

## 🌐 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/projects` | GET, POST, PUT, DELETE | 项目管理 |
| `/api/tasks` | GET, POST, PUT, DELETE, PATCH | 任务管理 |
| `/api/requirements` | GET, POST, PUT, DELETE | 需求管理 |
| `/api/roles` | GET, POST, PUT, DELETE | 角色管理 |
| `/api/members` | GET, POST, PUT, DELETE | 团队成员管理 |
| `/api/agents` | GET, POST | AI 代理配置 |
| `/api/sessions` | POST, GET, DELETE | 会话管理 |
| `/api/executions` | GET, POST | 执行记录 |
| `/ws` | WebSocket | 实时通信 |

详细 API 文档：访问 http://localhost:8000/docs

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 添加新的 AI 代理

通过 SPI 接口扩展新的 AI 代理：

```python
# 实现 AgentAdapter 接口
# 参考 backend/adapters/ 目录
```

---

## 📄 License

MIT License

---

## 🙏 致谢

- 灵感来源：[vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- AI 代理：[Claude Code](https://claude.ai/code)
