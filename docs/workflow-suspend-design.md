# 工作流暂停/确认功能实现设计文档

## 1. 需求概述

当前工作流执行是一直往下执行，中途不会暂停。需要实现一个能力：在某个步骤执行完成后暂停，等待用户确认后再继续执行下一个步骤。

## 2. Mastra 框架内置支持分析

Mastra 框架已经内置了 `suspend/resume` 机制，这正是我们需要的功能。

### 2.1 核心概念

**Step 定义关键属性：**

```typescript
createStep({
  id: 'step-id',
  inputSchema: z.object({ ... }),      // 输入数据 schema
  outputSchema: z.object({ ... }),     // 输出数据 schema
  resumeSchema: z.object({             // ⭐ 恢复时需要提供的数据
    approved: z.boolean(),
    comment: z.string().optional(),
  }),
  suspendSchema: z.object({            // ⭐ 暂停时返回的数据（给前端展示）
    reason: z.string(),
    stepName: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend, suspendData }) => {
    // resumeData: 恢复时用户提供的数据
    // suspendData: 首次暂停时存储的数据（恢复后可访问）
    
    if (!resumeData?.approved) {
      // 首次执行，暂停等待确认
      return await suspend({
        reason: '等待用户确认',
        stepName: '步骤1',
      });
    }
    
    // 用户已确认，继续执行
    return { output: '继续执行' };
  },
})
```

### 2.2 execute 执行流程详解（重要！）

**关键问题**：当步骤需要暂停时，用户确认后 `execute` 方法会再次执行，如何避免重复执行 `executeWorkflowStep`？

**答案**：使用 `suspendData` 参数。这是 Mastra 提供的关键机制。

#### 第一次执行（首次进入步骤）

```
resumeData = undefined/null
suspendData = undefined/null
↓
执行 executeWorkflowStep() → 得到 result
↓
检查 requiresConfirmation && !resumeData?.approved → true
↓
调用 suspend({ summary: result.summary, ... }) → 步骤暂停
↓
return（步骤暂停，等待用户确认）
```

#### 第二次执行（用户确认后恢复）

```
resumeData = { approved: true, comment: "..." }  ← 用户提供的数据
suspendData = { summary: "...", reason: "..." }  ← 第一次 suspend 时存入的数据
↓
检查 requiresConfirmation && !resumeData?.approved → false（因为 approved=true）
↓
从 suspendData 中取出之前的结果
↓
不会重复执行 executeWorkflowStep()！
↓
返回结果，继续下一步
```

**正确写法示例：**

```typescript
execute: async ({ inputData, resumeData, suspend, suspendData }) => {
  
  // ⭐ 第二次执行（恢复时）- 从 suspendData 获取之前的结果
  if (resumeData?.approved) {
    // 不再执行 executeWorkflowStep，直接从 suspendData 获取
    return { summary: suspendData?.summary || '已确认继续' };
  }
  
  // ⭐ 第一次执行 - 执行实际任务
  const result = await executeWorkflowStep({ ... });
  
  if (requiresConfirmation) {
    // 把结果存入 suspendData，下次恢复时可以取出来
    return await suspend({
      reason: '请确认此步骤',
      summary: result.summary,  // ← 存进去，恢复时可取出
    });
  }
  
  return result;
}
```

**核心要点**：
- `suspend()` 传入的数据会被 Mastra 持久化
- 恢复执行时，`suspendData` 参数包含之前存入的数据
- 通过判断 `resumeData` 是否有值来区分首次执行还是恢复执行

### 2.2 Workflow 执行状态

当步骤调用 `suspend()` 后，workflow run 的状态变为 `suspended`：

```typescript
const result = await run.start({ inputData: { ... } });

if (result.status === 'suspended') {
  // result.suspended 是被暂停的 step id 数组
  console.log('暂停的步骤:', result.suspended[0]);
}
```

### 2.3 恢复执行

