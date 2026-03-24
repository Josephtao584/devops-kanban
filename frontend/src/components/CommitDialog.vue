<template>
  <el-dialog
    :model-value="true"
    title="提交更改"
    width="90%"
    :top="top"
    :close-on-click-modal="false"
    @close="$emit('close')"
    class="commit-dialog"
  >
    <div class="dialog-body-wrapper">
      <!-- Main Content: Split View -->
      <div class="commit-main-content">
        <!-- Left Panel: File List -->
        <div class="file-panel">
          <div class="panel-header">
            <span class="panel-title">文件更改</span>
            <span class="file-count">{{ selectedCount }} / {{ changes.length }}</span>
          </div>

          <div class="file-list">
            <div
              v-for="file in changes"
              :key="file.path"
              :class="['file-item', { selected: file.selected, active: selectedFile === file.path }]"
              @click="selectFile(file)"
            >
              <el-checkbox
                :model-value="file.selected"
                @click.stop
                @change="toggleFile(file)"
              />
              <div class="file-info">
                <span class="file-icon">
                  <el-icon v-if="file.status === 'untracked'"><DocumentAdd /></el-icon>
                  <el-icon v-else-if="file.status === 'modified'"><Document /></el-icon>
                  <el-icon v-else-if="file.status === 'deleted'"><Delete /></el-icon>
                  <el-icon v-else><Document /></el-icon>
                </span>
                <span class="file-path" :title="file.path">{{ file.path.split('/').pop() }}</span>
              </div>
              <el-tag
                v-if="file.status === 'untracked'"
                size="small"
                type="success"
                effect="light"
              >新增</el-tag>
              <el-tag
                v-else-if="file.status === 'modified'"
                size="small"
                type="warning"
                effect="light"
              >修改</el-tag>
              <el-tag
                v-else-if="file.status === 'deleted'"
                size="small"
                type="danger"
                effect="light"
              >删除</el-tag>
            </div>

            <div v-if="changes.length === 0" class="empty-files">
              <el-icon size="24"><Document /></el-icon>
              <span>暂无文件更改</span>
            </div>
          </div>

          <div class="file-actions">
            <el-button size="small" link @click="selectAll">全选</el-button>
            <el-button size="small" link @click="deselectAll">取消全选</el-button>
          </div>
        </div>

        <!-- Right Panel: Diff View -->
        <div class="diff-panel">
          <div class="panel-header">
            <span class="panel-title">代码差异</span>
            <span v-if="selectedFile" class="selected-file">{{ selectedFile }}</span>
          </div>

          <div v-if="diffLoading" class="diff-loading">
            <el-icon class="is-loading" size="24"><Loading /></el-icon>
            <span>加载中...</span>
          </div>

          <el-empty v-else-if="!selectedFile" description="选择文件查看差异" />

          <div v-else-if="!currentDiff" class="diff-empty">
            <span>无差异或无法显示</span>
          </div>

          <div v-else class="diff-content">
            <div class="diff-stats">
              <span v-if="currentFileAdditions > 0" class="stat-add">+{{ currentFileAdditions }}</span>
              <span v-if="currentFileDeletions > 0" class="stat-del">-{{ currentFileDeletions }}</span>
            </div>
            <el-scrollbar class="diff-scrollbar">
              <div class="diff-view">
                <div
                  v-for="(line, idx) in parsedDiff"
                  :key="idx"
                  :class="['diff-line', line.type]"
                >{{ line.content }}</div>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Section: Commit Message -->
    <template #footer>
      <div class="commit-section">
        <div class="commit-input">
          <el-input
            v-model="form.message"
            type="textarea"
            :rows="2"
            placeholder="输入提交信息（描述本次更改的内容）..."
          />
        </div>
        <div class="commit-actions">
          <el-button @click="$emit('close')">取消</el-button>
          <el-button
            type="primary"
            :disabled="selectedCount === 0 || !form.message.trim() || committing"
            @click="handleCommit"
          >
            {{ committing ? `提交中 ${selectedCount} 个文件...` : `提交 ${selectedCount} 个文件` }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, DocumentAdd, Delete, Loading } from '@element-plus/icons-vue'
