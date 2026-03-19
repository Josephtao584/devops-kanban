<template>
  <el-dialog
    :model-value="true"
    title="Code Changes"
    width="90%"
    top="5vh"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <template #header>
      <div class="dialog-header">
        <span>Code Changes</span>
        <div class="branch-info">
          <el-tag type="info">{{ sourceRef }}</el-tag>
          <el-icon><Right /></el-icon>
          <el-tag type="success">{{ targetRef }}</el-tag>
        </div>
      </div>
    </template>

    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="10" animated />
    </div>

    <el-empty v-else-if="!diffData?.files?.length" description="No changes to display" />

    <div v-else class="diff-container">
      <div class="diff-stats">
        <el-tag type="success">
          <el-icon><Plus /></el-icon>
          {{ totalAdditions }} additions
        </el-tag>
        <el-tag type="danger">
          <el-icon><Minus /></el-icon>
          {{ totalDeletions }} deletions
        </el-tag>
        <el-tag type="info">
          {{ diffData.files.length }} files changed
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

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')">Close</el-button>
        <el-button type="warning" @click="$emit('reject')">
          <el-icon><Close /></el-icon>
          Reject Changes
        </el-button>
        <el-button type="success" @click="$emit('accept')">
          <el-icon><Check /></el-icon>
          Accept Changes
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Right, Plus, Minus, Check, Close } from '@element-plus/icons-vue'
import axios from 'axios'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  taskId: {
    type: Number,
    required: true
  },
  sourceRef: {
    type: String,
    required: true
  },
  targetRef: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close', 'accept', 'reject'])

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
    // Skip header lines
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
      // Parse hunk header like @@ -1,5 +1,7 @@
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
      // Other lines (like file mode changes)
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
    deleted: 'danger'
  }
  return types[status] || 'info'
}

const getStatusLabel = (status) => {
  const labels = {
    added: 'A',
    modified: 'M',
    deleted: 'D'
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
    const response = await axios.get(`/api/tasks/${props.taskId}/worktree/diff`, {
      params: {
        projectId: props.projectId,
        source: props.sourceRef,
        target: props.targetRef
      }
    })
    if (response.data.success) {
      diffData.value = response.data.data
      // Select first file by default
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
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-container {
  padding: 20px;
}

.diff-container {
  background: var(--el-bg-color-page);
  border-radius: 8px;
  overflow: hidden;
}

.diff-stats {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.diff-panels {
  display: flex;
  height: 60vh;
}

.file-list-panel {
  width: 35%;
  min-width: 250px;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.file-list-panel :deep(.el-menu) {
  border-right: none;
}

.file-menu-item {
  height: auto !important;
  padding: 10px 16px !important;
  line-height: 1.4;
}

.file-item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  overflow: hidden;
}

.file-name {
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.stat-additions {
  color: #67c23a;
  font-weight: 500;
}

.stat-deletions {
  color: #f56c6c;
  font-weight: 500;
}

.status-tag {
  font-size: 10px !important;
  padding: 0 4px !important;
  height: 18px !important;
  line-height: 18px !important;
}

.diff-content-panel {
  flex: 1;
  min-width: 0;
}

.diff-view {
  padding: 0;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.diff-line {
  display: flex;
  padding: 1px 8px;
  white-space: pre;
}

.diff-line.addition {
  background-color: rgba(103, 194, 58, 0.15);
}

.diff-line.deletion {
  background-color: rgba(245, 108, 108, 0.15);
}

.diff-line.hunk {
  background-color: rgba(64, 158, 255, 0.15);
  color: #409eff;
  font-weight: 500;
}

.diff-line.header {
  color: #909399;
  font-style: italic;
}

.line-number {
  width: 40px;
  text-align: right;
  padding-right: 12px;
  color: #909399;
  user-select: none;
  flex-shrink: 0;
}

.line-prefix {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  font-weight: 600;
}

.diff-line.addition .line-prefix {
  color: #67c23a;
}

.diff-line.deletion .line-prefix {
  color: #f56c6c;
}

.line-content {
  flex: 1;
  overflow-x: auto;
}

.no-diff {
  padding: 40px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>