```typescript
// 恢复暂停的 workflow
const result = await run.resume({
  step: 'step-id',           // 要恢复的步骤 id
  resumeData: {              // 满足 resumeSchema 的数据
    approved: true,
    comment: '确认继续',
  },
});
```

### 2.4 获取已存在的 Run

```typescript
// 通过 runId 获取已存在的 Run 实例
const run = await workflow.createRun({ runId: prevRunId });
```

## 3. 当前代码架构分析

### 3.1 数据模型

**WorkflowTemplateStepEntity（当前）：**
```typescript
interface WorkflowTemplateStepEntity {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number;
}
```

**WorkflowRunEntity（当前）：**
```typescript
interface WorkflowRunEntity {
  id: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  current_step: string | null;
  steps: WorkflowStepEntity[];
  // ...
}
```

**WorkflowStepEntity（当前）：**
```typescript
interface WorkflowStepEntity {
  step_id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  started_at: string | null;
  completed_at: string | null;
  // ...
}
```

### 3.2 核心执行流程

```
WorkflowService.startWorkflow()
  ↓
WorkflowService._executeWorkflow()
  ↓
buildWorkflowFromTemplate()  →  构建 Mastra workflow
  ↓
workflow.createRun()  →  创建 Mastra run
  ↓
mastraRun.startAsync()  →  异步执行
  ↓
Step execute callback
  ↓
WorkflowLifecycle.onStepStart()  →  创建 session/segment
  ↓
executeWorkflowStep()  →  执行 AI agent
  ↓
WorkflowLifecycle.onStepComplete()  →  更新步骤状态
```

### 3.3 关键文件

| 文件 | 作用 |
|------|------|
| `workflows.ts` | 构建 Mastra workflow，使用 `createStep` |
| `workflowService.ts` | 启动/取消/重试 workflow，管理 run |
| `workflowLifecycle.ts` | 步骤生命周期回调（start/complete/error） |
| `workflowRunRepository.ts` | WorkflowRun 数据持久化 |
| `workflowTemplateService.ts` | 模板管理，步骤配置 |
| `routes/workflows.ts` | API 端点 |

## 4. 实现方案设计

### 4.1 数据模型扩展

#### 4.1.1 WorkflowTemplateStepEntity 扩展

```typescript
interface WorkflowTemplateStepEntity {
  id: string;
  name: string;
  instructionPrompt: string;
  agentId: number;
  // ⭐ 新增字段
  requiresConfirmation?: boolean;      // 是否需要用户确认
}
```

#### 4.1.2 WorkflowRunEntity 状态扩展

只需要扩展 `status`，不需要额外字段（因为暂停信息可以从 steps 中获取）：

```typescript
interface WorkflowRunEntity {
  // 现有字段...
  status: 'PENDING' | 'RUNNING' | 'SUSPENDED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  // 不需要 suspended_step 和 suspend_data
  // 获取暂停步骤：run.steps.find(s => s.status === 'SUSPENDED')
}
```

#### 4.1.3 WorkflowStepEntity 状态扩展

```typescript
interface WorkflowStepEntity {
  // 现有字段...
  status: 'PENDING' | 'RUNNING' | 'SUSPENDED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  // ⭐ 新增
  suspend_reason?: string | null;      // 暂停原因（给前端展示）
  confirmation_note?: string | null;   // 用户确认时的备注
  confirmed_at?: string | null;        // 确认时间
}
```

**注意**：`summary` 字段已存在，暂停时的执行摘要可以直接用它存储。

### 4.2 workflows.ts 改造

需要改造 `buildWorkflowFromTemplate` 函数，为需要确认的步骤添加 `suspendSchema` 和 `resumeSchema`。

**关键点**：使用 `suspendData` 保存第一次执行的结果，避免恢复时重复执行。