import { commit, getUncommittedChanges, getDiff } from '../api/git'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  taskId: {
    type: Number,
    required: true
  },
  currentBranch: {
    type: String,
    default: ''
  }
})

const top = ref('5vh')

const emit = defineEmits(['close', 'committed'])

const committing = ref(false)
const changes = ref([])
const selectedFile = ref('')
const diffData = ref(null)
const diffLoading = ref(false)

const form = reactive({
  message: '',
  addAll: false
})

const selectedCount = computed(() => changes.value.filter(c => c.selected).length)

const currentDiff = computed(() => {
  if (!diffData.value?.diffs || !selectedFile.value) return null
  return diffData.value.diffs[selectedFile.value] || null
})

const currentFileAdditions = computed(() => {
  if (!diffData.value?.files || !selectedFile.value) return 0
  const file = diffData.value.files.find(f => f.path === selectedFile.value)
  return file?.additions || 0
})

const currentFileDeletions = computed(() => {
  if (!diffData.value?.files || !selectedFile.value) return 0
  const file = diffData.value.files.find(f => f.path === selectedFile.value)
  return file?.deletions || 0
})

const parsedDiff = computed(() => {
  if (!currentDiff.value) return []
  const lines = currentDiff.value.split('\n')
  const result = []
  let oldLineNum = 0
  let newLineNum = 0

  for (const line of lines) {
    if (line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ')) {
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        result.push({ type: 'header', content: line })
      }
      continue
    }

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        oldLineNum = parseInt(match[1])
        newLineNum = parseInt(match[2])
      }
      result.push({ type: 'hunk', content: line })
      continue
    }

    if (line.startsWith('+')) {
      result.push({ type: 'addition', content: line.substring(1), lineNum: newLineNum++ })
    } else if (line.startsWith('-')) {
      result.push({ type: 'deletion', content: line.substring(1), lineNum: oldLineNum++ })
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.substring(1), lineNum: newLineNum++ })
    } else if (line.trim()) {
      result.push({ type: 'other', content: line })
    }
  }
  return result
})

const toggleFile = (file) => {
  file.selected = !file.selected
}

const selectFile = async (file) => {
  if (selectedFile.value === file.path) return
  selectedFile.value = file.path
  await loadDiff()
}

const loadDiff = async () => {
  if (!selectedFile.value) return
  diffLoading.value = true
  try {
    const response = await getDiff(props.projectId, props.taskId)
    if (response.success) {
      diffData.value = response.data
    }
  } catch (e) {
    console.error('Failed to load diff:', e)
    diffData.value = null
  } finally {
    diffLoading.value = false
  }
}

const loadChanges = async () => {
  try {
    const response = await getUncommittedChanges(props.projectId, props.taskId)
    if (response.success) {
      changes.value = (response.data || []).map(c => ({ ...c, selected: true }))
      // Auto-select first file
      if (changes.value.length > 0) {
        selectFile(changes.value[0])
      }
    }
  } catch (e) {
    console.error('Failed to load changes:', e)
  }
}

const selectAll = () => {
  changes.value.forEach(c => c.selected = true)
}

const deselectAll = () => {
  changes.value.forEach(c => c.selected = false)
}

const handleCommit = async () => {
  if (!form.message.trim()) {
    ElMessage.warning('请输入提交信息')
    return
  }

  const selectedFiles = changes.value.filter(c => c.selected).map(c => c.path)

  committing.value = true
  try {
    const response = await commit(props.projectId, props.taskId, {
      message: form.message,
      addAll: false,
      files: selectedFiles
    })

    if (response.success) {
      ElMessage.success('提交成功')
      emit('committed', response.data)
      emit('close')
    } else {
      ElMessage.error(response.message || '提交失败')
    }
  } catch (e) {
    console.error('Commit failed:', e)
    ElMessage.error('提交失败')
  } finally {
    committing.value = false
  }
}

onMounted(() => {
  loadChanges()
})
</script>

