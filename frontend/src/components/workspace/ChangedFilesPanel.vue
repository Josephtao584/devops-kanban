<template>
  <div class="changed-files-panel">
    <div v-if="!taskId" class="panel-empty">请选择任务</div>
    <div v-else-if="loading" class="panel-empty"><el-skeleton :rows="5" animated /></div>
    <div v-else-if="loadError" class="panel-empty">
      <span style="color: var(--danger-strong);">{{ loadError }}</span>
      <el-button size="small" @click="loadChanges">重试</el-button>
    </div>
    <div v-else-if="noRepo" class="panel-empty">
      <span>当前项目未配置本地仓库</span>
    </div>
    <div v-else class="panel-body">
      <!-- Worktree / Project repo info bar -->
      <div v-if="isWorktree" class="worktree-info">
        <div class="worktree-info-row">
          <span class="info-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="3" x2="6" y2="15"></line>
              <circle cx="18" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <path d="M18 9a9 9 0 0 1-9 9"></path>
            </svg>
            {{ task.worktree_branch }}
          </span>
          <el-button
            size="small"
            type="danger"
            text
            :loading="deleting"
            @click="handleDeleteWorktree"
          >
            删除
          </el-button>
        </div>
        <div class="worktree-info-row">
          <span class="info-item truncate" :title="task.worktree_path">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            {{ shortPath(task.worktree_path) }}
          </span>
        </div>
      </div>
      <div v-else class="project-repo-info">
        <span class="project-repo-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          项目仓库
        </span>
        <el-button size="small" type="primary" :loading="creating" @click="handleCreateWorktree">
          创建 worktree 隔离到任务分支
        </el-button>
      </div>

      <!-- Change stats -->
      <div class="change-stats" v-if="changes.length">
        <span class="stat-modified">{{ modifiedCount }} 已修改</span>
        <span class="stat-added">{{ addedCount }} 新增</span>
        <span class="stat-deleted">{{ deletedCount }} 删除</span>
        <span class="stat-untracked">{{ untrackedCount }} 未跟踪</span>
      </div>

      <!-- Action buttons -->
      <!-- Action buttons -->
      <div class="worktree-actions">
        <el-button
          size="small"
          type="primary"
          :disabled="!changes.length"
          @click="showCommitDialog = true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="1.05" y1="12" x2="7" y2="12"></line>
            <line x1="17.01" y1="12" x2="22.96" y2="12"></line>
          </svg>
          提交
        </el-button>
        <el-button
          size="small"
          :loading="pushing"
          @click="handlePush"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
            <path d="M12 19V5"></path>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
          推送
        </el-button>
        <el-button
          size="small"
          :type="isWorktree ? 'success' : 'warning'"
          @click="handleMerge"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
            <circle cx="18" cy="18" r="3"></circle>
            <circle cx="6" cy="6" r="3"></circle>
            <path d="M6 21V9a9 9 0 0 0 9 9"></path>
          </svg>
          合入
        </el-button>
        <span v-if="!isWorktree" class="no-worktree-warning">未隔离分支，提交将直接作用于项目仓库</span>
      </div>

      <!-- File list -->
      <div class="changed-file-list">
        <div
          v-for="file in changes"
          :key="file.path"
          class="changed-file-item"
          :class="{ active: selectedFile === file.path }"
          @click="selectFile(file)"
        >
          <span class="file-status-badge" :class="file.status">
            {{ statusChar(file.status) }}
          </span>
          <span class="file-path">{{ file.path }}</span>
          <span class="file-actions">
            <el-tooltip content="查看 Diff" placement="top">
              <el-button size="small" text :loading="diffLoading === file.path" @click.stop="viewDiff(file)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                </svg>
              </el-button>
            </el-tooltip>
          </span>
        </div>
        <div v-if="!changes.length" class="panel-empty">无未提交的改动</div>
      </div>
    </div>

    <!-- Diff dialog -->
    <el-dialog
      v-model="showDiffDialog"
      :title="`Diff - ${selectedDiffFile}`"
      width="80%"
      top="10vh"
      destroy-on-close
    >
      <div v-if="diffLoading === '__dialog__'" class="dialog-loading">
        <el-skeleton :rows="15" animated />
      </div>
      <div v-else-if="fileDiffContent" class="diff-dialog-body">
        <div
          v-for="(line, i) in fileDiffContent"
          :key="i"
          class="diff-line"
          :class="line.type"
        >
          <span v-if="line.num !== null" class="line-num">{{ line.num }}</span>
          <span class="diff-line-text">{{ line.text }}</span>
        </div>
      </div>
      <el-empty v-else description="无 diff 信息" />
    </el-dialog>

    <CommitDialog
      v-if="showCommitDialog && task?.project_id && taskId > 0"
      :project-id="task.project_id"
      :task-id="taskId"
      :current-branch="currentBranch || task.worktree_branch"
      @close="showCommitDialog = false"
      @committed="onCommitted"
    />

    <MergeDialog
      v-if="showMergeDialog && task?.project_id && taskId > 0"
      :project-id="task.project_id"
      :task-id="taskId"
      :source-branch="currentBranch || task.worktree_branch"
      @close="showMergeDialog = false"
      @merged="onMerged"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUncommittedChanges, getDiff, pushWorktree } from '../../api/git.js'