```typescript
export function buildWorkflowFromTemplate(
  workflowTemplate: WorkflowTemplateEntity,
  options: BuildWorkflowOptions,
) {
  const steps = workflowTemplate.steps.map((templateStep, index) => {
    const requiresConfirmation = templateStep.requiresConfirmation ?? false;

    // ⭐ 定义 resume schema（用户恢复时需要提供的数据）
    const resumeSchema = requiresConfirmation
      ? z.object({
          approved: z.boolean(),
          comment: z.string().optional(),
        })
      : undefined;

    // ⭐ 定义 suspend schema（暂停时返回给前端的数据）
    const suspendSchema = requiresConfirmation
      ? z.object({
          reason: z.string(),
          stepName: z.string(),
          summary: z.string().optional(),
        })
      : undefined;

    return createStep({
      id: templateStep.id,
      inputSchema: isFirst ? firstStepInputSchema : stepOutputSchema,
      outputSchema: stepOutputSchema,
      stateSchema: sharedStateSchema,
      // ⭐ 新增
      resumeSchema,
      suspendSchema,
      execute: async ({ inputData, state, abortSignal, resumeData, suspend, suspendData }) => {
        // ⭐⭐⭐ 关键逻辑：区分首次执行 vs 恢复执行
        
        // === 恢复执行（用户已确认）===
        if (resumeData?.approved) {
          // 从 suspendData 获取之前的结果，不会重复执行 executeWorkflowStep
          const previousSummary = suspendData?.summary || '';
          
          await options.lifecycle.onStepResume(options.runId, templateStep.id, resumeData);
          await options.lifecycle.onStepComplete(options.runId, templateStep.id, { summary: previousSummary });
          
          return { summary: previousSummary };
        }
        
        // === 首次执行 ===
        let sessionId: number | undefined;
        let segmentId: number | undefined;
        const sessionInfo = await options.lifecycle.onStepStart(options.runId, templateStep.id, options.task);
        if (!sessionInfo) {
          throw new Error('session created error');
        }
        sessionId = sessionInfo.sessionId;
        segmentId = sessionInfo.segmentId;

        try {
          // 执行 AI agent
          const result = await executeWorkflowStep({
            stepId: templateStep.id,
            worktreePath: state.worktreePath,
            state,
            inputData,
            workflowTemplate,
            abortSignal,
            upstreamStepIds: previousStepId ? [previousStepId] : [],
            onEvent: async (event) => {
              await options?.lifecycle.sessionEventRepo.append({
                session_id: sessionId,
                segment_id: segmentId,
                kind: event.kind,
                role: event.role,
                content: event.content,
                payload: event.payload || {},
              });
            },
            onProviderState: async (providerState) => {
              if (segmentId && options?.lifecycle.sessionSegmentRepo && providerState.providerSessionId) {
                await options.lifecycle.sessionSegmentRepo.update(segmentId, {
                  provider_session_id: providerState.providerSessionId,
                });
              }
            },
          });

          if (abortSignal?.aborted) {
            abort();
            return { summary: '' };
          }

          // ⭐ 检查是否需要确认
          if (requiresConfirmation) {
            // 步骤执行完成，但需要用户确认
            await options.lifecycle.onStepSuspend(options.runId, templateStep.id, {
              reason: `请确认步骤 "${templateStep.name}" 是否完成`,
              stepName: templateStep.name,
              summary: result.summary,
            });
            
            // ⭐ 调用 Mastra suspend，把结果存入 suspendData
            return await suspend({
              reason: `请确认步骤 "${templateStep.name}" 是否完成`,
              stepName: templateStep.name,
              summary: result.summary,  // ← 存入，恢复时可通过 suspendData 获取
            });
          }

          // 不需要确认，直接完成
          await options.lifecycle.onStepComplete(options.runId, templateStep.id, result);
          return result;

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await options.lifecycle.onStepError(options.runId, templateStep.id, errorMessage);
          throw err;
        }
      },
    });
  });
  // ... workflow 构建逻辑
}
```

**执行流程总结**：

