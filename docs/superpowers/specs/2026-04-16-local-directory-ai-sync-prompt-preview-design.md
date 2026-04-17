# Local Directory AI Sync Prompt Preview Design

## Context

LOCAL_DIRECTORY 任务源的 AI 描述模式当前流程是：点击同步 → 后台直接执行 AI 分析 → 异步创建任务。用户无法在执行前预览 prompt，也无法在任务创建前审阅或编辑 AI 生成的结果。

**目标**：手动同步时，增加两步预览确认——先预览 prompt，再预览 AI 结果，确认后才创建任务。自动同步不受影响。

## Scope

- **包含**：LOCAL_DIRECTORY AI 模式的手动同步预览
- **不包含**：非 AI 模式、其他任务源类型、自动同步流程

## Architecture

### Flow Overview

```
用户点击"同步" (AI模式)
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│ Step 1: Prompt 预览（不执行 AI）                         │
│ POST /:id/sync/preview-prompt                           │
│ → 扫描文件 + 构建 prompt                                │
│ ← { prompt, files }                                     │
│ 用户：确认执行 / 取消                                    │
└─────────────────────────────────────────────────────────┘
  │ 确认
  ▼
┌─────────────────────────────────────────────────────────┐
│ Step 2: AI 结果预览（执行 AI，不创建任务）                │
│ POST /:id/sync/preview-results                          │
│ → 创建 session (status: PENDING_REVIEW)                 │
│ → 执行 AI 分析                                          │
│ → 结果存入 session.metadata.aiResults                   │
│ ← { sessionId, results: [{filename, title, description}]│
│ 用户：编辑标题/描述、勾选要导入的任务、确认导入/取消       │
└─────────────────────────────────────────────────────────┘
  │ 确认导入
  ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: 确认创建任务                                     │
│ POST /:id/sync/confirm                                  │
│ Body: { sessionId, items: [...] }                       │
│ → 读取 session.metadata.aiResults                       │
│ → 仅创建用户勾选的任务                                   │
│ → session 状态改为 COMPLETED                            │
└─────────────────────────────────────────────────────────┘
```

### 自动同步不受影响

```
scheduler → taskSourceService.sync() → 直接创建任务（不走预览）
```

`schedulerService.sync()` 调用的是 `taskSourceService.sync()`（不是 `syncWithSession`），不涉及任何 session 或 AI 分析，直接走 `adapter.fetch()` 创建任务。

## API Design

### POST `/api/task-sources/:id/sync/preview-prompt`

构建 AI prompt 但不执行。

**Request**: 无 body（可选 `{ files: [...] }` 指定文件子集）

**Response**:
```json
{
  "success": true,
  "data": {
    "prompt": "分析以下文件内容，为每个文件生成任务标题和描述...",
    "files": [
      { "filename": "task1.txt", "filepath": "/path/to/task1.txt", "size": 1024, "modified": "..." },
      { "filename": "task2.txt", "filepath": "/path/to/task2.txt", "size": 2048, "modified": "..." }
    ],
    "fileCount": 2
  }
}
```

**逻辑**：
1. 获取任务源，确认是 LOCAL_DIRECTORY + AI 模式
2. 调用 `adapter._scanFiles()` 扫描文件
3. 去重：过滤已导入的文件（`findByExternalIdAndProject`）
4. 构建 prompt（复用 `localDirectoryAdapter.ts` 中的 prompt 构建逻辑）
5. 返回 prompt + 文件列表（不创建 session，不调用 AI）

### POST `/api/task-sources/:id/sync/preview-results`

执行 AI 分析但不创建任务。

