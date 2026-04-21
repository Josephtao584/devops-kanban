<template>
  <Teleport to="body">
    <div class="editor-overlay" @click.self="handleClose">
      <div class="editor-panel">
        <div class="editor-header">
          <span class="editor-title">编辑 - {{ taskTitle }}</span>
          <button class="editor-close" @click="handleClose">✕</button>
        </div>

        <div class="editor-body">
          <div class="editor-sidebar">
            <div class="sidebar-tabs">
              <button :class="['sidebar-tab', { active: sidebarTab === 'changes' }]" @click="switchToChanges">
                变更{{ changedFiles.length ? `(${changedFiles.length})` : '' }}
              </button>
              <button :class="['sidebar-tab', { active: sidebarTab === 'files' }]" @click="sidebarTab = 'files'">
                文件
              </button>
            </div>

            <!-- 文件 Tab -->
            <div v-show="sidebarTab === 'files'" class="sidebar-content">
              <div class="file-search-wrap">
                <input v-model="searchQuery" placeholder="搜索文件..." class="file-search" />
              </div>

              <div v-if="recentFiles.length" class="sidebar-section">
                <div class="section-header" @click="showRecent = !showRecent">
                  <span>最近</span>
                  <span class="section-toggle">{{ showRecent ? '▾' : '▸' }}</span>
                </div>
                <div v-show="showRecent" class="section-body">
                  <div
                    v-for="f in filteredRecentFiles"
                    :key="f"
                    class="file-item"
                    :class="{ selected: currentFile === f }"
                    :title="f"
                    @click="openFile(f)"
                  >
                    <span class="file-name">{{ fileName(f) }}</span>
                    <span class="file-dir">{{ fileDir(f) }}</span>
                  </div>
                </div>
              </div>

              <div class="sidebar-section">
                <div class="section-header" @click="showFullTree = !showFullTree">
                  <span>文件树</span>
                  <span class="section-toggle">{{ showFullTree ? '▾' : '▸' }}</span>
                </div>
                <div v-show="showFullTree" class="section-body">
                  <FileTree
                    v-if="fileTree"
                    :tree="fileTree"
                    :selected-path="currentFile"
                    @file-select="openFile"
                  />
                  <div v-else class="loading-tree">加载中...</div>
                </div>
              </div>
            </div>

            <!-- 变更 Tab -->
            <div v-show="sidebarTab === 'changes'" class="sidebar-content">
              <div v-if="changesLoading" class="sidebar-empty">加载中...</div>
              <div v-else-if="changedFiles.length === 0" class="sidebar-empty">无未提交变更</div>
              <div v-else class="changes-list">
                <div
                  v-for="f in changedFiles"
                  :key="f.path"
                  class="change-item"
                  :class="{ selected: currentFile === f.path }"
                >
                  <span class="change-status" :class="statusClass(f.status)">{{ statusLabel(f.status) }}</span>
                  <span class="change-path" :title="f.path" @click="openChangedFile(f)">{{ f.path }}</span>
                  <button class="change-diff-btn" title="查看差异" @click="showChangeDiff(f)">差异</button>
                </div>
              </div>
            </div>
          </div>

          <div class="editor-main">
            <!-- diff 预览模式 -->
            <div v-if="showDiffView" class="diff-view">
              <div class="diff-header">
                <span>差异: {{ diffTarget }}</span>
                <div class="diff-actions">
                  <span class="diff-loading" v-if="diffLoading">加载中...</span>
                  <button v-if="!diffLoading" class="diff-action-btn" @click="openFileFromDiff">编辑此文件</button>
                  <button class="diff-close" @click="closeDiffView">✕</button>
                </div>
              </div>
              <div ref="diffContainerRef" class="diff-merge-container"></div>
            </div>

            <!-- 正常编辑模式 -->
            <template v-else>
              <div v-if="!currentFile" class="editor-placeholder">
                选择左侧文件开始编辑
              </div>
              <div v-else class="editor-container">
                <div ref="editorRef" class="codemirror-wrapper"></div>
                <div class="editor-statusbar">
                  <span class="status-file">{{ currentFile }}</span>
                  <span class="status-position">行 {{ cursorLine }}, 列 {{ cursorCol }}</span>
                  <span class="status-lang">{{ fileLanguage }}</span>
                  <button
                    v-if="hasUnsavedChanges"
                    class="save-btn"
                    :disabled="saving"
                    @click="saveFile"
                  >
                    保存 {{ saving ? '...' : '' }}
                  </button>
                  <span v-else class="status-saved">已保存</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 底部：提交区或提示 -->
        <div v-if="changedFiles.length > 0" class="commit-area">
          <div class="commit-header" @click="showCommitArea = !showCommitArea">
            <span>{{ changedFiles.length }} 个未提交变更{{ commitSelectedCount > 0 && commitSelectedCount < changedFiles.length ? `（已选 ${commitSelectedCount} 个）` : '' }}</span>
            <span class="section-toggle">{{ showCommitArea ? '▾' : '▸' }}</span>
          </div>
          <div v-if="showCommitArea" class="commit-body">
            <div class="commit-files">
              <label class="commit-select-all">
                <input ref="selectAllCheckboxRef" type="checkbox" :checked="commitAllSelected" @change="toggleSelectAllCommitFiles" />
                全选
              </label>
              <label v-for="f in changedFiles" :key="f.path" class="commit-file" :class="{ 'commit-file-selected': f.selected }">
                <input type="checkbox" v-model="f.selected" @click.stop />
                <span class="change-status" :class="statusClass(f.status)">{{ statusLabel(f.status) }}</span>
                {{ f.path }}
              </label>
            </div>
            <div class="commit-input-row">
              <input
                v-model="commitMessage"
                class="commit-input"
                placeholder="输入提交信息..."
                @keyup.enter="handleCommit"
              />
              <button
                class="commit-btn"
                :disabled="commitSelectedCount === 0 || !commitMessage.trim() || committing"
                @click="handleCommit"
              >
                {{ committing ? '提交中...' : `提交${commitSelectedCount > 0 ? ` ${commitSelectedCount} 个文件` : ''}` }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="editor-footer">
          <span class="hint">Ctrl+S 保存当前文件</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick, watchEffect } from 'vue'