| 场景 | resumeData | suspendData | 动作 |
|------|------------|-------------|------|
| 首次执行（需确认） | null | null | 执行 executeWorkflowStep → suspend() |
| 恢复执行（已确认） | { approved: true } | { summary: "..." } | 从 suspendData 取结果，跳过执行 |
| 首次执行（不需确认） | null | null | 执行 executeWorkflowStep → 直接返回 |
```

### 4.3 WorkflowLifecycle 扩展

新增 `onStepSuspend` 和 `onStepResume` 方法：

```typescript
class WorkflowLifecycle {
  // ... 现有方法

  // ⭐ 新增：步骤暂停时调用
  async onStepSuspend(
    runId: number,
    stepId: string,
    suspendInfo: { reason: string; summary?: string }
  ) {
    const completedAt = new Date().toISOString();
    
    // 1. 更新步骤状态为 SUSPENDED，存储暂停原因和执行摘要
    await this.workflowRunRepo.updateStep(runId, stepId, {
      status: 'SUSPENDED',
      completed_at: completedAt,
      suspend_reason: suspendInfo.reason,
      summary: suspendInfo.summary || null,  // 执行摘要
    });

    // 2. 更新 workflow run 状态为 SUSPENDED
    await this.workflowRunRepo.update(runId, {
      status: 'SUSPENDED',
      current_step: stepId,
    });

    // 3. Session 状态更新
    const { step } = await this._getRunStep(runId, stepId);
    if (step.session_id) {
      await this.sessionRepo.update(step.session_id, {
        status: 'SUSPENDED',
        completed_at: completedAt,
      });
      
      const latestSegment = await this.sessionSegmentRepo.findLatestBySessionId(step.session_id);
      if (latestSegment?.status === 'RUNNING') {
        await this.sessionSegmentRepo.update(latestSegment.id, {
          status: 'SUSPENDED',
          completed_at: completedAt,
        });
      }
    }

    this._clearStepAttemptSegmentId(runId, stepId);
  }

  // ⭐ 新增：恢复时调用（在 execute 中判断 resumeData 后调用）
  async onStepResume(runId: number, stepId: string, resumeData: { approved: boolean; comment?: string }) {
    // 更新步骤的确认信息
    await this.workflowRunRepo.updateStep(runId, stepId, {
      confirmation_note: resumeData.comment || null,
      confirmed_at: new Date().toISOString(),
    });

    // 更新 workflow run 状态
    await this.workflowRunRepo.update(runId, {
      status: 'RUNNING',
    });
  }
}
```
```

### 4.4 WorkflowService 扩展

新增 `resumeWorkflow` 方法：

```typescript
class WorkflowService {
  // ... 现有方法

  // ⭐ 新增
  async resumeWorkflow(
    runId: number,
    resumeData: { approved: boolean; comment?: string }
  ) {
    const run = await this.workflowRunRepo.findById(runId);
    if (!run) {
      throw notFoundError('Workflow run not found');
    }

    if (run.status !== 'SUSPENDED') {
      throw validationError('Cannot resume a workflow that is not suspended');
    }

    // 从 steps 中找到暂停的步骤
    const suspendedStep = run.steps.find(s => s.status === 'SUSPENDED');
    if (!suspendedStep) {
      throw validationError('No suspended step found');
    }

    const template = run.workflow_template_snapshot;
    if (!template) {
      throw validationError('Workflow template snapshot not found');
    }

    const mastraRunId = run.mastra_run_id;
    if (!mastraRunId) {
      throw validationError('Mastra run ID not found');
    }

    // 获取已注册的 workflow
    const workflow = getWorkflowFromWorkflowId(template.template_id);
    if (!workflow) {
      throw validationError('Workflow not registered');
    }

    // ⭐ 获取已存在的 Run 实例
    const mastraRun = await workflow.createRun({ runId: mastraRunId });

    // 通知 lifecycle
    await this.lifecycle.onStepResume(runId, suspendedStep.step_id, resumeData);

    // ⭐ 调用 Mastra resume（异步执行）
    mastraRun.resume({
      step: suspendedStep.step_id,
      resumeData,
    }).then((result) => {
      console.log(`[Workflow] Resume result: ${result.status}`);
    }).catch((err) => {
      console.error(`[Workflow] Resume error:`, err);
      this.lifecycle.onWorkflowError(runId, err.message);
    });

    return await this.workflowRunRepo.findById(runId);
  }
}
```
```

### 4.5 API 端点扩展

`routes/workflows.ts` 新增端点：

```typescript
// ⭐ 新增：恢复暂停的工作流
fastify.post<{ Params: IdParams; Body: ResumeWorkflowBody }>(
  '/runs/:id/resume',
  async (request, reply) => {
    try {
      const { approved, comment } = request.body || {};
      const run = await workflowService.resumeWorkflow(
        parseNumber(request.params.id),
        { approved: Boolean(approved), comment }
      );
      return successResponse(run, 'Workflow resumed');
    } catch (error) {
      // ...
    }
  }
);