<style scoped>
/* ==================== Main Layout ==================== */
.commit-main-content {
  display: flex;
  gap: 16px;
  height: 500px;
  min-height: 350px;
  overflow: hidden;
  box-sizing: border-box;
  max-width: 100%;
  background: #fff;
}

.dialog-body-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
  background: #fff;
}

/* ==================== File Panel ==================== */
.file-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  min-width: 0;
  box-sizing: border-box;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title::before {
  content: '';
  display: block;
  width: 4px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 2px;
}

.file-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.file-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  margin-bottom: 4px;
  border: 1px solid transparent;
}

.file-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.file-item.selected {
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-color: var(--accent-color);
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.15);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  font-size: 16px;
}

.file-path {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.empty-files {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.empty-files .el-icon {
  opacity: 0.5;
}

.file-actions {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.file-actions .el-button {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
}

/* ==================== Diff Panel ==================== */
.diff-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  height: 100%;
}

.diff-panel .panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  border-bottom: 1px solid var(--border-color);
  min-width: 0;
  overflow: hidden;
}

.diff-panel .panel-header .panel-title {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-panel .panel-header .panel-title::before {
  content: '';
  display: block;
  width: 4px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 2px;
}

.diff-panel .panel-header .selected-file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  background: var(--bg-primary);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.diff-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 40px;
  color: var(--text-muted);
  font-size: 14px;
}

.diff-panel :deep(.el-empty) {
  margin: 0;
  padding: 0;
}

.diff-panel :deep(.el-empty__description) {
  color: var(--text-muted);
  font-size: 14px;
}

.diff-loading .el-icon {
  color: var(--accent-color);
}

.diff-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  color: var(--text-muted);
  font-size: 14px;
}

.diff-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  width: 100%;
}

.diff-stats {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.stat-add {
  color: var(--el-color-success);
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 600;
  background: var(--el-color-success-light-9);
  padding: 2px 8px;
  border-radius: 6px;
}

.stat-del {
  color: var(--el-color-danger);
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 600;
  background: var(--el-color-danger-light-9);
  padding: 2px 8px;
  border-radius: 6px;
}

.diff-scrollbar {
  flex: 1;
  overflow: auto;
  min-width: 0;
}

.diff-view {
  padding: 0;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  min-width: 0;
  width: 100%;
}

.diff-line {
  display: block;
  padding: 2px 20px;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  transition: background 0.15s ease;
}

.diff-line:hover {
  filter: brightness(0.97);
}

.diff-line.addition {
  background-color: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  border-left: 3px solid #22c55e;
}

.diff-line.deletion {
  background-color: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  border-left: 3px solid #ef4444;
}

.diff-line.hunk {
  background-color: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  font-weight: 600;
  border-left: 3px solid #6366f1;
}

.diff-line.header {
  color: var(--text-muted);
  font-style: italic;
  border-left: 3px solid transparent;
}

.diff-line.context {
  border-left: 3px solid transparent;
}

/* ==================== Commit Section ==================== */
.commit-section {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  width: 100%;
}

.commit-input {
  flex: 1;
}

.commit-input :deep(.el-textarea) {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.commit-input :deep(.el-textarea__inner) {
  border-radius: 8px;
  font-size: 13px;
  padding: 12px 14px;
  border-color: var(--border-color);
  transition: all 0.2s ease;
}

.commit-input :deep(.el-textarea__inner:focus) {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.commit-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.commit-actions .el-button {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

/* ==================== Dialog Styles ==================== */
:deep(.el-dialog__header) {
  margin: 0;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  flex-shrink: 0;
}

:deep(.el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

:deep(.el-dialog__title)::before {
  content: '';
  display: block;
  width: 6px;
  height: 20px;
  background: var(--accent-color);
  border-radius: 3px;
}

:deep(.el-dialog__body) {
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  border-radius: 0;
}

:deep(.el-dialog) {
  height: auto;
  max-height: 75vh;
  max-width: 90vw !important;
  margin: 0 auto !important;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.commit-dialog {
  display: flex;
  flex-direction: column;
}

:deep(.el-dialog__headerbtn) {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

:deep(.el-dialog__headerbtn:hover) {
  background: var(--bg-secondary);
}

:deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
</style>