import { ElMessage } from 'element-plus'
import { getFileTree, readFileContent, writeFileContent, getUncommittedChanges, getDiff, commit } from '../../api/git'
import FileTree from './FileTree.vue'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { defaultKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { MergeView } from '@codemirror/merge'

const props = defineProps({
  projectId: { type: Number, required: true },
  taskId: { type: Number, required: true },
  taskTitle: { type: String, required: true },
})

const emit = defineEmits(['close'])

// Editor state
const fileTree = ref(null)
const currentFile = ref('')
const editorRef = ref(null)
const editorView = ref(null)
const saving = ref(false)
const cursorLine = ref(1)
const cursorCol = ref(1)
const unsavedFileSet = reactive(new Set())

// Sidebar state
const sidebarTab = ref('changes')
const searchQuery = ref('')
const recentFiles = reactive([])
const showRecent = ref(true)
const showFullTree = ref(true)

// Changes state
const changedFiles = ref([])
const changesLoading = ref(false)

// Diff state
const diffContent = ref('')
const diffTarget = ref('')
const showDiffView = ref(false)
const diffContainerRef = ref(null)
const diffLoading = ref(false)
let mergeViewInstance = null

// Commit state
const commitMessage = ref('')
const committing = ref(false)
const showCommitArea = ref(true)

// Computed
const commitSelectedCount = computed(() => changedFiles.value.filter(f => f.selected).length)
const commitAllSelected = computed(() => changedFiles.value.length > 0 && changedFiles.value.every(f => f.selected))
const commitNoneSelected = computed(() => changedFiles.value.every(f => !f.selected))

const selectAllCheckboxRef = ref(null)
watchEffect(() => {
  const el = selectAllCheckboxRef.value
  if (el) {
    el.indeterminate = !commitAllSelected.value && !commitNoneSelected.value
  }
})

const hasUnsavedChanges = computed(() => {
  if (!currentFile.value || !editorView.value) return false
  return unsavedFileSet.has(currentFile.value)
})

const fileLanguage = computed(() => {
  if (!currentFile.value) return 'Plain Text'
  const ext = currentFile.value.split('.').pop().toLowerCase()
  const langMap = {
    js: 'JavaScript', ts: 'TypeScript', jsx: 'JavaScript', tsx: 'TypeScript',
    py: 'Python', html: 'HTML', css: 'CSS', json: 'JSON',
    vue: 'Vue', md: 'Markdown',
  }
  return langMap[ext] || 'Plain Text'
})

const filteredRecentFiles = computed(() => {
  if (!searchQuery.value) return recentFiles.slice()
  const q = searchQuery.value.toLowerCase()
  return recentFiles.filter(f => f.toLowerCase().includes(q))
})

// Helpers
function fileName(filePath) {
  return filePath.split('/').pop()
}

function fileDir(filePath) {
  const parts = filePath.split('/')
  parts.pop()
  return parts.join('/')
}

function statusClass(status) {
  const map = { added: 'status-added', modified: 'status-modified', deleted: 'status-deleted', untracked: 'status-untracked' }
  return map[status] || 'status-modified'
}

function statusLabel(status) {
  const map = { added: 'A', modified: 'M', deleted: 'D', untracked: '?' }
  return map[status] || status?.[0]?.toUpperCase() || '?'
}

function addToRecent(filePath) {
  const idx = recentFiles.indexOf(filePath)
  if (idx !== -1) recentFiles.splice(idx, 1)
  recentFiles.unshift(filePath)
  if (recentFiles.length > 10) recentFiles.splice(10)
}

// Language extension
function getLanguageExtension() {
  if (!currentFile.value) return []
  const ext = currentFile.value.split('.').pop().toLowerCase()
  const langMap = {
    js: javascript, ts: javascript, jsx: javascript, tsx: javascript,
    py: python, html: html, css: css, json: json,
  }
  return langMap[ext] ? [langMap[ext]()] : []
}

// Editor creation
function createEditor(content = '') {
  if (editorView.value) {
    editorView.value.destroy()
  }

  const state = EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      bracketMatching(),
      ...getLanguageExtension(),
      keymap.of([
        ...defaultKeymap,
        {
          key: 'Mod-s',
          run: () => {
            saveFile()
            return true
          },
        },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && currentFile.value) {
          unsavedFileSet.add(currentFile.value)
        }
        if (update.selectionSet) {
          const pos = update.state.selection.main.head
          const line = update.state.doc.lineAt(pos)
          cursorLine.value = line.number
          cursorCol.value = pos - line.from + 1
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ],
  })

  editorView.value = new EditorView({ state, parent: editorRef.value })
}

