<template>
  <el-dialog
    :model-value="true"
    title="代码变更"
    width="90%"
    top="5vh"
    :close-on-click-modal="false"
    @close="$emit('close')"
    class="diff-viewer-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <span>代码变更</span>
        <div class="branch-info">
          <el-tag type="info">当前工作区</el-tag>
          <el-icon><Right /></el-icon>
          <el-tag type="success">{{ targetRef }}</el-tag>
        </div>
      </div>
    </template>

    <div class="dialog-body-wrapper">
      <div v-if="loading" class="loading-container">
        <el-skeleton :rows="10" animated />
      </div>

      <el-empty v-else-if="!diffData?.files?.length" description="No changes to display" />

      <div v-else class="diff-container">
        <div class="diff-stats">
          <el-tag type="success">
            <el-icon><Plus /></el-icon>
            +{{ totalAdditions }}
          </el-tag>
          <el-tag type="danger">
            <el-icon><Minus /></el-icon>
            -{{ totalDeletions }}
          </el-tag>
          <el-tag type="info">
            {{ diffData.files.length }} 个文件变更
          </el-tag>
        </div>

        <div class="diff-panels">
          <!-- Left panel: File list -->
          <div class="file-list-panel">
            <el-scrollbar height="55vh">
              <el-menu
                :default-active="selectedFile"
                @select="handleFileSelect"
              >
                <el-menu-item
                  v-for="file in diffData.files"
                  :key="file.path"
                  :index="file.path"
                  class="file-menu-item"
                >
                  <div class="file-item-content">
                    <span class="file-name" :title="file.path">{{ file.path }}</span>
                    <div class="file-stats">
                      <span v-if="file.additions > 0" class="stat-additions">+{{ file.additions }}</span>
                      <span v-if="file.deletions > 0" class="stat-deletions">-{{ file.deletions }}</span>
                      <el-tag
                        :type="getStatusType(file.status)"
                        size="small"
                        class="status-tag"
                      >
                        {{ getStatusLabel(file.status) }}
                      </el-tag>
                    </div>
                  </div>
                </el-menu-item>
              </el-menu>
            </el-scrollbar>
          </div>

          <!-- Right panel: Diff content -->
          <div class="diff-content-panel">
            <el-scrollbar height="55vh">
              <div class="diff-view">
                <div
                  v-for="(line, index) in parsedDiff"
                  :key="index"
                  :class="['diff-line', line.type]"
                >
                  <span class="line-number">{{ line.lineNumber || '' }}</span>
                  <span class="line-prefix">{{ line.prefix }}</span>
                  <span class="line-content">{{ line.content }}</span>
                </div>
                <div v-if="!parsedDiff.length" class="no-diff">
                  Select a file to view changes
                </div>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')">Close</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Right, Plus, Minus } from '@element-plus/icons-vue'
import { getDiff } from '../api/git'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  taskId: {
    type: Number,
    required: true
  },
  targetRef: {
    type: String,
    default: ''
  }
})

defineEmits(['close'])

const loading = ref(true)
const diffData = ref(null)
const selectedFile = ref('')

const totalAdditions = computed(() => {
  if (!diffData.value?.files) return 0
  return diffData.value.files.reduce((sum, f) => sum + f.additions, 0)
})

const totalDeletions = computed(() => {
  if (!diffData.value?.files) return 0
  return diffData.value.files.reduce((sum, f) => sum + f.deletions, 0)
})

const parsedDiff = computed(() => {
  if (!selectedFile.value || !diffData.value?.diffs) return []

  const diffContent = diffData.value.diffs[selectedFile.value]
  if (!diffContent) return []

  const lines = diffContent.split('\n')
  const result = []
  let oldLineNum = 0
  let newLineNum = 0

  for (const line of lines) {
    if (line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ')) {
      if (line.startsWith('--- ') || line.startsWith('+++ ')) {
        result.push({
          type: 'header',
          lineNumber: '',
          prefix: '',
          content: line
        })
      }
      continue
    }

    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
      if (match) {
        oldLineNum = parseInt(match[1])
        newLineNum = parseInt(match[2])
      }
      result.push({
        type: 'hunk',
        lineNumber: '',
        prefix: '',
        content: line
      })
      continue
    }

    if (line.startsWith('+')) {
      result.push({
        type: 'addition',
        lineNumber: newLineNum++,
        prefix: '+',
        content: line.substring(1)
      })
    } else if (line.startsWith('-')) {
      result.push({
        type: 'deletion',
        lineNumber: oldLineNum++,
        prefix: '-',
        content: line.substring(1)
      })
    } else if (line.startsWith(' ')) {
      result.push({
        type: 'context',
        lineNumber: newLineNum++,
        prefix: ' ',
        content: line.substring(1)
      })
    } else if (line.trim()) {
      result.push({
        type: 'other',
        lineNumber: '',
        prefix: '',
        content: line
      })
    }
  }

  return result
})

