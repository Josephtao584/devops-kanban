<template>
  <div class="task-file-viewer">
    <!-- No task / no worktree -->
    <div v-if="!taskId" class="viewer-empty">请选择任务</div>
    <div v-else-if="!task?.worktree_path" class="viewer-empty">
      <span>该任务尚未创建 worktree</span>
      <el-button size="small" type="primary" :loading="creating" @click="handleCreateWorktree">
        创建 worktree
      </el-button>
    </div>
    <div v-else-if="loading" class="viewer-empty">
      <el-skeleton :rows="6" animated />
    </div>
    <div v-else-if="loadError" class="viewer-empty">
      <span style="color: var(--danger-strong);">{{ loadError }}</span>
      <el-button size="small" @click="loadTree">重试</el-button>
    </div>
    <div v-else class="viewer-body">
      <!-- File tree sidebar -->
      <div class="file-tree-sidebar" :style="{ width: treeWidth + 'px' }">
        <div class="file-tree-header">
          <span class="file-tree-title">文件</span>
          <el-input
            v-model="searchQuery"
            size="small"
            placeholder="搜索文件"
            clearable
            class="file-search"
          >
            <template #prefix>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </template>
          </el-input>
        </div>
        <div class="file-tree-list">
          <div v-if="!fileTree || !fileTree.children" class="file-empty">
            <span>{{ searchQuery ? '无匹配文件' : 'worktree 无文件' }}</span>
          </div>
          <TreeNode
            v-else
            v-for="child in fileTree.children"
            :key="child.path"
            :node="child"
            :search="searchQuery"
            :current-file="currentFile"
            @select="selectFile"
          />
        </div>
      </div>

      <div class="tree-resize-handle" @mousedown="startTreeResize"></div>

      <!-- File content / diff area -->
      <div class="file-content-area">
        <!-- No file selected -->
        <div v-if="!currentFile" class="content-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>选择左侧文件查看</span>
        </div>
        <!-- Loading file -->
        <div v-else-if="fileLoading" class="content-empty">
          <el-skeleton :rows="8" animated />
        </div>
        <!-- File content tabs -->
        <template v-else>
          <div class="content-tabs">
            <span
              class="tab-item"
              :class="{ active: contentTab === 'current' }"
              @click="contentTab = 'current'"
            >当前</span>
            <span
              class="tab-item"
              :class="{ active: contentTab === 'diff' }"
              @click="loadDiff(); contentTab = 'diff'"
            >对比</span>
          </div>
          <!-- Current file content -->
          <div v-if="contentTab === 'current'" class="content-editor">
            <pre class="code-content">{{ currentContent }}</pre>
          </div>
          <!-- Diff view -->
          <div v-else-if="contentTab === 'diff'" class="content-diff">
            <div v-if="diffLoading" class="content-empty"><el-skeleton :rows="6" animated /></div>
            <div v-else-if="!currentDiff" class="content-empty">该文件无变更</div>
            <div v-else class="diff-block">
              <div
                v-for="(line, i) in currentDiff"
                :key="i"
                class="diff-line"
                :class="line.type"
              >
                <span class="diff-line-num">{{ line.num }}</span>
                <span class="diff-line-text">{{ line.text }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useGitStore } from '../../stores/gitStore.js'
import { useTaskWorktreeStore } from '../../stores/taskWorktreeStore.js'
import TreeNode from './TaskFileViewerTreeNode.vue'

const gitStore = useGitStore()
const taskWorktreeStore = useTaskWorktreeStore()

const props = defineProps({
  taskId: { type: Number, default: null },
  projectId: { type: Number, default: null },
  task: { type: Object, default: null }
})

const emit = defineEmits(['refresh'])

const loading = ref(false)
const fileLoading = ref(false)
const diffLoading = ref(false)
const creating = ref(false)
const fileTree = ref(null)
const currentFile = ref('')
const currentContent = ref('')
const currentDiff = ref(null)
const contentTab = ref('current')
const searchQuery = ref('')
const loadError = ref(null)
const LOAD_TIMEOUT = 10000

// Resizable file tree sidebar width
const treeWidth = ref(200)
const TREE_MIN = 140
const TREE_MAX = 500

function startTreeResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = treeWidth.value
  function onMove(ev) {
    const delta = ev.clientX - startX
    treeWidth.value = Math.max(TREE_MIN, Math.min(TREE_MAX, startWidth + delta))
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), ms))
  ])
}

