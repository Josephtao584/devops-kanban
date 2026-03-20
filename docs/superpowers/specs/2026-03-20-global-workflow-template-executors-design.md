# 2026-03-20 全局工作流模板与可配置 Step Executor 设计

## 背景

当前后端工作流执行链路将 step 执行器与 Claude 强耦合：

- `backend/src/workflows/index.js` 里的固定 4 个 step 直接调用 `executeClaudeWorkflowStep(...)`
- `backend/src/services/workflowStepExecutor.js` 当前仅是 Claude 的薄封装
- `backend/src/services/claudeStepRunner.js` 直接负责命令构造、进程启动、结果解析

这带来几个问题：

1. workflow step 只能绑定 Claude，无法为不同 step 选择不同 agent CLI。
2. Claude 的启动方式、命令覆盖、环境变量、输出解析都被写死在单一路径里，后续接入 Codex / OpenCode 会不断复制逻辑。
3. 当前 workflow 模板虽然固定为 4 个 step，但 step 本身没有独立配置层，无法只调整 step 对应执行器。
4. Windows 下现有 `shell: true + claude -p <multiline prompt>` 方案已经暴露出命令截断和入口查找问题，说明命令构造需要单独抽象，而不应继续散落在 step 逻辑中。

同时，参考 `D:/workspace/vibe-kanban/crates/executors` 可以看到更成熟的方向：

- 用统一 executor 抽象承载多种 coding agent：`CLAUDE_CODE` / `CODEX` / `OPENCODE` 等。
- 用统一接口隔离“workflow 调度”和“具体 agent CLI 启动细节”。
- 将默认命令、额外参数、环境变量等视为 executor 配置问题，而不是 workflow 问题。

## 目标

本次设计目标不是开放式自定义 workflow 编排，而是：

1. 保持当前固定的 4 个 step 不变：
   - `requirement-design`
   - `code-development`
   - `testing`
   - `code-review`
2. 增加一份 **全局 workflow 模板配置**。
3. 允许修改模板中每个 step 绑定的 executor。
4. workflow 执行时，按 step 配置的 executor 选择对应 agent CLI。
5. 保留各 executor 的原生输出，在适配层统一转换为现有 step result 格式：

```json
{
  "changedFiles": ["..."],
  "summary": "..."
}
```

## 范围

### 本次纳入范围

- 全局 workflow 模板配置（global，不与 project 绑定）
- 固定 4 个 step 的 executor 可配置
- 统一 executor 抽象层
- Claude / Codex / OpenCode 这类 executor 的可扩展结构
- workflow 执行时按 step 选择 executor
- 原生输出到统一 step result 的适配层

### 本次不纳入范围

- 自定义 step 数量
- 自定义 step 顺序
- 自定义 DAG / 条件分支
- 完整搬运 vibe-kanban 的 profile / discovery / setup-helper 全套体系
- UI 细节实现
- 所有 executor 一次性实现完整能力对齐

## 设计原则

1. **固定模板，先配置 step executor**：先解决“固定 workflow 的不同 step 可选不同 agent”。
2. **workflow 不直接依赖 Claude**：workflow 只关心 step 要执行，不关心底层是 Claude、Codex 还是 OpenCode。
3. **保留 executor 原生输出**：不同 CLI 的 stdout / stderr / JSON 结构允许不同，通过适配层转换。
4. **统一 step 结果契约**：workflow 上层继续使用 `changedFiles + summary`。
5. **命令构造独立抽象**：将入口命令、附加参数、环境变量等归于 executor 配置。
6. **兼容现有 JSON 存储模式**：沿用当前 repository + JSON 文件风格。

## 参考分析：vibe-kanban 的可借鉴点

### 1. 多 executor 类型统一建模

`D:/workspace/vibe-kanban/crates/executors/src/executors/mod.rs` 中的 `CodingAgent` 将多种 agent CLI 统一抽象为一个枚举：

- `ClaudeCode`
- `Codex`
- `Opencode`
- `Gemini`
- `CursorAgent`
- 等

可借鉴点：本项目也应引入统一 executor 类型，而不是让 workflow 直接依赖某个 runner。

### 2. 标准化执行接口

`StandardCodingAgentExecutor` 提供统一能力：

- `spawn(...)`
- `spawn_follow_up(...)`
- `normalize_logs(...)`
- `discover_options(...)`

可借鉴点：本项目第一版无需全部照搬，但至少应建立统一的 `execute(...)` 能力边界，让每种 executor 都能独立实现自己的启动和解析逻辑。

### 3. 命令构造与配置分离

`command.rs` 通过：

- `CommandBuilder`
- `CommandParts`
- `CmdOverrides`

