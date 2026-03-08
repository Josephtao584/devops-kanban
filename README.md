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
- **简单任务消耗时间**：许多重复性工作（如文档更新、代码格式化、简单 Bug 修复）占用开发者大量时间

### DevOps Kanban 的解决方案

DevOps Kanban 是一个**智能化任务管理与自动执行平台**，核心理念是：

> 让 AI 代理成为你的开发助手，自动执行简单任务，让你专注于真正需要创造力的工作。

**核心特性：**
- 📋 **统一看板视图**：集中管理所有来源的任务
- 🤖 **AI 自动执行**：集成 Claude Code 等 AI 代理，自动编写代码、修复 Bug、更新文档
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
TODO → DESIGN → DEVELOPMENT → TESTING → RELEASE → DONE
```

- **拖拽排序**：直观的拖拽操作
- **优先级设置**：LOW / MEDIUM / HIGH / CRITICAL
- **自动流转**：AI 完成任务后自动推进到下一阶段
- **阶段流转规则**：可配置的关键词触发自动流转

### 🔌 任务源集成

支持从多个外部系统同步任务：

| 任务源 | 描述 |
|--------|------|
| **Local** | 本地手动创建任务 |
| **GitHub Issues** | 从 GitHub Issues 同步 |
| 可扩展... | 通过 SPI 接口支持 Jira、GitLab 等 |

### 🤖 AI 代理执行

集成多种 AI 编码代理：

| 代理 | 描述 |
|------|------|
| **Claude Code** | Anthropic 官方 CLI，强大的代码理解和生成能力 |
| 可扩展... | 通过 SPI 接口支持 Codex、Cursor 等 |

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

### 📝 提示词模板

为不同开发阶段配置专用提示词：

- **TODO 阶段**：任务分析和设计规划
- **DESIGN 阶段**：架构设计和技术方案
- **DEVELOPMENT 阶段**：代码实现
- **TESTING 阶段**：测试用例编写
- **RELEASE 阶段**：发布准备

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **后端框架** | Spring Boot 3.2.5 |
| **运行时** | Java 17 |
| **前端框架** | Vue 3.4 + Composition API |
| **构建工具** | Vite 5.0 |
| **UI 组件** | Element Plus |
| **状态管理** | Pinia |
| **国际化** | vue-i18n (中/英) |
| **实时通信** | WebSocket (STOMP) |
| **Git 操作** | JGit |
| **数据存储** | JSON 文件存储 |

---

## 🚀 快速开始

### 环境要求

- **Java 17+**
- **Node.js 18+**
- **Maven 3.6+**
- **Claude CLI**（可选，用于 AI 执行）

### 安装 Claude CLI

```bash
# macOS / Linux
npm install -g @anthropic-ai/claude-code

# 配置 API Key
claude auth login
```

### 启动后端

```bash
# 克隆项目
git clone <repository-url>
cd devops-kanban

# 启动 Spring Boot
mvn spring-boot:run
```

后端服务：http://localhost:8080

### 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务：http://localhost:5173

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
命令：claude（或 claude.cmd on Windows）
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
阶段：TODO
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

### 阶段流转配置

在 **阶段流转规则** 页面配置自动流转：

| 规则 | 触发关键词 |
|------|-----------|
| TODO → DESIGN | "设计完成", "方案确定" |
| DESIGN → DEVELOPMENT | "开始开发", "实现中" |
| DEVELOPMENT → TESTING | "开发完成", "待测试" |
| TESTING → RELEASE | "测试通过", "ready" |

### 多任务并行

利用 Worktree 隔离特性：

1. 同时启动多个任务
2. 每个任务在独立分支工作
3. 互不干扰，提高效率

---

## 📁 项目结构

```
devops-kanban/
├── src/main/java/com/devops/kanban/
│   ├── controller/          # REST API 控制器
│   ├── service/             # 业务逻辑层
│   ├── repository/          # 数据访问层
│   ├── entity/              # 实体类
│   ├── dto/                 # 数据传输对象
│   ├── spi/                 # SPI 扩展接口
│   └── adapter/             # SPI 实现
│
├── frontend/src/
│   ├── views/               # 页面组件
│   │   ├── KanbanView.vue   # 看板主页面
│   │   ├── ProjectListView.vue
│   │   └── ...
│   ├── components/          # 通用组件
│   │   ├── TaskCard.vue
│   │   ├── ChatBox.vue
│   │   └── session/
│   ├── api/                 # API 模块
│   ├── stores/              # Pinia 状态管理
│   └── locales/             # 国际化文件
│
└── data/                    # 数据存储目录
    ├── projects.json
    ├── tasks_1.json
    └── ...
```

---

## 🔧 高级配置

### 阶段流转规则

配置自动触发任务状态变更：

```json
{
  "fromPhase": "DEVELOPMENT",
  "toPhase": "TESTING",
  "completionKeywords": ["开发完成", "done", "ready for test"],
  "autoTransition": true
}
```

### 提示词模板

为不同阶段定制 AI 提示词：

```
# DEVELOPMENT 阶段模板

你是一个专业的软件工程师，当前任务：

**任务标题**：{title}
**任务描述**：{description}

请按照以下步骤执行：
1. 分析任务需求
2. 设计解决方案
3. 实现代码
4. 编写测试

注意事项：
- 遵循项目现有的代码风格
- 保持代码简洁可读
- 添加必要的注释
```

---

## 🌐 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/projects` | GET, POST | 项目管理 |
| `/api/tasks` | GET, POST, PUT | 任务管理 |
| `/api/agents` | GET, POST | AI 代理配置 |
| `/api/sessions` | POST, GET, DELETE | 会话管理 |
| `/api/prompt-templates` | GET, PUT | 提示词模板 |
| `/api/phase-transitions` | GET, POST, PUT | 阶段流转规则 |
| `/ws` | WebSocket | 实时通信 |

详细 API 文档：[API.md](API.md)

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 添加新的任务源适配器

```java
@Component
public class JiraAdapter implements TaskSourceAdapter {
    @Override
    public TaskSourceType getType() {
        return TaskSourceType.JIRA;
    }

    @Override
    public List<Task> fetchTasks(TaskSource source) {
        // 实现 Jira 任务获取逻辑
    }
}
```

### 添加新的 AI 代理

```java
@Component
public class CursorAdapter implements AgentAdapter {
    @Override
    public AgentType getType() {
        return AgentType.CURSOR;
    }

    @Override
    public void prepare(TaskDTO task, Path worktree) {
        // 准备执行环境
    }
}
```

---

## 📄 License

MIT License

---

## 🙏 致谢

- 灵感来源：[vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- AI 代理：[Claude Code](https://claude.ai/code)
