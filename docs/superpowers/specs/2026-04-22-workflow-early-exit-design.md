# AI 控制的工作流提前终止 - 设计文档

## Context

当前工作流是严格线性执行的：Step 1 → Step 2 → Step 3。但在某些场景下（如漏洞修复），AI 可能在中间步骤就完成了目标，后续步骤不需要执行。本功能让 AI 在执行过程中自动判断是否可以提前终止工作流，节省时间和资源。

## 架构

### 数据模型变更

**`backend/src/types/entities.ts`**

`WorkflowStepEntity` 新增字段：
```typescript
early_exit: boolean | null;
early_exit_reason: string | null;
```

`WorkflowTemplateStepEntity` 新增字段：
```typescript
canEarlyExit?: boolean;  // 此步骤是否允许 AI 触发提前终止
```

### Prompt 装配 + 精简

**`backend/src/services/workflow/workflowPromptAssembler.ts`**

Prompt 精简：
- `formatRepoAnalysisContext()` 只在第一步返回（通过 `isFirstStep` 参数控制），后续步骤不再重复 KANBAN_COMPASS 提示
- 移除 `normalizeSummaryText()` 的硬截断逻辑（当前 1200 字符限制），信任 AI 输出的 summary，只做 collapse code blocks + 合并空行

上游摘要超长处理（> 1000 字符阈值）：
- 将超长摘要写入工作树的 `.kanban/summaries/{stepId}.md` 文件
- Prompt 中该步骤的摘要替换为：`上游步骤摘要较长，已保存至 .kanban/summaries/{stepId}.md，请读取该文件。`
- 不超过 1000 字符的摘要直接内联到 prompt 中（原有逻辑不变）

Early exit 指令：
- 当 `WorkflowTemplateStepEntity.canEarlyExit === true` 时，在步骤 prompt 末尾追加：
  ```
  如果认为目标已达成或无法继续，请在总结末尾以 JSON 格式输出：
  {"decision": "SUCCESS_EXIT", "reason": "..."}  或
  {"decision": "FAIL_EXIT", "reason": "..."}  或
  {"decision": "CONTINUE"}
  ```
- 只有配置了 canEarlyExit 的步骤才追加

### 结果解析

**`backend/src/services/workflow/stepResultAdapter.ts`**

- `validateStepResult()` 解析 summary 末尾的 JSON 信号
- 提取 `decision`、`reason`，从 summary 中移除 JSON 部分保持 clean
- 返回：`{ summary, decision: 'CONTINUE'|'SUCCESS_EXIT'|'FAIL_EXIT', exitReason }`

### 步骤执行控制

**`backend/src/services/workflow/workflows.ts`**

在 step execute handler 中，`onStepComplete` 之后检查 decision：

- `CONTINUE` → 正常继续 `.then(nextStep)`
- `SUCCESS_EXIT` → 剩余 PENDING 步骤标记 CANCELLED，工作流标记 COMPLETED，task 标记 DONE
- `FAIL_EXIT` → 剩余 PENDING 步骤标记 CANCELLED，工作流标记 FAILED，task 标记 TODO

### 前端展示

- `WorkflowTimeline.vue`：CANCELLED 步骤显示跳过原因
- `InlineWorkflowPanel.vue`：显示 "AI 决定停止：XXX"
- `SessionEventRenderer.vue`：在事件流中插入决策通知

## 关键文件

| 文件 | 变更 |
|------|------|
| `backend/src/types/entities.ts` | WorkflowStepEntity + WorkflowTemplateStepEntity 新增字段 |
| `backend/src/services/workflow/workflowPromptAssembler.ts` | 追加 early exit 指令 |
| `backend/src/services/workflow/stepResultAdapter.ts` | 解析 decision 信号 |
| `backend/src/services/workflow/workflows.ts` | 根据 decision 控制流程走向 |
| `backend/src/services/workflow/workflowLifecycle.ts` | 新增 earlyExit 生命周期回调 |
| `frontend/src/components/WorkflowTimeline.vue` | 展示跳过的步骤和原因 |
| `frontend/src/components/InlineWorkflowPanel.vue` | 展示跳过原因 |
| `frontend/src/components/SessionEventRenderer.vue` | 渲染决策通知 |

## 验证

1. 创建一个多步骤工作流模板，其中第二步设 `canEarlyExit: true`
2. 启动工作流，让 AI 在第二步输出 `{"decision": "SUCCESS_EXIT", "reason": "漏洞已修复"}`
3. 验证：第三步被跳过（CANCELLED），工作流 COMPLETED，前端显示跳过原因
4. 测试 FAIL_EXIT 路径：工作流 FAILED，task 回退到 TODO
5. 测试 CONTINUE 路径：正常继续下一步