import { createTaskWorktree, deleteTaskWorktree } from '../../api/taskWorktree.js'
import CommitDialog from '../CommitDialog.vue'
import MergeDialog from '../MergeDialog.vue'

const props = defineProps({
  taskId: { type: Number, default: null },
  projectId: { type: Number, default: null },
  task: { type: Object, default: null }
})

const loading = ref(false)
const changes = ref([])
const selectedFile = ref('')
const showDiffDialog = ref(false)
const selectedDiffFile = ref('')
const fileDiffContent = ref(null)
const diffLoading = ref(null)
const creating = ref(false)
const deleting = ref(false)
const pushing = ref(false)
const showCommitDialog = ref(false)
const showMergeDialog = ref(false)
const loadError = ref(null)
const isWorktree = ref(true)
const noRepo = ref(false)
const currentBranch = ref(null)
const LOAD_TIMEOUT = 10000

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), ms))
  ])
}

const modifiedCount = computed(() => changes.value.filter(f => f.status === 'modified').length)
const addedCount = computed(() => changes.value.filter(f => f.status === 'added').length)
const deletedCount = computed(() => changes.value.filter(f => f.status === 'deleted').length)
const untrackedCount = computed(() => changes.value.filter(f => f.status === 'untracked').length)

async function loadChanges() {
  if (!props.taskId || !props.projectId) {
    changes.value = []
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const resp = await withTimeout(getUncommittedChanges(props.projectId, props.taskId), LOAD_TIMEOUT)
    if (resp?.success) {
      const data = resp.data
      if (typeof data === 'object' && data !== null) {
        changes.value = data.changes || []
        isWorktree.value = data.isWorktree ?? true
        noRepo.value = data.noRepo ?? false
        currentBranch.value = data.currentBranch || null
      } else {
        // Fallback for older API responses (array)
        changes.value = Array.isArray(data) ? data : []
        isWorktree.value = true
        noRepo.value = false
      }
    } else {
      changes.value = []
      loadError.value = resp?.message || '加载改动失败'
    }
  } catch (e) {
    console.error('Failed to load changes:', e)
    changes.value = []
    loadError.value = e?.message || '加载改动失败'
  } finally {
    loading.value = false
  }
}

async function viewDiff(file) {
  if (!props.taskId || !props.projectId) return
  selectedDiffFile.value = file.path
  fileDiffContent.value = null
  diffLoading.value = '__dialog__'
  showDiffDialog.value = true
  try {
    const resp = await getDiff(props.projectId, props.taskId)
    if (resp?.success) {
      const raw = resp.data?.diffs?.[file.path]
      if (raw) {
        fileDiffContent.value = parseDiff(raw)
      } else {
        fileDiffContent.value = null
      }
    }
  } catch (e) {
    console.error('Failed to load diff:', e)
    fileDiffContent.value = null
  } finally {
    diffLoading.value = null
  }
}

function selectFile(file) {
  selectedFile.value = file.path
}

function statusChar(status) {
  const map = { modified: 'M', added: 'A', deleted: 'D', untracked: '?' }
  return map[status] || '?'
}

function shortPath(path) {
  if (!path) return ''
  const parts = path.split('/')
  if (parts.length > 4) return '…/' + parts.slice(-3).join('/')
  return path
}

function parseDiff(text) {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let newLineNum = 0
  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/)
      if (match) newLineNum = parseInt(match[1])
      result.push({ type: 'ctx', text: line, num: null })
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++')) { result.push({ type: 'ctx', text: line, num: null }); continue }
    if (line.startsWith('+')) result.push({ type: 'add', text: line, num: newLineNum++ })
    else if (line.startsWith('-')) result.push({ type: 'del', text: line, num: newLineNum++ })
    else result.push({ type: 'ctx', text: line, num: newLineNum++ })
  }
  return result.length ? result : null
}

