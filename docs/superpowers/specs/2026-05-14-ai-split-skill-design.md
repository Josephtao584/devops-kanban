# AI 拆分 Skill 与 Prompt 优化设计

## 背景

`SPLIT_TASK` 步骤当前由后端在 `defaultSplitPrompt.ts` 里把项目列表 (`available_projects`) 预拼成字符串塞进 prompt，AI 只能看到摘要、看不到项目描述与工作流模板。结果：

- AI 无法根据项目描述判断是否匹配；
- AI 不知道有哪些 workflow template 可选，`template_id` 字段几乎只能填 `null`，由后端兜底；
- prompt 体积随项目数线性增长。

目标：把项目/工作流模板的查询责任从 prompt 层挪到 Skill 层，让 AI 主动通过 HTTP 接口拉取实时信息。

## 范围

### 涉及文件

- `backend/src/resources/skills/task-splitter/SKILL.md` — 内置 Skill，需要重写以加入"上下文采集"步骤
- `backend/src/services/workflow/defaultSplitPrompt.ts` — 默认 prompt 模板，需要精简
- `backend/src/services/workflow/workflows.ts` — SPLIT_TASK 执行处，需要同步 renderSplitPrompt 调用
- `backend/src/routes/workflowTemplate.ts` — preview-prompt 分支，需要同步

### 不涉及

- frontend：`WorkflowTemplateConfig.vue` 内嵌的 SPLIT_TASK 默认 prompt 字面量也需要同步更新（用户编辑模板时点"重置默认"用的）
- agent 层：`builtinTaskSplitAgent.ts` 配置不变
- 数据库 / Schema：不变
- API 路由：不新增接口，AI 直接调已有的 `GET /api/projects`、`GET /api/projects/:id`、`GET /api/workflow-template`、`GET /api/workflow-template/:id`

## 架构

```
┌─────────────────────────┐         ┌──────────────────────────┐
│ workflows.ts (SPLIT)     │         │ task-splitter SKILL.md   │
│  └─ renderSplitPrompt    │ prompt  │  - 上下文采集 (curl)      │
│     (精简后只剩任务)      │ ──────► │  - 字段 schema            │
└──────────┬──────────────┘         │  - 拆分原则与匹配规则       │
           │ executor.execute       └──────────────────────────┘
           ▼                                  │
      Claude Code agent ────── curl ──► http://localhost:8000/api
                                          /projects(/:id)
                                          /workflow-template(/:id)
```

数据流：后端 prompt 只携带"任务级"信息，AI 在 Skill 引导下调用本机 HTTP 拿项目和工作流模板的实时全集与详情，自己做语义匹配，再产出 JSON。后端解析 JSON 时保留现有兜底（`matchProject` + `default_template_id`）。

## 实现详情

### 1. SKILL.md 结构

```
1. 角色定位（保留）
2. 工作流程（新增）
   2.1 上下文采集（必须先做）
       - curl http://localhost:8000/api/projects
       - curl http://localhost:8000/api/workflow-template
       - 必要时 curl /api/projects/:id 或 /workflow-template/:id 拉详情
       - 接口失败时按 prompt 中已知信息尽力拆分
   2.2 拆分与匹配
   2.3 输出 JSON
3. 输出格式（保留 schema）
4. 字段规则
   - linked_project_id：先 git_url 精确匹配，未中再按 description / name 语义匹配
   - target_repo_url：未匹配时填 URL，匹配时 null
   - template_id：linked_project 命中时**推荐**用项目 default_template_id；
                  任务性质明显不符（默认前端模板但子任务是数据迁移）可换；
                  都没把握填 null
   - 其余字段保留
5. 拆分原则（保留 5 条）
6. 示例（保留 3 个，示例 2 补一处 curl 调用片段）
7. 严格要求（保留）
```

### 2. defaultSplitPrompt.ts

新模板：

