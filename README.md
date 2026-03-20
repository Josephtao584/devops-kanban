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

**注意**: 项目分为前端 (Vue 3) 和后端 (Node.js Fastify) 两部分。

---

## 🚀 快速开始

### 环境要求

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
cd backend

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
├── backend/                 # Node.js Fastify 后端
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
│   │   │   ├── members.js
│   │   │   ├── iterations.js
│   │   │   ├── git.js
│   │   │   ├── taskWorktree.js
│   │   │   └── workflows.js
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

在 `backend/.env` 中配置：

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

## 🔌 扩展任务源

### 架构概述

UniversalAdapter 是一个通用的任务源适配器，通过 `config.yaml` 配置文件驱动，能够适配任何支持 HTTP API 的任务管理系统（如 GitHub Issues、GitLab Issues、Jira 等）。

**工作流程：**

```
用户配置 → config.yaml → UniversalAdapter → HTTP 请求 → 解析响应 → 映射转换 → 任务
```

适配器通过 YAML 配置定义：
- **request**: HTTP 请求参数（URL、Headers、Query 参数）
- **response**: 响应数据路径
- **mapping**: 字段映射（外部字段 → 内部字段）
- **transforms**: 数据转换规则

### config.yaml 结构

```yaml
adapterTypes:
  - key: TYPE_KEY              # 唯一标识符
    name: 显示名称              # UI 显示名称
    description: 描述          # 功能描述
    configFields:              # 用户配置字段
      field_name:
        type: string | array   # 字段类型
        required: true | false # 是否必填
        description: "说明"     # 字段描述
        default: 默认值         # 可选默认值
    request:                   # HTTP 请求配置
      baseUrl: "https://api.example.com"
      path: "/issues"
      method: GET | POST | ...
      headers:                 # 请求头（支持 {config.field} 占位符）
        User-Agent: "DevOps-Kanban-App"
        Authorization: "token {token}"
      params:                  # Query 参数
        state: "{state}"
    response:
      type: array | object
      path: ""                 # JSONPath 路径，空表示根级别
    mapping:                   # 字段映射
      internal_field: "$.external.field"  # 内部字段: JSONPath
      title: "$.title"
      status: "$.state"
    transforms:                 # 数据转换
      status:                  # 状态映射
        open: TODO
        closed: DONE
      external_id: "toString"   # 类型转换
      labels: "arrayMap(name)"  # 数组处理
```

### 示例：添加 Jira 任务源

```yaml
  - key: JIRA
    name: Jira Issues
    description: 从 Jira Issues 同步任务
    configFields:
      domain:
        type: string
        required: true
        description: "Jira 域名 (如 your-company.atlassian.net)"
      project:
        type: string
        required: true
        description: "Jira 项目 Key (如 PROJ)"
      email:
        type: string
        required: true
        description: "Jira 账号邮箱"
      token:
        type: string
        required: true
        description: "Jira API Token"
      jql:
        type: string
        required: false
        description: "JQL 查询语句"
        default: "project={project} ORDER BY created DESC"
    request:
      baseUrl: "https://{domain}/rest/api/3"
      path: "/search"
      method: GET
      headers:
        Authorization: "Basic {base64(email:token)}"
        Content-Type: "application/json"
        Accept: "application/json"
      params:
        jql: "{jql}"
        maxResults: "100"
        fields: "summary,description,status,created,updated,labels"
    response:
      type: array
      path: "$.issues"
    mapping:
      title: "$.fields.summary"
      description: "$.fields.description"
      external_id: "$.id"
      external_url: "$.self"
      status: "$.fields.status.name"
      labels: "$.fields.labels"
      created_at: "$.fields.created"
      updated_at: "$.fields.updated"
    transforms:
      status:
        "To Do": TODO
        "In Progress": IN_PROGRESS
        Done: DONE
      external_id: "toString"
      labels: "arrayMap(name)"
```

### JSONPath 语法

UniversalAdapter 支持类似 JSONPath 的路径语法：

| 语法 | 说明 | 示例 |
|------|------|------|
| `$.field` | 根字段 | `$.title` 获取 `item.title` |
| `$.nested.field` | 嵌套字段 | `$.fields.summary` 获取嵌套值 |
| `$.array[*].name` | 数组展开 | `$.labels[*].name` 提取所有 label 的 name |

**示例：**

```yaml
# 原始数据
# { "issue": { "labels": [{ "name": "bug", "id": 1 }, { "name": "urgent", "id": 2 }] } }

mapping:
  label_names: "$.issue.labels[*].name"
  # 结果: ["bug", "urgent"]
```

### transforms 语法

transforms 用于转换映射后的字段值：

**状态映射（对象）：**

```yaml
transforms:
  status:
    open: TODO
    closed: DONE
    in_progress: IN_PROGRESS
```

**类型转换（字符串）：**

| 转换函数 | 说明 | 示例 |
|----------|------|------|
| `toString` | 转为字符串 | `123` → `"123"` |
| `toInt` | 转为整数 | `"123"` → `123` |
| `toFloat` | 转为浮点数 | `"3.14"` → `3.14` |
| `toBoolean` | 转为布尔值 | `"true"` → `true` |
| `arrayMap(name)` | 提取数组对象 name 属性 | `[{name: "a"}, {name: "b"}]` → `["a", "b"]` |
| `arrayMap(id)` | 提取数组对象 id 属性 | `[{id: 1}, {id: 2}]` → `[1, 2]` |

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 添加新的 AI 代理

通过 UI 或 API 配置新的 AI 代理：

```bash
# 或通过 API 创建
curl -X POST http://localhost:8000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Claude Code",
    "type": "CLAUDE",
    "command": "claude",
    "config": {}
  }'
```

---

## 📄 License

MIT License

---

## 🙏 致谢

- 灵感来源：[vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- AI 代理：[Claude Code](https://claude.ai/code)
