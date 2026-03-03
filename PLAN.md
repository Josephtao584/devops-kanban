# Vibe-Kanban Java 实现计划

## 背景

用户想要参考 [vibe-kanban](https://github.com/BloopAI/vibe-kanban) 项目，使用 Java 实现一个类似的 DevOps Kanban 系统。

## Vibe-Kanban 功能分析

### 核心功能

#### 1. 项目管理
- 添加 Git 仓库作为项目（支持现有仓库或创建新仓库）
- 自动 Git 集成和仓库验证
- 项目文件搜索功能
- 自定义设置和开发脚本

#### 2. 任务管理（Kanban 风格）
- 创建和管理任务
- 任务状态追踪（Todo, In Progress, Done）
- 丰富的任务描述和备注
- 支持多列看板

#### 3. AI 代理集成
- 支持 Claude Code、Amp、Echo、Gemini CLI、OpenAI Codex
- 并行执行多个 AI 编码代理
- 实时执行监控

#### 4. Git Worktree 管理
- 为每个任务创建隔离的 git worktree
- 查看代理修改的 diff
- 将成功的更改合并回主分支
- Rebase 任务分支保持更新

#### 5. 开发工具集成
- 在编辑器中打开任务 worktree（VS Code, Cursor, Windsurf, IntelliJ, Zed）
- 停止运行中的进程
- 声音通知任务完成
- GitHub CLI (`gh`) 集成创建 PR

## 技术选型

| 组件 | 选择 |
|------|------|
| 前端框架 | Vue 3 + Element Plus |
| 后端框架 | Spring Boot 3.x |
| 数据库 | PostgreSQL |
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

## 项目结构

```
devops-kanban/
├── pom.xml                          # Maven 配置
├── src/main/java/com/devops/kanban/
│   ├── KanbanApplication.java       # 启动类
│   ├── config/                      # 配置类
│   │   ├── SecurityConfig.java
│   │   └── CorsConfig.java
│   ├── controller/                  # REST 控制器
│   │   ├── ProjectController.java
│   │   ├── TaskController.java
│   │   ├── AgentController.java
│   │   └── ExecutionController.java
│   ├── service/                     # 业务逻辑
│   │   ├── ProjectService.java
│   │   ├── TaskService.java
│   │   ├── GitService.java
│   │   ├── AgentService.java
│   │   └── ExecutionService.java
│   ├── repository/                  # 数据访问层
│   │   ├── ProjectRepository.java
│   │   ├── TaskRepository.java
│   │   ├── AgentRepository.java
│   │   └── ExecutionRepository.java
│   ├── entity/                      # 实体类
│   │   ├── Project.java
│   │   ├── Task.java
│   │   ├── Agent.java
│   │   └── Execution.java
│   ├── dto/                         # 数据传输对象
│   └── util/                        # 工具类
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/                # Flyway 迁移脚本
└── frontend/                        # Vue 3 前端
    ├── package.json
    ├── src/
    │   ├── views/
    │   ├── components/
    │   ├── api/
    │   └── store/
    └── vite.config.js
```

## 实现阶段

### 第一阶段：项目初始化（Day 1-2）
**目标：搭建基础架构**

1. **创建 Spring Boot 项目**
   - 添加依赖：Spring Web, JPA, PostgreSQL Driver, Lombok, JGit
   - 配置 `pom.xml`
   - 配置 `application.yml`（数据库连接、服务端口）

2. **创建数据库实体和 Repository**
   - `Project.java` - 项目实体
   - `Task.java` - 任务实体
   - `Agent.java` - AI 代理配置
   - `Execution.java` - 执行记录
   - 对应的 Repository 接口

3. **配置 Flyway 数据库迁移**
   - 创建初始化 SQL 脚本

### 第二阶段：项目管理和 Git 集成（Day 3-4）
**目标：实现 Git 仓库管理**

1. **Project CRUD API**
   - `GET /api/projects` - 获取项目列表
   - `POST /api/projects` - 创建项目
   - `GET /api/projects/{id}` - 获取项目详情
   - `DELETE /api/projects/{id}` - 删除项目

2. **GitService 实现**
   - `cloneRepository(url)` - 克隆仓库
   - `validateRepository(path)` - 验证仓库
   - `getBranches(projectId)` - 获取分支列表
   - `createWorktree(projectId, branch)` - 创建 worktree
   - `getDiff(projectId, from, to)` - 获取 diff
   - `merge(projectId, branch)` - 合并分支

### 第三阶段：Kanban 任务管理（Day 5-6）
**目标：实现核心看板功能**

1. **Task CRUD API**
   - `GET /api/tasks?projectId={id}` - 获取任务列表
   - `POST /api/tasks` - 创建任务
   - `PUT /api/tasks/{id}` - 更新任务
   - `PATCH /api/tasks/{id}/status` - 更新任务状态
   - `DELETE /api/tasks/{id}` - 删除任务

2. **TaskService 实现**
   - 任务状态流转逻辑
   - 任务排序

### 第四阶段：AI 代理执行（Day 7-8）
**目标：实现 AI 工具集成**

1. **Agent 管理 API**
   - `GET /api/agents` - 获取代理列表
   - `POST /api/agents` - 配置代理

2. **ExecutionService 实现**
   - `execute(taskId, agentId)` - 执行任务
   - `stop(executionId)` - 停止执行
   - `getOutput(executionId)` - 获取实时输出（WebSocket）

3. **命令执行引擎**
   - 使用 `ProcessBuilder` 执行外部命令
   - 实时输出流读取

### 第五阶段：Vue 3 前端（Day 9-12）
**目标：实现用户界面**

1. **项目初始化**
   - Vue 3 + Vite + Element Plus
   - 路由配置（Vue Router）
   - 状态管理（Pinia）

2. **页面开发**
   - 项目列表页
   - 看板页面（支持拖拽）
   - 任务详情弹窗
   - 执行监控面板

3. **API 集成**
   - Axios 封装
   - WebSocket 连接

## 关键依赖（Maven）

```xml
<!-- Spring Boot -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>

<!-- Database -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- Git -->
<dependency>
    <groupId>org.eclipse.jgit</groupId>
    <artifactId>org.eclipse.jgit</artifactId>
    <version>6.8.0.202311291450-r</version>
</dependency>

<!-- Utilities -->
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
</dependency>
```

## 验证方案

1. **单元测试**：JUnit 5 + Mockito 测试 Service 层
2. **集成测试**：Spring Boot Test 测试 API 端点
3. **手动验证**：
   - 启动 PostgreSQL 数据库
   - 运行 `mvn spring-boot:run` 启动后端
   - 访问 `http://localhost:8080/api/projects` 验证 API
   - 运行前端 `npm run dev` 访问看板界面

## Sources

- [Vibe Kanban GitHub](https://github.com/BloopAI/vibe-kanban)

---

## 当前项目进度 (2026-03-03 更新)

### 后端完成度: ~90%

| 模块 | 状态 | 说明 |
|------|------|------|
| Controller | ✅ 完成 | 所有 API 端点已实现 |
| Service | ✅ 完成 | 所有业务逻辑已实现 |
| Repository | ✅ 完成 | 文件存储实现 (非数据库) |
| Entity | ✅ 完成 | Project, Task, TaskSource, Agent, Execution |
| DTO | ✅ 完成 | 所有 DTO 和 ApiResponse |
| SPI | ✅ 完成 | TaskSourceAdapter, AgentAdapter |
| 适配器 | ✅ 完成 | Claude/Codex/GitHub/Local |
| SSE | ✅ 完成 | 实时输出流 |
| @EnableAsync | ✅ 完成 | 异步执行配置 |

### 前端完成度: ~85%

| 模块 | 状态 | 说明 |
|------|------|------|
| Vue 组件 | ✅ 完成 | KanbanView, AgentConfig, TaskSourceConfig |
| 子组件 | ✅ 完成 | TaskCard, TaskDetail |
| API 模块 | ✅ 完成 | project, task, agent, execution, taskSource |
| 路由 | ✅ 完成 | Vue Router 配置 |
| 拖拽 | ✅ 完成 | 原生 HTML5 拖拽 |
| Element Plus | ❌ 未安装 | 计划中但未实现 |
| Pinia | ❌ 未安装 | 状态管理未实现 |

### 与原计划的差异

1. **数据存储**: 使用文件存储 (JSON) 替代 PostgreSQL + JPA
2. **实时通信**: 使用 SSE 替代 WebSocket
3. **前端 UI**: 未使用 Element Plus，使用原生 CSS

---

## 后续开发任务

### 阶段 6: 核心功能完善 (进行中)

#### 6.1 验证和修复现有功能
- [ ] 启动后端服务，验证所有 API 端点正常工作
- [ ] 启动前端服务，验证页面交互正常
- [ ] 修复发现的任何 bug

#### 6.2 全局异常处理
- [ ] 添加 `@ControllerAdvice` 全局异常处理器
- [ ] 统一错误响应格式
- [ ] 文件: `src/main/java/com/devops/kanban/config/GlobalExceptionHandler.java`

#### 6.3 增强 GitService
- [ ] 添加 JGit 依赖到 pom.xml
- [ ] 实现真正的 `git worktree` 命令
- [ ] 添加 diff 查看功能
- [ ] 添加 merge 功能

### 阶段 7: 前端 UI 优化

#### 7.1 安装 Element Plus
```bash
cd frontend && npm install element-plus @element-plus/icons-vue
```
- [ ] 在 main.js 中配置 Element Plus
- [ ] 将现有组件逐步迁移到 Element Plus 组件

#### 7.2 UI 组件优化
- [ ] 使用 el-card 重构任务卡片
- [ ] 使用 el-dialog 替换模态框
- [ ] 使用 el-form 重构表单
- [ ] 使用 el-message 替换 toast

#### 7.3 安装 Pinia 状态管理
```bash
cd frontend && npm install pinia
```
- [ ] 创建 stores 目录
- [ ] 实现 projectStore, taskStore, agentStore

### 阶段 8: 新功能开发

#### 8.1 项目列表页面
- [ ] 创建 ProjectListView.vue
- [ ] 添加项目 CRUD 界面
- [ ] 支持关联 Git 仓库

#### 8.2 执行监控面板
- [ ] 增强 TaskDetail 组件
- [ ] 添加执行历史查看
- [ ] 实时日志显示优化

#### 8.3 Diff 查看器
- [ ] 创建 DiffViewer.vue 组件
- [ ] 显示代理修改的代码变更
- [ ] 支持合并操作

### 阶段 9: 扩展适配器

#### 9.1 新任务源适配器
- [ ] JiraAdapter
- [ ] GitLabIssuesAdapter
- [ ] TrelloAdapter

#### 9.2 新 AI 代理适配器
- [ ] GeminiAdapter
- [ ] AmpAdapter
- [ ] CursorAdapter

### 阶段 10: 测试和部署

#### 10.1 后端测试
- [ ] Service 层单元测试
- [ ] Controller 集成测试

#### 10.2 前端测试
- [ ] Vitest 配置
- [ ] 组件测试

#### 10.3 部署配置
- [ ] Dockerfile
- [ ] docker-compose.yml
- [ ] 生产环境配置

---

## 验证方案

1. **后端**: `mvn spring-boot:run` → 访问 http://localhost:8080/api/projects
2. **前端**: `npm run dev` → 访问 http://localhost:5173
3. **功能测试**: 创建项目 → 创建任务 → 拖拽任务 → 配置代理 → 执行任务