```
# 任务：拆分需求为子任务
你必须严格按照以下要求执行：调用 `task-splitter` Skill。先按 Skill 的"上下文采集"
步骤拉取项目和工作流模板信息，再把下方"原始需求"拆分为若干可独立执行的子任务，
按 Skill 约定的 JSON schema 输出。

## 严格指令
1. 你的唯一任务是拆分子任务，不要修改代码、不要回答其他问题、不要执行任何编辑操作。
2. 必须先调用 task-splitter Skill 中要求的 curl 命令获取项目与工作流模板信息，再开始拆分。
3. 上下文中的"需求描述"和"上游产出"可能很长。只提取与"如何拆分子任务"相关的关键信息。
4. 不要在子任务里复述原始描述，每个子任务的 description 应是独立、简明的工作单元说明（1-3 句）。
5. 必须输出 ```json 代码块，里面是 JSON 数组；除此之外不要输出任何文字。

## 原始需求（核心，必须依据此拆分）
- 标题：{{task_title}}
- 描述：{{task_description}}

## 当前项目
- 名称：{{project_name}}
- 仓库：{{project_repo_url}}

## 上游步骤产出（参考，可能较长，仅提取关键信息）
{{last_step_output}}

---
现在请先调用 Skill 中的 curl 命令拉取必要上下文，再完成拆分，只输出 JSON 代码块。
```

`renderSplitPrompt` 函数：删除 `available_projects` 占位符替换；TS 签名同步去掉该字段。

### 3. workflows.ts（SPLIT_TASK 分支）

- 删除 153-157 行 `availableProjectsBlock` 拼接
- 修改 164-171 行 `renderSplitPrompt` 调用：去掉 `available_projects`
- 保留：`projectRepo.findAll()` 调用（兜底用）、`matchProject` 调用、`matchedProject?.default_template_id` 兜底
- 保留：`.replaceAll('\n', '\\n')`（CLI 截断修复）

### 4. workflowTemplate.ts（preview-prompt 分支）

- 删除 170-173 行 `availableProjectsBlock` 拼接
- 修改 178-185 行 `renderSplitPrompt` 调用：去掉 `available_projects`
- 删除该分支不再需要的 ProjectRepository import 与实例化

### 5. WorkflowTemplateConfig.vue

文件 511-528 行有 SPLIT_TASK 步骤的"默认 prompt"字面量（用户在 UI 编辑时填回的初始值）。同步替换为新版 prompt 文本，并删除其中 `{{available_projects}}` 占位符。

## 错误处理

- AI 不调 curl，按原有 prompt 信息拆分 → 降级而非失败，可接受
- curl 接口返回非 200/网络失败 → SKILL.md 明确：基于 prompt 已知信息尽力拆分
- AI 输出无效 JSON → 走现有 `maxRetries` 重试
- AI 输出空数组 → 后端原有逻辑允许空建议，仍写库
- AI 没填 linked_project_id → 后端 `matchProject` 兜底
- AI 没填 template_id 但 linked_project 命中 → 后端用项目 `default_template_id` 兜底

## 测试策略

不新增单测。手动验证清单：

1. `./start.sh` 启动
2. 选一个有跨仓库依赖的项目，触发 SPLIT_TASK 步骤
3. 检查 session 面板里 user 消息（splitPrompt）：不应再有项目列表
4. 检查 assistant 消息：应有 AI 调 Bash 工具 curl 的事件
5. 验证 suggestions：linked_project_id 命中时 template_id 是否优先取项目默认模板
6. 在 WorkflowTemplateConfig 编辑 SPLIT_TASK 步骤，点"预览 prompt"：不再有项目列表

## 风险与取舍

- 硬编码 `http://localhost:8000`：远程/容器化部署时会失效。当前是单机产品，可接受。后续如要支持远程部署，再加环境变量注入。
- AI 多两次 HTTP 调用：每次拆分多 ~200ms 延迟与少量 token 开销，远小于拆分推理本身。
- 接口返回包含较多无关字段：AI 看到全量 project/template 数据，可能浪费 token；如果出问题再考虑加专门的精简接口。