将默认命令、额外参数、环境变量从 executor 主逻辑中分离。

可借鉴点：本项目应支持“默认入口 + 可覆盖命令 + 可附加参数 + 可注入 env”，避免将进程启动方式写死在 `claudeStepRunner.js` 中。

### 4. 不一次性照搬 profile 系统

vibe-kanban 还包含：

- profile / variant
- option discovery
- availability
- setup helper
- slash commands

这些能力很强，但对当前项目第一阶段来说超出必要范围。第一版应该只保留最小可用骨架，避免过度设计。

## 总体方案

采用“统一 executor 抽象层”的方案，而不是在 workflow step 中直接分支判断具体 runner。

### 当前链路

```text
workflow step
  -> executeClaudeWorkflowStep
    -> ClaudeStepRunner
      -> claude CLI
```

### 目标链路

```text
workflow step
  -> workflowStepExecutor facade
    -> globalWorkflowTemplateResolver
    -> AgentExecutorRegistry
    -> selected executor
    -> StepResultAdapter
```

## 数据模型

### 全局 workflow 模板配置

新增一份全局配置，表示固定模板中每个 step 的 executor 绑定关系。

建议 JSON 结构：

```json
{
  "template_id": "dev-workflow-v1",
  "name": "默认研发工作流",
  "steps": [
    {
      "id": "requirement-design",
      "name": "需求设计",
      "executor": {
        "type": "CLAUDE_CODE",
        "commandOverride": null,
        "args": [],
        "env": {}
      }
    },
    {
      "id": "code-development",
      "name": "代码开发",
      "executor": {
        "type": "CLAUDE_CODE",
        "commandOverride": null,
        "args": [],
        "env": {}
      }
    },
    {
      "id": "testing",
      "name": "测试",
      "executor": {
        "type": "CLAUDE_CODE",
        "commandOverride": null,
        "args": [],
        "env": {}
      }
    },
    {
      "id": "code-review",
      "name": "代码审查",
      "executor": {
        "type": "CLAUDE_CODE",
        "commandOverride": null,
        "args": [],
        "env": {}
      }
    }
  ]
}
```

### 字段说明

#### 模板级字段

- `template_id`: 当前固定模板 ID，第一版固定为 `dev-workflow-v1`
- `name`: 模板显示名
- `steps`: 固定 4 项，顺序和 step id 必须符合内建模板

#### step 级字段

- `id`: 固定 step id
- `name`: step 显示名
- `executor`: 该 step 使用的执行器配置

#### executor 配置字段

- `type`: `CLAUDE_CODE | CODEX | OPENCODE`
- `commandOverride`: 覆盖默认命令入口
- `args`: 附加命令行参数
- `env`: 附加环境变量

### 为什么第一版只做这些字段

这几个字段已经足以覆盖当前目标：

- 能切换不同 agent CLI
- 能覆盖默认入口命令
- 能给特定 executor 追加参数
- 能为 executor 注入环境变量

先不引入 `model_id` / `reasoning_id` / `permission_policy` 等更细粒度字段，避免第一版做得过重。

## 存储方案

### 新增数据文件

建议新增全局 JSON 文件，例如：

- `data/workflow_template.json`

因为当前只需要一份 global 模板，而不是列表管理，所以第一版建议存为单对象而不是对象数组。

### 新增 repository

新增类似：

- `backend/src/repositories/workflowTemplateRepository.js`

职责：

- 读取全局 workflow 模板配置
- 初始化默认模板配置
- 更新模板中的 step executor 配置
- 校验模板结构合法性

### 为什么不直接塞进 projects.json

因为本次需求已经明确改为 **global**，不需要与 project 关联。将模板配置独立出来能避免：

- project 数据结构污染
- workflow 配置与项目元数据耦合
- 后续如果要增加多个全局模板时难以迁移

## 执行器抽象设计

### 统一入口：workflowStepExecutor facade

将 `backend/src/services/workflowStepExecutor.js` 从“Claude 专用封装”改造成“统一 step 执行入口”。

建议提供类似接口：

```js
executeWorkflowStep({
  context,
  stepId,
  worktreePath,
  taskTitle,
  taskDescription,
  previousSummary,
})
```

其内部职责：

1. 读取全局 workflow 模板
2. 根据 `stepId` 找到 step executor 配置
3. 获取对应 executor 实例
4. 执行并返回原生结果
5. 通过 adapter 转成统一 step result

### AgentExecutorRegistry

新增 registry，例如：

- `backend/src/services/agentExecutorRegistry.js`

职责：

- 根据 `executor.type` 返回具体 executor
- 将 workflow 层与具体实现解耦

示例映射：