// ⭐ 新增：获取暂停信息（从 steps 中获取）
fastify.get<{ Params: IdParams }>(
  '/runs/:id/suspend-info',
  async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run || run.status !== 'SUSPENDED') {
        return successResponse(null);
      }
      
      // 从 steps 中找到暂停的步骤
      const suspendedStep = run.steps.find(s => s.status === 'SUSPENDED');
      
      return successResponse({
        step_id: suspendedStep?.step_id,
        step_name: suspendedStep?.name,
        reason: suspendedStep?.suspend_reason,
        summary: suspendedStep?.summary,
      });
    } catch (error) {
      // ...
    }
  }
);
```

### 4.6 onFinish 回调处理

需要处理 `suspended` 状态：

```typescript
createWorkflow({
  // ...
  options: {
    onFinish: async (result) => {
      if (result.status === 'success') {
        await options.lifecycle.onWorkflowComplete(options.runId, result.result ?? {});
      } else if (result.status === 'suspended') {
        // ⭐ Mastra 已经处理了 suspend，lifecycle 在 step execute 中已调用
        console.log(`[Workflow] Suspended at steps: ${result.suspended}`);
      } else if (result.status === 'failed') {
        await options.lifecycle.onWorkflowError(options.runId, result.error?.message || 'Workflow failed');
      }
    },
  },
});
```

## 5. 前端交互流程

### 5.1 执行流程

```
1. 用户启动工作流
   POST /api/workflows/run { task_id, workflow_template_id }
   
2. 前端轮询或监听 WebSocket 获取状态
   GET /api/workflows/runs/:id
   
3. 当 status === 'SUSPENDED' 时
   - 找到暂停的步骤：run.steps.find(s => s.status === 'SUSPENDED')
   - 显示确认对话框，展示 step.suspend_reason 和 step.summary
   
4. 用户点击"确认继续"或"取消"
   POST /api/workflows/runs/:id/resume { approved: true/false, comment: "..." }
   