async function handleCreateWorktree() {
  if (!props.taskId) return
  creating.value = true
  try {
    const resp = await createTaskWorktree(props.taskId)
    if (resp?.success) {
      ElMessage.success('Worktree 创建成功')
      emit('refresh')
    } else {
      ElMessage.error(resp?.message || '创建失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

async function handleDeleteWorktree() {
  if (!props.taskId) return
  try {
    await ElMessageBox.confirm('确定要删除该 worktree 吗？此操作不可撤销。', '删除 worktree', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return // cancelled
  }
  deleting.value = true
  try {
    const resp = await deleteTaskWorktree(props.taskId)
    if (resp?.success) {
      ElMessage.success('Worktree 已删除')
      emit('refresh')
    } else {
      ElMessage.error(resp?.message || '删除失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

async function handlePush() {
  if (!props.task?.project_id || !props.taskId) return
  const branch = currentBranch.value || props.task.worktree_branch || ''
  try {
    await ElMessageBox.confirm(
      `将推送分支 ${branch} 到远程仓库，确定继续？`,
      '确认推送',
      { confirmButtonText: '推送', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  pushing.value = true
  try {
    const resp = await pushWorktree(props.task.project_id, props.taskId)
    if (resp?.success) {
      ElMessage.success('推送成功')
    } else {
      ElMessage.error(resp?.message || '推送失败')
    }
  } catch (e) {
    ElMessage.error(e?.message || '推送失败')
  } finally {
    pushing.value = false
  }
}

function handleMerge() {
  if (!props.task?.project_id || !props.taskId) {
    ElMessage.warning('当前任务无法合入')
    return
  }
  showMergeDialog.value = true
}

async function onCommitted() {
  showCommitDialog.value = false
  ElMessage.success('提交成功')
  await loadChanges()
  emit('refresh')
}

async function onMerged() {
  showMergeDialog.value = false
  ElMessage.success('合并成功')
  emit('refresh')
}

const emit = defineEmits(['refresh'])

watch(() => [props.taskId, props.projectId, props.task?.worktree_path], () => {
  selectedFile.value = ''
  showDiffDialog.value = false
  fileDiffContent.value = null
  loadChanges()
}, { immediate: true })
</script>

<style scoped>
.changed-files-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 12px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

/* Worktree info bar */
.worktree-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.worktree-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.info-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
}

.info-item svg {
  flex-shrink: 0;
  opacity: 0.6;
}

.info-item.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Project repo info (when no worktree) */
.project-repo-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--warning-soft);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.project-repo-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  color: var(--warning-strong);
}

.project-repo-label svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.no-worktree-warning {
  font-size: 12px;
  color: var(--warning-strong);
  font-style: italic;
}

/* Change stats */
.change-stats {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  font-size: 11px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
}

.stat-modified { color: var(--warning-strong); }
.stat-added { color: var(--done-strong); }
.stat-deleted { color: var(--danger-strong); }
.stat-untracked { color: var(--text-muted); }

.worktree-actions {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
}

.worktree-actions .el-button svg {
  vertical-align: -1px;
}

/* File list */
.changed-file-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  min-height: 0;
}

.changed-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.12s;
}

.changed-file-item:hover {
  background: var(--bg-tertiary);
}

.changed-file-item.active {
  background: var(--teal-accent-mid);
}

.file-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
}

.file-status-badge.modified {
  background: var(--warning-soft);
  color: var(--warning-strong);
}

.file-status-badge.added {
  background: var(--done-soft);
  color: var(--done-strong);
}

.file-status-badge.deleted {
  background: var(--danger-soft);
  color: var(--danger-strong);
}

.file-status-badge.untracked {
  background: var(--neutral-soft);
  color: var(--neutral-strong);
}

.file-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
}

.file-actions {
  display: flex;
  flex-shrink: 0;
}

/* Diff dialog */
.dialog-loading {
  padding: 20px;
}

.diff-dialog-body {
  max-height: 65vh;
  overflow-y: auto;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  display: flex;
  padding: 1px 16px;
  white-space: pre;
  transition: background 0.15s ease;
}

.diff-line:hover {
  filter: brightness(0.97);
}

.diff-line.add {
  background: rgba(34, 197, 94, 0.12);
  color: var(--done-strong);
  border-left: 3px solid #22c55e;
}

.diff-line.del {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger-strong);
  border-left: 3px solid #ef4444;
}

.diff-line.ctx {
  color: var(--text-muted);
  border-left: 3px solid transparent;
}

.line-num {
  width: 40px;
  text-align: right;
  padding-right: 10px;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
  font-size: 11px;
}

.diff-line-text {
  white-space: pre;
}
</style>