```js
{
  CLAUDE_CODE: new ClaudeCodeExecutor(),
  CODEX: new CodexExecutor(),
  OPENCODE: new OpenCodeExecutor(),
}
```

### 统一 executor 接口

建议定义最小可用接口，例如：

```js
class AgentExecutor {
  async execute({ stepId, prompt, worktreePath, taskTitle, taskDescription, previousSummary, executorConfig, onSpawn }) {}
}
```

返回统一的“原生执行结果壳”，例如：

```js
{
  exitCode,
  stdout,
  stderr,
  rawResult,
  metadata,
  proc,
}
```

这里的 `rawResult` 允许不同 executor 不同结构。

## 原生输出与适配层

由于本次选择的是“保留各 executor 原生输出，再在适配层统一转换”，所以需要单独的适配层。

### StepResultAdapter

建议新增：

- `backend/src/services/stepResultAdapter.js`

职责：

- 接收 `executorType + raw execution result`
- 将不同 executor 输出统一转换为：

```json
{
  "changedFiles": ["..."],
  "summary": "..."
}
```

### 适配方式

#### ClaudeCode

第一版可以继续兼容当前 `.kanban/step-result.json` 与 `__STEP_RESULT__...` 约定。

#### Codex / OpenCode

第一版可以允许它们：

- 输出自己的 JSON
- 或写自己的结果文件
- 然后由各自适配器转换成统一 step result

重点是：**workflow 上层不依赖任何单一 executor 的输出协议。**

## Prompt 与命令构造策略

### Prompt 责任划分

prompt 构造与 executor 执行是两个不同问题。

建议：

- step 业务输入仍由统一 prompt builder 产出 step 任务意图
- executor 可以在内部补充自己的协议要求

这样可以做到：

- workflow 负责“要做什么”
- executor 负责“如何让对应 CLI 正确执行”

### 命令构造抽象

建议把命令构造从 `claudeStepRunner.js` 中抽出来，形成统一的 command resolver / builder。

第一版不必完全复制 vibe-kanban 的 `CommandBuilder`，但至少应支持：

- 默认命令入口
- `commandOverride`
- 追加 `args`
- 追加 `env`
- 返回最终 `command + args + env`

### Claude 的默认命令策略

结合当前本地 `claude.rs` 参考，Claude 默认入口不应继续依赖裸 `claude`，建议对齐为：

```text
npx -y @anthropic-ai/claude-code@<version>
```

并避免依赖 `shell: true`。原因：

1. 裸 `claude` 已在 Windows 环境中暴露 `ENOENT` 风险。
2. `shell: true` 下多行 prompt 存在命令解析/截断风险。
3. 将默认命令表达为基础命令字符串 + 参数数组，更容易做 override。

## 对现有后端的改动建议

### 1. `backend/src/workflows/index.js`

保留当前固定 4 个 step 定义，但将：

- `executeClaudeWorkflowStep(...)`

替换为更通用的：

- `executeWorkflowStep(...)`

step 本身仍固定，执行器不再写死。

### 2. `backend/src/services/workflowStepExecutor.js`

从 Claude 专用入口升级为通用入口：

- 根据 `stepId` 读取模板配置
- 路由到具体 executor
- 调用 adapter 输出统一结果

### 3. `backend/src/services/claudeStepRunner.js`

不再代表“整个 workflow 的 runner”，而是下沉为 Claude executor 的内部实现，建议逐步迁移为：

- `backend/src/services/executors/claudeCodeExecutor.js`

若希望平滑迁移，第一版可暂时保留原文件并在新 executor 中复用。

### 4. 新增执行器目录

建议新增：

```text
backend/src/services/executors/
  baseExecutor.js
  claudeCodeExecutor.js
  codexExecutor.js
  opencodeExecutor.js
  commandResolver.js
```

### 5. 新增模板配置层

建议新增：

```text
backend/src/repositories/workflowTemplateRepository.js
backend/src/services/workflowTemplateService.js
backend/src/routes/workflowTemplate.js
```

职责分别为：

- repository：JSON 文件读写
- service：模板校验、默认值填充、更新规则
- route：暴露读取/更新模板的 API

## API 设计建议

第一版只需要很小的 API 面：

### 查询全局模板

```http
GET /api/workflow-template
```

返回当前 global 模板配置。

### 更新全局模板

```http
PUT /api/workflow-template
```

允许更新：

- 某个 step 的 executor 类型
- 某个 step 的 commandOverride / args / env

### 为什么不做更细的 PATCH 接口

第一版模板结构固定、字段有限，直接 `PUT` 整个模板更简单：

- 后端验证逻辑更集中
- 前端保存逻辑更直接
- JSON 存储也更自然