5. 工作流继续执行
```

### 5.2 WebSocket 通知

建议通过 WebSocket 推送 `suspended` 状态变化：

```typescript
// 当 workflow 状态变为 SUSPENDED 时推送消息
{
  type: 'workflow_suspended',
  runId: number,
  stepId: string,      // 从 steps 中获取
  reason: string,      // step.suspend_reason
  summary: string,     // step.summary
}
```

## 6. 模板配置示例

用户创建模板时可以指定哪些步骤需要确认：

```json
{
  "template_id": "dev-workflow",
  "name": "开发流程",
  "steps": [
    {
      "id": "step-1",
      "name": "需求分析",
      "instructionPrompt": "分析需求文档...",
      "agentId": 1,
      "requiresConfirmation": false
    },
    {
      "id": "step-2",
      "name": "代码实现",
      "instructionPrompt": "实现功能...",
      "agentId": 2,
      "requiresConfirmation": true
    },
    {
      "id": "step-3",
      "name": "测试验证",
      "instructionPrompt": "执行测试...",
      "agentId": 3,
      "requiresConfirmation": true
    }
  ]
}
```

## 7. 关键注意事项

### 7.1 resumeSchema 和 suspendSchema 类型定义

- `resumeSchema` 定义了用户恢复时需要提供的数据结构
- `suspendSchema` 定义了暂停时返回给前端展示的数据结构
- 只有需要确认的步骤才需要定义这两个 schema

### 7.2 suspendData 机制（核心！）

**最重要的一点**：用户确认后 `execute` 方法会再次执行，必须使用 `suspendData` 保存第一次执行的结果。

```typescript
// ❌ 错误写法：会导致重复执行
execute: async ({ resumeData, suspend }) => {
  const result = await executeWorkflowStep();  // 恢复时也会执行！
  if (requiresConfirmation && !resumeData?.approved) {
    return await suspend({ ... });
  }
  return result;
}

// ✅ 正确写法：先判断 resumeData，避免重复执行
execute: async ({ resumeData, suspend, suspendData }) => {
  if (resumeData?.approved) {
    return { summary: suspendData?.summary };  // 从 suspendData 取结果
  }
  const result = await executeWorkflowStep();  // 只在首次执行
  return await suspend({ summary: result.summary });
}
```

### 7.3 暂停时机

暂停发生在步骤执行**完成后**，而不是执行前：
1. AI agent 执行步骤任务
2. 步骤完成，产生 summary
3. 如果需要确认 → 暂停，等待用户
4. 用户确认 → 继续下一个步骤

### 7.4 状态一致性

- `WorkflowRunEntity.status` 需要新增 `SUSPENDED`
- `WorkflowStepEntity.status` 需要新增 `SUSPENDED`
- `SessionEntity.status` 需要新增 `SUSPENDED`（可选）
- Mastra 内部状态 `result.status === 'suspended'` 保持同步

### 7.5 取消 vs 拒绝确认

两种场景：
- **取消工作流**：用户点击取消按钮，调用 `/runs/:id/cancel`
- **拒绝确认**：用户在恢复时 `approved: false`，可以选择继续执行还是终止

建议：`approved: false` 时可以调用 `bail()` 终止工作流，或者让用户选择。

### 7.6 多步骤暂停

如果多个步骤都被暂停，`result.suspended` 是数组，需要前端逐个处理或批量处理。

## 8. 改动文件清单

| 文件 | 改动内容 |
|------|----------|
| `types/entities.ts` | 扩展 WorkflowRunEntity, WorkflowStepEntity 状态 |
| `types/dto/workflowTemplates.ts` | 扩展 WorkflowTemplateStepInput |
| `services/workflow/workflows.ts` | 添加 resumeSchema/suspendSchema，处理 suspend 调用 |
| `services/workflow/workflowLifecycle.ts` | 新增 onStepSuspend, onStepResume 方法 |
| `services/workflow/workflowService.ts` | 新增 resumeWorkflow 方法 |
| `services/workflow/workflowTemplateService.ts` | 处理 requiresConfirmation 字段 |
| `repositories/workflowRunRepository.ts` | 可能需要扩展 update 方法 |
| `routes/workflows.ts` | 新增 /runs/:id/resume, /runs/:id/suspend-info 端点 |
| `types/dto/workflows.ts` | 新增 ResumeWorkflowBody DTO |

## 9. 实现优先级建议

1. **Phase 1 - 核心能力**
   - 数据模型扩展
   - workflows.ts 改造（suspend/resume）
   - WorkflowLifecycle 扩展
   - WorkflowService.resumeWorkflow
   - API 端点

2. **Phase 2 - 前端集成**
   - 前端暂停状态 UI
   - 确认对话框
   - WebSocket 通知

3. **Phase 3 - 增强**
   - 模板配置 UI
   - 多步骤暂停处理
   - 拒绝确认流程优化