async function loadTree() {
  if (!props.taskId || !props.projectId || !props.task?.worktree_path) {
    fileTree.value = null
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const resp = await withTimeout(gitStore.getFileTree(props.projectId, props.taskId), LOAD_TIMEOUT)
    if (resp?.success) fileTree.value = resp.data || null
    else {
      fileTree.value = null
      loadError.value = resp?.message || '加载文件树失败'
    }
  } catch (e) {
    console.error('Failed to load file tree:', e)
    fileTree.value = null
    loadError.value = e?.message || '加载文件树失败'
  } finally {
    loading.value = false
  }
}

async function selectFile(file) {
  if (file.type !== 'file') return
  currentFile.value = file.path
  currentDiff.value = null
  contentTab.value = 'current'
  fileLoading.value = true
  try {
    const resp = await withTimeout(gitStore.readFileContent(props.projectId, props.taskId, file.path), LOAD_TIMEOUT)
    if (resp?.success) currentContent.value = resp.data?.content || ''
    else currentContent.value = '读取失败: ' + (resp?.message || '未知错误')
  } catch (e) {
    currentContent.value = '读取失败: ' + (e?.message || e)
  } finally {
    fileLoading.value = false
  }
}

async function loadDiff() {
  if (!props.taskId || !props.projectId || !currentFile.value) return
  diffLoading.value = true
  currentDiff.value = null
  try {
    const resp = await withTimeout(gitStore.getDiff(props.projectId, props.taskId), LOAD_TIMEOUT)
    if (resp?.success) {
      const fileDiff = resp.data?.diffs?.[currentFile.value]
      if (fileDiff) currentDiff.value = parseUnifiedDiff(fileDiff)
    }
  } catch (e) {
    console.error('Failed to load diff:', e)
  } finally {
    diffLoading.value = false
  }
}

function parseUnifiedDiff(text) {
  if (!text) return null
  const lines = text.split('\n')
  const result = []
  let num = 0
  for (const line of lines) {
    if (line.startsWith('@@')) continue
    if (line.startsWith('---') || line.startsWith('+++')) continue
    if (line.startsWith('+')) result.push({ type: 'add', num: ++num, text: line })
    else if (line.startsWith('-')) result.push({ type: 'del', num, text: line })
    else result.push({ type: 'ctx', num: ++num, text: line })
  }
  return result.length ? result : null
}

async function handleCreateWorktree() {
  if (!props.taskId) return
  creating.value = true
  try {
    const resp = await taskWorktreeStore.createTaskWorktree(props.taskId)
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

watch(() => [props.taskId, props.projectId, props.task?.worktree_path], () => {
  currentFile.value = ''
  currentContent.value = ''
  currentDiff.value = null
  loadTree()
}, { immediate: true })
</script>

<style scoped>
.task-file-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.viewer-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.viewer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px 16px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  flex: 1;
  min-height: 100%;
}

/* File tree sidebar */
.file-tree-sidebar {
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  flex-shrink: 0;
  min-width: 140px;
}

.tree-resize-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 10;
  transition: background 0.15s;
}

.tree-resize-handle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 0;
  width: 2px;
  height: 100%;
  background: transparent;
  transition: background 0.15s;
}

.tree-resize-handle:hover::after,
.tree-resize-handle:active::after {
  background: var(--accent-color);
}

.file-tree-header {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-tree-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.file-search {
  --el-input-border-radius: 6px;
  --el-input-height: 26px;
}

.file-search :deep(.el-input__wrapper) {
  padding: 0 8px;
  font-size: 12px;
}

.file-tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.file-empty {
  padding: 16px 12px;
  color: var(--text-muted);
  font-size: 11px;
  text-align: center;
}

/* Content area */
.file-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-primary);
}

.content-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--text-muted);
  font-size: 12px;
}

.content-empty svg {
  opacity: 0.3;
}

.content-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  padding: 0 12px;
  gap: 0;
}

.tab-item {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.content-editor {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}

.code-content {
  font-family: 'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  margin: 0;
  tab-size: 2;
}

.content-diff {
  flex: 1;
  overflow: auto;
}

.diff-block {
  padding: 4px 0;
}

.diff-line {
  display: flex;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}

.diff-line.add { background: rgba(37, 198, 201, 0.08); }
.diff-line.del { background: rgba(239, 68, 68, 0.06); }
.diff-line.ctx { background: transparent; }

.diff-line-num {
  width: 40px;
  text-align: right;
  padding-right: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  user-select: none;
  font-size: 11px;
}

.diff-line-text {
  flex: 1;
  white-space: pre;
}

.diff-line.add .diff-line-text { color: var(--done-strong); }
.diff-line.del .diff-line-text { color: var(--danger-strong); }
</style>
