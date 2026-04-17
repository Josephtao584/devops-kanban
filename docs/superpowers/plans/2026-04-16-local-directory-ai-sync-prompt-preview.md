# Local Directory AI Sync Prompt Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-step preview for LOCAL_DIRECTORY AI mode manual sync — preview prompt, then preview AI results, confirm before creating tasks. Auto sync is unaffected.

**Architecture:** Three new REST endpoints (`preview-prompt`, `preview-results`, `confirm`) backed by new service methods. Frontend uses a 2-step dialog replacing the direct sync call for AI mode. Session metadata stores AI results between preview and confirm.

**Tech Stack:** TypeScript (backend Fastify), Vue 3 (frontend Element Plus), LibSQL database, Pinia store

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/db/schema.sql` | Modify | Add `metadata TEXT` to sessions table |
| `backend/src/types/entities.ts` | Modify | Add `metadata` to SessionEntity |
| `backend/src/repositories/sessionRepository.ts` | Modify | Add `parseRow`/`serializeRow` for JSON metadata |
| `backend/src/sources/localDirectoryAdapter.ts` | Modify | Extract `buildAiPrompt()` method |
| `backend/src/types/dto/taskSources.ts` | Modify | Add `ConfirmSyncBody` interface |
| `backend/src/services/taskSourceService.ts` | Modify | Add 3 new methods |
| `backend/src/routes/taskSources.ts` | Modify | Add 3 new routes |
| `frontend/src/api/taskSource.js` | Modify | Add 3 API functions |
| `frontend/src/stores/taskSourceStore.js` | Modify | Add preview state + methods |
| `frontend/src/components/taskSource/TaskSourcePanel.vue` | Modify | `handleSync` redirect + 2-step dialog |

---

### Task 1: Database schema + entity types for session metadata

**Files:**
- Modify: `backend/src/db/schema.sql:149-164`
- Modify: `backend/src/types/entities.ts:38-53`

- [ ] **Step 1.1: Add metadata column to sessions table in schema.sql**

In `backend/src/db/schema.sql`, add `metadata TEXT` to the sessions table definition (between `initial_prompt TEXT,` and `agent_id INTEGER,`):

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  workflow_run_id INTEGER,
  workflow_step_id TEXT,
  status TEXT,
  worktree_path TEXT,
  branch TEXT,
  initial_prompt TEXT,
  metadata TEXT,
  agent_id INTEGER,
  executor_type TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 1.2: Add metadata to SessionEntity**

In `backend/src/types/entities.ts`, add `metadata?: Record<string, unknown>;` to `SessionEntity` between `agent_id` and `executor_type`:

```typescript
export interface SessionEntity {
  id: number;
  task_id: number;
  workflow_run_id?: number | null;
  workflow_step_id?: string | null;
  status?: string;
  worktree_path?: string | null;
  branch?: string | null;
  initial_prompt?: string | null;
  metadata?: Record<string, unknown>;
  agent_id?: number | null;
  executor_type: ExecutorType;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 1.3: Add JSON parsing for metadata in SessionRepository**

In `backend/src/repositories/sessionRepository.ts`, override `parseRow` and `serializeRow`:

```typescript
class SessionRepository extends BaseRepository<SessionEntity> {
  constructor() {
    super('sessions');
  }

  protected override parseRow(row: Record<string, unknown>): SessionEntity {
    if (typeof row.metadata === 'string') {
      try {
        row.metadata = JSON.parse(row.metadata);
      } catch {
        row.metadata = {};
      }
    }
    return row as SessionEntity;
  }

  protected override serializeRow(entity: Partial<SessionEntity>): Record<string, unknown> {
    const data = { ...entity } as Record<string, unknown>;
    if (data.metadata !== undefined && data.metadata !== null) {
      data.metadata = typeof data.metadata === 'string'
        ? data.metadata
        : JSON.stringify(data.metadata);
    }
    return data;
  }

  // ... existing methods below
```

- [ ] **Step 1.4: Verify migration applies automatically**

Run: `cd backend && npx tsx src/db/migrate.ts` (or restart the dev server — migration runs on startup)
Expected: `[DB Migration] Applied 1 change(s): ALTER TABLE sessions ADD COLUMN "metadata" TEXT DEFAULT ''`

- [ ] **Step 1.5: Commit**

```bash
git add backend/src/db/schema.sql backend/src/types/entities.ts backend/src/repositories/sessionRepository.ts
git commit -m "feat: add metadata column to sessions table for AI sync preview"
```

---

### Task 2: Extract buildAiPrompt method from localDirectoryAdapter

**Files:**
- Modify: `backend/src/sources/localDirectoryAdapter.ts:231-259`

- [ ] **Step 2.1: Extract buildAiPrompt as a public async method**

In `backend/src/sources/localDirectoryAdapter.ts`, extract the prompt-building logic from `fetchWithAiDescriptions` into a new public method. Add it before `fetchWithAiDescriptions` (after line 181):

```typescript
async buildAiPrompt(files?: FileInfo[]): Promise<string> {
  const filelist = files ?? await this._scanFiles();
  let fileContents = '';
  for (let i = 0; i < filelist.length; i++) {
    const file = filelist[i]!;
    const content = this.isTextFile(file.filename)
      ? await this.readFileContent(file.filepath)
      : null;

    fileContents += `\n=== 文件${i + 1}: ${file.filename} ===\n`;
    if (content !== null) {
      fileContents += `${content}\n`;
    } else {
      fileContents += `(二进制文件，请使用工具读取: ${file.filepath})\n`;
    }
  }

  return `分析以下文件内容，为每个文件生成任务标题和描述。

请严格按以下格式回复，每个文件一段：
文件1
标题: <生成的标题>
描述: <生成的描述>

文件2
标题: <生成的标题>
描述: <生成的描述>

---以下是文件内容---
${fileContents}`;
}
```

- [ ] **Step 2.2: Update fetchWithAiDescriptions to use buildAiPrompt**

In `fetchWithAiDescriptions`, replace lines 231-259 (the inline prompt building) with:

```typescript
const prompt = await this.buildAiPrompt(filelist);
```

- [ ] **Step 2.3: Commit**

```bash
git add backend/src/sources/localDirectoryAdapter.ts
git commit -m "refactor: extract buildAiPrompt method from fetchWithAiDescriptions"
```

---

### Task 3: Add three new service methods

**Files:**
- Modify: `backend/src/services/taskSourceService.ts`
- Modify: `backend/src/types/dto/taskSources.ts`

- [ ] **Step 3.1: Add ConfirmSyncBody DTO type**

In `backend/src/types/dto/taskSources.ts`, add after `TaskSourcePreviewBody`:

```typescript
export interface ConfirmSyncItem {
  externalId: string;
  title: string;
  description?: string;
}

export interface ConfirmSyncBody {
  sessionId: number;
  items: ConfirmSyncItem[];
}
```

- [ ] **Step 3.2: Add previewSyncPrompt method**

In `backend/src/services/taskSourceService.ts`, add before the closing `}` of the class:

```typescript
async previewSyncPrompt(sourceId: string) {
  const source = await this.getById(sourceId);
  if (!source) {
    throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
  }

  const adapter = getAdapter(source.type, source as TaskSourceLike);
  if (source.type !== 'LOCAL_DIRECTORY' || !(adapter instanceof LocalDirectoryAdapter) || adapter.descriptionMode !== 'ai') {
    throw new BusinessError('仅支持 LOCAL_DIRECTORY AI 模式', 'Only LOCAL_DIRECTORY AI mode is supported');
  }

  const allFiles = await adapter._scanFiles();
  const projectId = source.project_id;
  const newFiles = [];
  for (const file of allFiles) {
    const existing = await this.taskRepository.findByExternalIdAndProject(file.filename, projectId);
    if (!existing) {
      newFiles.push(file);
    }
  }

  const prompt = await adapter.buildAiPrompt(newFiles);
  return { prompt, files: newFiles, fileCount: newFiles.length };
}
```

- [ ] **Step 3.3: Add previewSyncResults method**

```typescript
async previewSyncResults(sourceId: string) {
  const source = await this.getById(sourceId);
  if (!source) {
    throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
  }

  const adapter = getAdapter(source.type, source as TaskSourceLike);
  if (source.type !== 'LOCAL_DIRECTORY' || !(adapter instanceof LocalDirectoryAdapter) || adapter.descriptionMode !== 'ai') {
    throw new BusinessError('仅支持 LOCAL_DIRECTORY AI 模式', 'Only LOCAL_DIRECTORY AI mode is supported');
  }

  const allFiles = await adapter._scanFiles();
  const projectId = source.project_id;
  const newFiles = [];
  for (const file of allFiles) {
    const existing = await this.taskRepository.findByExternalIdAndProject(file.filename, projectId);
    if (!existing) {
      newFiles.push(file);
    }
  }

  if (newFiles.length === 0) {
    return { sessionId: null, results: [] };
  }

  const sessionRepo = new SessionRepository();
  const session = await sessionRepo.create({
    task_id: 0,
    executor_type: ExecutorType.CLAUDE_CODE,
    agent_id: adapter.agentId ?? null,
    status: 'PENDING_REVIEW',
    worktree_path: adapter.directoryPath,
    started_at: new Date().toISOString(),
    metadata: {},
  });

  const tasks = await adapter.fetchWithAiDescriptions(session.id, newFiles);

  const results = tasks.map(t => ({
    externalId: t.external_id,
    title: t.title,
    description: t.description ?? '',
    external_url: t.external_url,
  }));

  await sessionRepo.update(session.id, { metadata: { aiResults: results } });

  return { sessionId: session.id, results };
}
```

- [ ] **Step 3.4: Add confirmSync method**

```typescript
async confirmSync(sourceId: string, sessionId: number, items: { externalId: string; title: string; description?: string }[]) {
  const source = await this.getById(sourceId);
  if (!source) {
    throw new NotFoundError('未找到任务源', 'Task source not found', { sourceId });
  }

  const sessionRepo = new SessionRepository();
  const session = await sessionRepo.findById(sessionId);
  if (!session) {
    throw new NotFoundError('未找到会话', 'Session not found', { sessionId });
  }

  const projectId = source.project_id;
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await this.taskRepository.findByExternalIdAndProject(item.externalId, projectId);
    if (existing) {
      await this.taskRepository.update(existing.id, {
        project_id: projectId,
        title: item.title,
        description: item.description ?? '',
        source: source.type,
      });
      skipped++;
    } else {
      await this.taskRepository.create({
        external_id: item.externalId,
        title: item.title,
        description: item.description ?? '',
        project_id: projectId,
        status: 'TODO',
        priority: 'MEDIUM',
        source: source.type,
        external_url: (item as { external_url?: string }).external_url ?? '',
      });
      created++;
    }
  }

  await sessionRepo.update(sessionId, {
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
  });

  return { created, skipped, total: items.length };
}
```

- [ ] **Step 3.5: Commit**

```bash
git add backend/src/services/taskSourceService.ts backend/src/types/dto/taskSources.ts
git commit -m "feat: add previewSyncPrompt, previewSyncResults, confirmSync service methods"
```

---

### Task 4: Add three new route handlers

**Files:**
- Modify: `backend/src/routes/taskSources.ts`

- [ ] **Step 4.1: Add routes for the three new endpoints**

In `backend/src/routes/taskSources.ts`, add before the closing `};` of the routes function (before the final `};`):

```typescript
  fastify.post<{ Params: IdParams }>('/:id/sync/preview-prompt', async (request, reply) => {
    try {
      const data = await getService().previewSyncPrompt(request.params.id);
      return successResponse(data);
    } catch (error) {
      logError(error, request);
      return handleTaskSourceError(reply, error, 'Failed to preview prompt');
    }
  });

  fastify.post<{ Params: IdParams }>('/:id/sync/preview-results', async (request, reply) => {
    try {
      const data = await getService().previewSyncResults(request.params.id);
      return successResponse(data);
    } catch (error) {
      logError(error, request);
      return handleTaskSourceError(reply, error, 'Failed to preview results');
    }
  });

  fastify.post<{ Params: IdParams; Body: { sessionId: number; items: { externalId: string; title: string; description?: string }[] } }>('/:id/sync/confirm', async (request, reply) => {
    try {
      const { sessionId, items } = request.body;
      if (!sessionId || !items || !Array.isArray(items)) {
        reply.code(400);
        return errorResponse('sessionId and items are required');
      }
      const data = await getService().confirmSync(request.params.id, sessionId, items);
      return successResponse(data, 'Tasks created successfully');
    } catch (error) {
      logError(error, request);
      return handleTaskSourceError(reply, error, 'Failed to confirm sync');
    }
  });
```

- [ ] **Step 4.2: Commit**

```bash
git add backend/src/routes/taskSources.ts
git commit -m "feat: add preview-prompt, preview-results, confirm routes"
```

---

### Task 5: Frontend API + Store

**Files:**
- Modify: `frontend/src/api/taskSource.js`
- Modify: `frontend/src/stores/taskSourceStore.js`

- [ ] **Step 5.1: Add API functions**

In `frontend/src/api/taskSource.js`, add at the end before any exports:

```javascript
export const previewPrompt = (id) => api.post(`/task-sources/${id}/sync/preview-prompt`)
export const previewResults = (id) => api.post(`/task-sources/${id}/sync/preview-results`)
export const confirmSync = (id, data) => api.post(`/task-sources/${id}/sync/confirm`, data)
```

- [ ] **Step 5.2: Add preview state to store**

In `frontend/src/stores/taskSourceStore.js`, add new refs after `syncHistoryPagination`:

```javascript
const aiPreviewDialog = ref(false)       // 2-step dialog visible
const aiPreviewStep = ref('prompt')      // 'prompt' | 'results'
const aiPreviewPrompt = ref('')          // prompt text
const aiPreviewFiles = ref([])           // file list for step 1
const aiPreviewResults = ref([])         // AI results for step 2
const aiPreviewSessionId = ref(null)     // session ID from preview-results
const aiPreviewSelected = ref(new Set()) // selected items in step 2
const aiPreviewLoading = ref(false)      // loading state
const aiPreviewSourceId = ref(null)      // current source being previewed
```

- [ ] **Step 5.3: Add store methods**

In the store's return block, add these methods before the closing `}`:

```javascript
async function openAiPreview(sourceId) {
  aiPreviewSourceId.value = sourceId
  aiPreviewStep.value = 'prompt'
  aiPreviewLoading.value = true
  try {
    const response = await taskSourceApi.previewPrompt(sourceId)
    const data = unwrap(response, 'Failed to preview prompt')
    if (data.fileCount === 0) {
      return false
    }
    aiPreviewPrompt.value = data.prompt
    aiPreviewFiles.value = data.files
    aiPreviewDialog.value = true
    return true
  } catch (e) {
    error.value = e.message
    throw e
  } finally {
    aiPreviewLoading.value = false
  }
}

async function executeAiPreview() {
  aiPreviewStep.value = 'results'
  aiPreviewLoading.value = true
  aiPreviewSelected.value = new Set()
  try {
    const response = await taskSourceApi.previewResults(aiPreviewSourceId.value)
    const data = unwrap(response, 'AI analysis failed')
    aiPreviewSessionId.value = data.sessionId
    aiPreviewResults.value = (data.results || []).map(r => ({
      ...r,
      selected: true,
    }))
    aiPreviewSelected.value = new Set(aiPreviewResults.value.map(r => r.externalId))
  } catch (e) {
    error.value = e.message
    throw e
  } finally {
    aiPreviewLoading.value = false
  }
}

async function confirmAiPreviewImport(projectId) {
  aiPreviewLoading.value = true
  try {
    const items = aiPreviewResults.value
      .filter(r => aiPreviewSelected.value.has(r.externalId))
      .map(r => ({ externalId: r.externalId, title: r.title, description: r.description, external_url: r.external_url }))
    const response = await taskSourceApi.confirmSync(aiPreviewSourceId.value, {
      sessionId: aiPreviewSessionId.value,
      items,
    })
    const data = unwrap(response, 'Failed to confirm sync')
    closeAiPreviewDialog()
    return data
  } catch (e) {
    error.value = e.message
    throw e
  } finally {
    aiPreviewLoading.value = false
  }
}

function closeAiPreviewDialog() {
  aiPreviewDialog.value = false
  aiPreviewStep.value = 'prompt'
  aiPreviewPrompt.value = ''
  aiPreviewFiles.value = []
  aiPreviewResults.value = []
  aiPreviewSessionId.value = null
  aiPreviewSelected.value = new Set()
  aiPreviewLoading.value = false
  aiPreviewSourceId.value = null
}

function toggleAiPreviewItem(externalId) {
  const next = new Set(aiPreviewSelected.value)
  if (next.has(externalId)) {
    next.delete(externalId)
  } else {
    next.add(externalId)
  }
  aiPreviewSelected.value = next
}
```

- [ ] **Step 5.4: Export new state and methods**

Add to the store's return object:

```javascript
aiPreviewDialog,
aiPreviewStep,
aiPreviewPrompt,
aiPreviewFiles,
aiPreviewResults,
aiPreviewSessionId,
aiPreviewSelected,
aiPreviewLoading,
openAiPreview,
executeAiPreview,
confirmAiPreviewImport,
closeAiPreviewDialog,
toggleAiPreviewItem,
```

- [ ] **Step 5.5: Commit**

```bash
git add frontend/src/api/taskSource.js frontend/src/stores/taskSourceStore.js
git commit -m "feat: add AI preview API functions and store state/methods"
```

---

### Task 6: Frontend 2-step dialog in TaskSourcePanel

**Files:**
- Modify: `frontend/src/components/taskSource/TaskSourcePanel.vue`

- [ ] **Step 6.1: Modify handleSync to route AI mode to new preview**

In `TaskSourcePanel.vue`, find the `handleSync` function (around line 793) and change it to:

```javascript
const handleSync = async (source) => {
  const isLocalAiMode = source.type === 'LOCAL_DIRECTORY' && source.config?.descriptionMode === 'ai'
  if (isLocalAiMode) {
    try {
      const opened = await taskSourceStore.openAiPreview(source.id)
      if (!opened) {
        toast.info(t('taskSource.noNewFiles', '没有新文件'))
      }
    } catch (err) {
      console.error('Failed to open AI preview:', err)
      toast.error('预览失败: ' + (err.message || '未知错误'))
    }
  } else {
    await previewAndSync(source)
  }
}
```

- [ ] **Step 6.2: Add the 2-step dialog template**

In the `<template>` section, after the existing Sync Preview Dialog (after the closing `</BaseDialog>` of the sync preview, before the Sync History Dialog), add:

```vue
    <!-- AI Preview 2-Step Dialog -->
    <BaseDialog
      v-model="taskSourceStore.aiPreviewDialog"
      :title="taskSourceStore.aiPreviewStep === 'prompt' ? '同步预览 - Prompt' : '同步预览 - AI 结果'"
      width="700px"
      custom-class="ai-preview-dialog"
      append-to-body
    >
      <!-- Step 1: Prompt Preview -->
      <div v-if="taskSourceStore.aiPreviewStep === 'prompt'">
        <div class="ai-prompt-header">
          <span class="prompt-file-count">{{ taskSourceStore.aiPreviewFiles.length }} 个文件将被分析</span>
        </div>
        <div class="ai-prompt-content">
          <pre class="ai-prompt-text">{{ taskSourceStore.aiPreviewPrompt }}</pre>
        </div>
        <div class="ai-prompt-files">
          <div v-for="file in taskSourceStore.aiPreviewFiles" :key="file.filename" class="ai-prompt-file-item">
            <span class="file-icon">📄</span>
            <span class="file-name">{{ file.filename }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
        </div>
      </div>

      <!-- Step 2: AI Results Preview -->
      <div v-else>
        <div class="ai-results-controls">
          <el-button size="small" @click="selectAllAiResults">全选</el-button>
          <el-button size="small" @click="deselectAllAiResults">取消全选</el-button>
          <span class="selected-count">
            {{ taskSourceStore.aiPreviewSelected.size }} / {{ taskSourceStore.aiPreviewResults.length }} 已选
          </span>
        </div>
        <div class="ai-results-list">
          <div
            v-for="item in taskSourceStore.aiPreviewResults"
            :key="item.externalId"
            class="ai-result-item"
            :class="{ selected: taskSourceStore.aiPreviewSelected.has(item.externalId) }"
          >
            <input
              type="checkbox"
              :checked="taskSourceStore.aiPreviewSelected.has(item.externalId)"
              @change="taskSourceStore.toggleAiPreviewItem(item.externalId)"
            />
            <div class="result-content">
              <div class="result-filename">{{ item.externalId }}</div>
              <el-input v-model="item.title" size="small" placeholder="任务标题" class="result-title-input" />
              <el-input
                v-model="item.description"
                type="textarea"
                :rows="2"
                size="small"
                placeholder="任务描述"
                class="result-desc-input"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="taskSourceStore.closeAiPreviewDialog()">{{ $t('common.cancel', '取消') }}</el-button>
        <el-button
          v-if="taskSourceStore.aiPreviewStep === 'prompt'"
          type="primary"
          @click="executeAiPreviewAndSync"
          :loading="taskSourceStore.aiPreviewLoading"
          :disabled="taskSourceStore.aiPreviewFiles.length === 0"
        >
          确认执行
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="confirmAiPreviewAndImport"
          :loading="taskSourceStore.aiPreviewLoading"
          :disabled="taskSourceStore.aiPreviewSelected.size === 0"
        >
          确认导入 ({{ taskSourceStore.aiPreviewSelected.size }})
        </el-button>
      </template>
    </BaseDialog>
```

- [ ] **Step 6.3: Add script methods for the dialog**

In the `<script setup>` section, add these methods before the closing `</script>`:

```javascript
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const executeAiPreviewAndSync = async () => {
  try {
    await taskSourceStore.executeAiPreview()
  } catch (err) {
    console.error('AI preview execution failed:', err)
    toast.error('AI 分析失败: ' + (err.message || '未知错误'))
  }
}

const confirmAiPreviewAndImport = async () => {
  try {
    const result = await taskSourceStore.confirmAiPreviewImport(props.projectId)
    if (result?.created > 0) {
      toast.success(`成功导入 ${result.created} 个任务`)
      await taskStore.fetchTasks(props.projectId)
      emit('tasks-imported')
    } else {
      toast.info('没有新任务被创建')
    }
  } catch (err) {
    console.error('Confirm import failed:', err)
    toast.error('导入失败: ' + (err.message || '未知错误'))
  }
}

const selectAllAiResults = () => {
  taskSourceStore.aiPreviewSelected = new Set(
    taskSourceStore.aiPreviewResults.map(r => r.externalId)
  )
}

const deselectAllAiResults = () => {
  taskSourceStore.aiPreviewSelected = new Set()
}
```

- [ ] **Step 6.4: Add styles for the dialog**

In the `<style scoped>` section, add at the end:

```css
/* AI Preview dialog */
.ai-prompt-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.prompt-file-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.ai-prompt-content {
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 12px;
}

.ai-prompt-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-primary);
  font-family: var(--font-mono, monospace);
}

.ai-prompt-files {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.ai-prompt-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.file-icon {
  font-size: 14px;
}

.file-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.file-size {
  color: var(--text-secondary);
  font-size: 11px;
}

.ai-results-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.selected-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.ai-results-list {
  max-height: 400px;
  overflow-y: auto;
}

.ai-result-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border-bottom: 1px solid var(--border-color);
}

.ai-result-item.selected {
  background: var(--bg-secondary);
}

.ai-result-item input[type="checkbox"] {
  margin-top: 4px;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-filename {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

:deep(.result-title-input .el-input__inner) {
  font-weight: 500;
}

.ai-preview-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}
```

- [ ] **Step 6.5: Commit**

```bash
git add frontend/src/components/taskSource/TaskSourcePanel.vue
git commit -m "feat: add 2-step AI preview dialog for LOCAL_DIRECTORY sync"
```

---

### Task 7: Manual verification

- [ ] **Step 7.1: Test manual AI sync preview flow**

1. Start dev server: `./start.sh`
2. Navigate to a project with a LOCAL_DIRECTORY task source in AI mode
3. Click "同步" → verify step 1 dialog shows prompt + file list
4. Click "确认执行" → verify step 2 shows AI-generated titles/descriptions
5. Edit a title, uncheck a file → click "确认导入"
6. Verify only checked items become tasks, with edited title

- [ ] **Step 7.2: Test non-AI mode still works**

Click "同步" on a non-AI LOCAL_DIRECTORY source → verify existing preview dialog opens (no regression)

- [ ] **Step 7.3: Test cancel behavior**

In step 1, click "取消" → verify no session created, no tasks created

- [ ] **Step 7.4: Test empty files case**

If no new files exist → toast "没有新文件", no dialog opens (handled in `previewSyncPrompt` returning `fileCount: 0` — need to add check in `openAiPreview`)

**Fix for step 7.4:** Update `openAiPreview` in the store to check `fileCount === 0`:

```javascript
// In openAiPreview, after unwrapping response:
if (data.fileCount === 0) {
  closeAiPreviewDialog()
  // Caller should show toast — already handled in handleSync catch
  return
}
```