**Request**: 无 body

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": 42,
    "results": [
      { "filename": "task1.txt", "title": "处理 task1 文件", "description": "该文件包含..." },
      { "filename": "task2.txt", "title": "处理 task2 文件", "description": "该文件包含..." }
    ]
  }
}
```

**逻辑**：
1. 获取任务源
2. 扫描文件 + 去重
3. 创建 session（status: `PENDING_REVIEW`）
4. 调用 `adapter.fetchWithAiDescriptions(sessionId, newFiles)` 执行 AI
5. AI 结果存入 `session.metadata.aiResults`
6. 返回 sessionId + 结果列表

### POST `/api/task-sources/:id/sync/confirm`

用户确认后创建任务。

**Request**:
```json
{
  "sessionId": 42,
  "items": [
    { "externalId": "task1.txt", "title": "处理 task1 文件", "description": "修改后的描述" }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": { "created": 1, "skipped": 0 }
}
```

**逻辑**：
1. 通过 sessionId 找到 session，确认状态为 `PENDING_REVIEW`
2. 对 items 中的每一项，`externalId` 映射到 `external_id`，创建或更新 task
3. session 状态改为 `COMPLETED`

## Backend Changes

### `localDirectoryAdapter.ts`

- 新增 `buildAiPrompt(files: FileInfo[]): Promise<string>` 方法：将现有的 prompt 构建逻辑提取为独立公开方法
- `fetchWithAiDescriptions` 保持不变，内部调用 `buildAiPrompt`

### `taskSourceService.ts`

- 新增 `previewSyncPrompt(sourceId)`: 调用 adapter 的 `buildAiPrompt`，返回 prompt + 文件列表
- 新增 `previewSyncResults(sourceId)`: 创建 session + 执行 AI + 存结果到 metadata，不创建任务
- 新增 `confirmSync(sourceId, sessionId, items)`: 根据确认的 items 创建任务
- 现有 `syncWithSession` 保持不变（保留原有自动同步路径）

### `routes/taskSources.ts`

- 新增 `POST /:id/sync/preview-prompt` 路由
- 新增 `POST /:id/sync/preview-results` 路由
- 新增 `POST /:id/sync/confirm` 路由
- 现有 `POST /:id/sync` 保持不变

### `SessionEntity` (types/entities.ts)

- 新增 `metadata?: Record<string, unknown>` 字段
- 新增状态 `PENDING_REVIEW`（AI 结果已生成，等待用户确认）

### `schema.sql`

- sessions 表新增 `metadata TEXT` 列
- 迁移系统自动 `ALTER TABLE sessions ADD COLUMN "metadata" TEXT DEFAULT ''`

## Frontend Changes

### `TaskSourcePanel.vue`

**`handleSync` 改造**：
```javascript
const handleSync = async (source) => {
  const isLocalAiMode = source.type === 'LOCAL_DIRECTORY' && source.config?.descriptionMode === 'ai'
  if (isLocalAiMode) {
    await previewPromptAndSync(source) // 新的 3 步流程
  } else {
    await previewAndSync(source) // 现有的非 AI 预览流程
  }
}
```

**新增步骤化对话框**：复用现有的 BaseDialog，新增一个 2-step dialog：

```
┌────────────────────────────────────────┐
│ 同步预览 - 步骤 1/2: Prompt            │
│ ┌────────────────────────────────────┐ │
│ │ <pre>显示完整 prompt 文本</pre>     │ │
│ │ 文件列表 (2个文件将被分析):         │ │
│ │   ☑ task1.txt (1.2 KB)            │ │
│ │   ☑ task2.txt (2.4 KB)            │ │
│ │                                    │ │
│ │ [取消] [确认执行]                  │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
         ↓ 点击"确认执行"
┌────────────────────────────────────────┐
│ 同步预览 - 步骤 2/2: AI 结果           │
│ ┌────────────────────────────────────┐ │
│ │ ☑ task1.txt                       │ │
│ │   标题: [可编辑 input]             │ │
│ │   描述: [可编辑 textarea]          │ │
│ │                                    │ │
│ │ ☐ task2.txt                       │ │
│ │   标题: [可编辑 input]             │ │
│ │   描述: [可编辑 textarea]          │ │
│ │                                    │ │
│ │ [取消] [确认导入(1)]               │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### `taskSourceStore.js`

新增状态：
- `previewDialogStep`: 当前步骤（'prompt' | 'results' | null）
- `previewPrompt`: prompt 文本
- `previewFiles`: 文件列表
- `previewResults`: AI 生成的结果列表
- `previewSessionId`: session ID
- `selectedPreviewItems`: 勾选要导入的 items

新增方法：
- `openPreviewPrompt(sourceId)`: 调用 preview-prompt API
- `executePreviewResults(sourceId)`: 调用 preview-results API
- `confirmSyncImport(sourceId, projectId)`: 调用 confirm API

### `api/taskSource.js`

新增 API 函数：
- `previewPrompt(id)`: POST `/:id/sync/preview-prompt`
- `previewResults(id)`: POST `/:id/sync/preview-results`
- `confirmSync(id, body)`: POST `/:id/sync/confirm`

## Error Handling

| 场景 | 处理 |
|------|------|
| 没有新文件 | toast "没有新文件"，不打开预览对话框 |
| AI 分析失败 | toast "AI 分析失败，已使用默认描述"，进入步骤 2 显示 fallback 结果 |
| session 过期/不存在 | 提示"会话已过期，请重新同步" |
| 用户取消 prompt 预览 | 关闭对话框，无任何副作用 |
| 用户取消结果预览 | session 保持 PENDING_REVIEW，下次可继续或丢弃 |

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/types/entities.ts` | SessionEntity 新增 metadata 字段 |
| `backend/src/repositories/sessionRepository.ts` | 确保 metadata 解析正确 |
| `backend/src/sources/localDirectoryAdapter.ts` | 提取 buildAiPrompt 方法 |
| `backend/src/services/taskSourceService.ts` | 新增 previewSyncPrompt, previewSyncResults, confirmSync |
| `backend/src/routes/taskSources.ts` | 新增 3 个路由 |
| `frontend/src/api/taskSource.js` | 新增 3 个 API 函数 |
| `frontend/src/stores/taskSourceStore.js` | 新增预览状态和方法 |
| `frontend/src/components/taskSource/TaskSourcePanel.vue` | handleSync 改造 + 步骤化对话框 |

## Verification

1. 手动同步 AI 模式 → 弹出 prompt 预览 → 确认后弹出结果预览 → 确认后创建任务
2. 自动同步（scheduler）→ 直接创建任务，不走预览
3. 没有新文件 → toast 提示"没有新文件"
4. 取消 prompt 预览 → 无任何副作用
5. 在结果预览中编辑标题/描述 → 创建的任务使用编辑后的值
6. 在结果预览中取消勾选某些文件 → 仅创建勾选的
7. AI 分析失败 → 显示 fallback 结果，用户仍可确认