// File operations
async function loadFileTree() {
  try {
    const res = await getFileTree(props.projectId, props.taskId)
    if (res.success) {
      fileTree.value = res.data
    }
  } catch {
    ElMessage.error('加载文件树失败')
  }
}

let openFileSeq = 0

async function openFile(filePath) {
  closeDiffView()
  const seq = ++openFileSeq
  currentFile.value = filePath
  addToRecent(filePath)
  try {
    const res = await readFileContent(props.projectId, props.taskId, filePath)
    if (seq !== openFileSeq) return
    if (res.success) {
      if (res.data.isBinary) {
        ElMessage.warning('二进制文件无法编辑')
        currentFile.value = ''
        return
      }
      await nextTick()
      createEditor(res.data.content)
      unsavedFileSet.delete(filePath)
    }
  } catch {
    if (seq !== openFileSeq) return
    ElMessage.error('加载文件失败')
  }
}

async function saveFile() {
  if (!currentFile.value || !editorView.value || saving.value) return
  saving.value = true
  try {
    const content = editorView.value.state.doc.toString()
    const res = await writeFileContent(props.projectId, props.taskId, currentFile.value, content)
    if (res.success) {
      unsavedFileSet.delete(currentFile.value)
      ElMessage.success('保存成功')
      loadChanges()
      showCommitArea.value = true
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// Changes operations
async function loadChanges() {
  changesLoading.value = true
  try {
    const res = await getUncommittedChanges(props.projectId, props.taskId)
    if (res.success) {
      changedFiles.value = (res.data || []).map(f => ({ ...f, selected: true }))
    }
  } catch {
    // silently fail
  } finally {
    changesLoading.value = false
  }
}

function switchToChanges() {
  sidebarTab.value = 'changes'
  loadChanges()
}

// Click file path in changes tab → open for editing
function openChangedFile(file) {
  openFile(file.path)
}

// Click diff button → show side-by-side diff
async function showChangeDiff(file) {
  diffTarget.value = file.path
  diffLoading.value = true
  showDiffView.value = true
  currentFile.value = ''

  try {
    const [currentRes, headRes] = await Promise.all([
      readFileContent(props.projectId, props.taskId, file.path),
      readFileContent(props.projectId, props.taskId, file.path, { version: 'head' }),
    ])

    const currentContent = currentRes.success ? currentRes.data.content : ''
    const headContent = headRes.success ? headRes.data.content : ''

    await nextTick()

    if (mergeViewInstance) {
      mergeViewInstance.destroy()
      mergeViewInstance = null
    }

    mergeViewInstance = new MergeView({
      a: {
        doc: headContent,
        extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
      },
      b: {
        doc: currentContent,
        extensions: [EditorView.editable.of(false), EditorState.readOnly.of(true)],
      },
      parent: diffContainerRef.value,
    })
  } catch {
    ElMessage.error('加载差异失败')
  } finally {
    diffLoading.value = false
  }
}

function closeDiffView() {
  if (mergeViewInstance) {
    mergeViewInstance.destroy()
    mergeViewInstance = null
  }
  showDiffView.value = false
  diffContent.value = ''
  diffTarget.value = ''
}

function openFileFromDiff() {
  const filePath = diffTarget.value
  closeDiffView()
  openFile(filePath)
}

// Commit
function toggleSelectAllCommitFiles() {
  const newState = !commitAllSelected.value
  changedFiles.value.forEach(f => { f.selected = newState })
}

async function handleCommit() {
  if (!commitMessage.value.trim() || committing.value) return
  const selectedFiles = changedFiles.value.filter(f => f.selected).map(f => f.path)
  if (selectedFiles.length === 0) return
  committing.value = true
  try {
    const res = await commit(props.projectId, props.taskId, {
      message: commitMessage.value.trim(),
      addAll: false,
      files: selectedFiles,
    })
    if (res.success) {
      ElMessage.success('提交成功')
      commitMessage.value = ''
      showCommitArea.value = false
      await loadChanges()
    }
  } catch {
    ElMessage.error('提交失败')
  } finally {
    committing.value = false
  }
}

// Close
function handleClose() {
  if (unsavedFileSet.size > 0) {
    if (!window.confirm(`有 ${unsavedFileSet.size} 个未保存变更，确定关闭？`)) return
  }
  if (editorView.value) {
    editorView.value.destroy()
    editorView.value = null
  }
  emit('close')
}

function handleKeydown(e) {
  if (e.key === 'Escape') handleClose()
}

onMounted(async () => {
  document.addEventListener('keydown', handleKeydown)
  await loadFileTree()
  loadChanges()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (mergeViewInstance) {
    mergeViewInstance.destroy()
    mergeViewInstance = null
  }
  if (editorView.value) {
    editorView.value.destroy()
    editorView.value = null
  }
})
</script>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-panel {
  width: 95vw;
  height: 95vh;
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #f5f7fa;
}

.editor-title {
  font-size: 14px;
  font-weight: 600;
}

.editor-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.editor-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ===== Sidebar ===== */
.editor-sidebar {
  width: 260px;
  min-width: 200px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  overflow: hidden;
}

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #e4e7ed;
  background: #f0f2f5;
  flex-shrink: 0;
}

.sidebar-tab {
  flex: 1;
  padding: 8px 4px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.sidebar-tab:hover {
  background: #e8eaed;
}

.sidebar-tab.active {
  color: #409eff;
  border-bottom-color: #409eff;
  background: #fafafa;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.file-search-wrap {
  padding: 4px 8px 8px;
}

.file-search {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.file-search:focus {
  border-color: #409eff;
}

/* Sidebar sections */
.sidebar-section {
  margin-bottom: 4px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
}

.section-header:hover {
  background: #f0f2f5;
}

.section-toggle {
  font-size: 10px;
}

.section-body {
  padding: 0 4px;
}

/* Recent files */
.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  border-radius: 3px;
  margin: 0 4px;
}

.file-item:hover {
  background: #ecf5ff;
}

.file-item.selected {
  background: #d9ecff;
  color: #409eff;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.file-dir {
  font-size: 10px;
  color: #c0c4cc;
  margin-left: 8px;
  flex-shrink: 0;
}

/* Tree section */
.tree-section .section-body {
  padding: 0;
}

/* Changes tab */
.sidebar-empty {
  padding: 24px 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.changes-list {
  padding: 0 4px;
}

.change-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  border-radius: 3px;
  margin: 1px 4px;
}

.change-item.selected {
  background: #d9ecff;
}

.change-status {
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.status-added {
  background: #e1f3d8;
  color: #67c23a;
}

.status-modified {
  background: #d9ecff;
  color: #409eff;
}

.status-deleted {
  background: #fde2e2;
  color: #f56c6c;
}

.status-untracked {
  background: #f4f4f5;
  color: #909399;
}

.change-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  cursor: pointer;
}

.change-path:hover {
  color: #409eff;
}

.change-diff-btn {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  background: #fff;
  color: #606266;
  cursor: pointer;
}

.change-diff-btn:hover {
  color: #409eff;
  border-color: #409eff;
}

/* ===== Main editor ===== */
.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}

.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.codemirror-wrapper {
  flex: 1;
  overflow: auto;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 12px;
  border-top: 1px solid #e4e7ed;
  background: #f5f7fa;
  font-size: 12px;
  color: #606266;
}

.save-btn {
  margin-left: auto;
  padding: 4px 12px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-saved {
  margin-left: auto;
  color: #67c23a;
}

/* ===== Diff view ===== */
.diff-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  font-size: 13px;
  font-weight: 500;
}

.diff-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-action-btn {
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid #409eff;
  border-radius: 3px;
  background: #fff;
  color: #409eff;
  cursor: pointer;
}

.diff-action-btn:hover {
  background: #ecf5ff;
}

.diff-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 3px;
}

.diff-close:hover {
  background: rgba(0, 0, 0, 0.06);
}

.diff-loading {
  font-size: 12px;
  color: #909399;
}

.diff-merge-container {
  flex: 1;
  overflow: auto;
}

.diff-merge-container .cm-merge-view {
  height: 100%;
}

/* ===== Commit area ===== */
.commit-area {
  border-top: 1px solid #e4e7ed;
  background: #f5f7fa;
  flex-shrink: 0;
}

.commit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 12px;
  color: #606266;
  user-select: none;
}

.commit-header:hover {
  background: #ecf5ff;
}

.commit-body {
  padding: 0 16px 12px;
}

.commit-files {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  max-height: 80px;
  overflow-y: auto;
}

.commit-file {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #606266;
  background: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #e4e7ed;
  cursor: pointer;
}

.commit-file-selected {
  border-color: #409eff;
  background: #ecf5ff;
}

.commit-select-all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #909399;
  padding: 2px 6px;
  cursor: pointer;
  user-select: none;
}

.commit-select-all input,
.commit-file input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.commit-input-row {
  display: flex;
  gap: 8px;
}

.commit-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.commit-input:focus {
  border-color: #409eff;
}

.commit-btn {
  padding: 6px 16px;
  background: #67c23a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.commit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Footer ===== */
.editor-footer {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  border-top: 1px solid #e4e7ed;
  background: #f5f7fa;
  font-size: 12px;
  color: #909399;
}

.loading-tree {
  padding: 20px;
  text-align: center;
  color: #909399;
}
</style>