## 校验规则

模板更新时应至少校验：

1. `template_id` 必须为当前受支持模板 ID（第一版固定 `dev-workflow-v1`）
2. `steps` 必须刚好覆盖固定的 4 个 step id
3. step 顺序可以选择保留固定顺序，避免不必要变化
4. `executor.type` 必须属于支持集合
5. `commandOverride` 若存在必须为非空字符串
6. `args` 必须为字符串数组
7. `env` 必须为键值都为字符串的对象

## 迁移方案

### 初始迁移

第一版启动时，如果 `data/workflow_template.json` 不存在，则自动写入默认模板：

- 4 个 step 全部默认 `CLAUDE_CODE`

这样可以做到：

- 对现有工作流行为基本无感
- 在未修改配置前，行为与当前系统接近
- 后续只需调整全局模板即可切换某个 step 的 executor

### 与现有 workflowRun 的关系

workflow run 仍然记录：

- `workflow_id`
- 当前 step 状态
- output / error

第一版不强制把 executor 配置快照写入 run，但建议预留扩展位，后续可以考虑把每个 run 的解析后模板快照落入 `context`，便于审计和回放。

## 测试方案

### 单元测试

#### 1. 模板 repository / service

验证：

- 默认模板初始化
- 读取模板
- 更新 step executor
- 非法 step id 拒绝
- 非法 executor type 拒绝

#### 2. workflowStepExecutor

验证：

- 根据 stepId 正确读取模板 executor
- 正确调用 registry
- 正确调用 adapter
- 不同 step 可路由到不同 executor

#### 3. command resolver

验证：

- 默认命令解析
- `commandOverride` 生效
- `args` 附加生效
- `env` 合并生效

#### 4. Claude executor

验证：

- 默认命令改为 `npx ... @anthropic-ai/claude-code...`
- 不再依赖裸 `claude`
- 不再依赖 `shell: true`
- 解析现有 step result 协议仍然正常

#### 5. StepResultAdapter

验证：

- Claude 原生输出 -> 统一 step result
- Codex / OpenCode 的 mock 原生输出 -> 统一 step result

### 集成测试

建议增加至少一条集成链路测试：

- 设置模板中 `requirement-design -> CLAUDE_CODE`
- workflow 启动后执行该 step
- 验证使用的是该 step 配置对应 executor

以及一条混合测试：

- step1 使用 Claude
- step2 使用 Codex mock executor
- 验证 workflow 按 step 配置逐步路由

## 风险与权衡

### 1. 当前 workflow 是固定模板，灵活性有限

这是有意为之。当前目标是先实现“固定 workflow 的 step executor 可配置”，而不是一次性做成通用流程编排器。

### 2. 不同 executor 的输出协议差异较大

因此必须保留 adapter 层。若直接强迫所有 executor 一开始完全复用 Claude 的输出协议，会让新 executor 接入成本变高。

### 3. Claude 启动方式需要独立修复

这次设计文档只定义方向：

- Claude 应迁移到统一 executor 抽象下
- 默认命令入口应与本地 `claude.rs` 参考保持一致
- 避免继续使用裸 `claude + shell: true`

实际落地时应通过测试先固定命令解析行为，再替换实现。

## 实施步骤建议

### Phase 1：模板配置层

1. 新增 `workflow_template.json`
2. 新增 repository/service/route
3. 写默认模板初始化与校验测试

### Phase 2：统一 executor 抽象层

1. 引入 `AgentExecutorRegistry`
2. 改造 `workflowStepExecutor.js`
3. 保持 workflow 4 个 step 不变，但改为通用执行入口

### Phase 3：Claude executor 迁移

1. 将现有 Claude runner 能力下沉到 `ClaudeCodeExecutor`
2. 抽出 command resolver
3. 调整默认命令策略

### Phase 4：占位支持其他 executor

1. 增加 `CodexExecutor` / `OpenCodeExecutor` 骨架
2. 先用 mock 原生输出 + adapter 打通流程
3. 后续逐步补真实 CLI 启动逻辑

## 结论

本方案的核心是：

- **workflow 模板仍固定**
- **step 数量和顺序不变**
- **增加一份 global 模板配置**
- **允许修改每个 step 绑定的 executor**
- **通过统一 executor 抽象层执行不同 agent CLI**
- **保留 executor 原生输出，在适配层转换成统一 step result**

这样既能满足当前“不同 step 可选不同 agent”的业务目标，又不会过早把系统推进到通用工作流编排器的复杂度。

后续如果需要扩展到多模板、项目级模板或更完整的 profile/variant 体系，也可以在当前设计上平滑演进，而不需要推翻重来。