const getStatusType = (status) => {
  const types = {
    added: 'success',
    modified: 'warning',
    deleted: 'danger',
    untracked: 'success'
  }
  return types[status] || 'info'
}

const getStatusLabel = (status) => {
  const labels = {
    added: 'A',
    modified: 'M',
    deleted: 'D',
    untracked: 'U'
  }
  return labels[status] || '?'
}

const handleFileSelect = (filePath) => {
  selectedFile.value = filePath
}

onMounted(async () => {
  await loadDiff()
})

const loadDiff = async () => {
  loading.value = true
  try {
    const response = await getDiff(props.projectId, props.taskId)
    if (response.success) {
      diffData.value = response.data
      if (diffData.value.files?.length > 0) {
        selectedFile.value = diffData.value.files[0].path
      }
    }
  } catch (e) {
    console.error('Failed to load diff:', e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ==================== Dialog Header ==================== */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  flex-shrink: 0;
}

.branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.branch-info .el-tag {
  font-weight: 500;
  border-radius: 6px;
}

/* ==================== Loading ==================== */
.loading-container {
  padding: 20px;
}

/* ==================== Dialog Body Wrapper ==================== */
.dialog-body-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 24px;
  background: var(--bg-primary);
  height: 100%;
}

/* ==================== Diff Container ==================== */
.diff-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.diff-stats {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
  border-bottom: 1px solid var(--border-color);
}

.diff-stats .el-tag {
  border-radius: 6px;
  font-weight: 500;
  padding: 4px 10px;
}

/* ==================== Diff Panels ==================== */
.diff-panels {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
}

.file-list-panel {
  width: 35%;
  min-width: 280px;
  border-right: 1px solid var(--border-color);
  background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.file-list-panel :deep(.el-menu) {
  border-right: none;
  background: transparent;
}

.file-menu-item {
  height: auto !important;
  padding: 12px 16px !important;
  line-height: 1.4;
  border-radius: 8px !important;
  margin: 4px 8px !important;
  border: 1px solid transparent !important;
  transition: all 0.2s ease !important;
}

.file-menu-item:hover {
  background: var(--bg-secondary) !important;
  border-color: var(--border-color) !important;
}

.file-menu-item.is-active {
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important;
  border-color: var(--accent-color) !important;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.15) !important;
}

.file-item-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  overflow: hidden;
}

.file-name {
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.file-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.stat-additions {
  color: var(--el-color-success);
  font-weight: 600;
  background: var(--el-color-success-light-9);
  padding: 2px 6px;
  border-radius: 4px;
}

.stat-deletions {
  color: var(--el-color-danger);
  font-weight: 600;
  background: var(--el-color-danger-light-9);
  padding: 2px 6px;
  border-radius: 4px;
}

.status-tag {
  font-size: 10px !important;
  padding: 0 6px !important;
  height: 18px !important;
  line-height: 18px !important;
  border-radius: 4px !important;
  font-weight: 600 !important;
}

/* ==================== Diff Content Panel ==================== */
.diff-content-panel {
  flex: 1;
  min-width: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.diff-view {
  padding: 0;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.diff-line {
  display: flex;
  padding: 2px 20px;
  white-space: pre;
  transition: background 0.15s ease;
  border-left: 3px solid transparent;
}

.diff-line:hover {
  filter: brightness(0.97);
}

.diff-line.addition {
  background-color: rgba(34, 197, 94, 0.12);
  border-left: 3px solid #22c55e;
}

.diff-line.deletion {
  background-color: rgba(239, 68, 68, 0.12);
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

.line-number {
  width: 45px;
  text-align: right;
  padding-right: 12px;
  color: var(--text-muted);
  user-select: none;
  flex-shrink: 0;
  font-size: 11px;
}

.line-prefix {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 600;
}

.diff-line.addition .line-prefix {
  color: #16a34a;
}

.diff-line.deletion .line-prefix {
  color: #dc2626;
}

.diff-line.hunk .line-prefix {
  color: #6366f1;
}

.line-content {
  flex: 1;
  overflow-x: auto;
}

.no-diff {
  padding: 60px 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

/* ==================== Dialog Footer ==================== */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 0;
}

.dialog-footer .el-button {
  border-radius: 8px;
  font-weight: 500;
  padding: 10px 18px;
  transition: all 0.2s ease;
}

/* ==================== Dialog Global Overrides ==================== */
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