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
      <GitDiffViewer
        :file-items="fileItems"
        :diffs-by-path="diffData?.diffs || {}"
        :loading="diffLoading"
        :selected-file-path="selectedFile"
        :selectable="true"
        title="代码差异"
        @update:selected-file-path="handleViewerFileSelect"
        @toggle-file="toggleFileByPath"
        @select-all="selectAll"
        @deselect-all="deselectAll"
      />
    </div>

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
import GitDiffViewer from './GitDiffViewer.vue'
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
  message: ''
})

const fileMetaByPath = computed(() => {
  const entries = diffData.value?.files || []
  return entries.reduce((acc, file) => {
    acc[file.path] = file
    return acc
  }, {})
})

const fileItems = computed(() => changes.value.map(file => {
  const normalizedStatus = ['modified', 'added', 'deleted', 'untracked'].includes(file.status)
    ? file.status
    : 'modified'
  const meta = fileMetaByPath.value[file.path]
  return {
    path: file.path,
    displayName: file.path.replace(/\/+$/, '').split('/').pop() || file.path,
    status: normalizedStatus,
    additions: meta?.additions || 0,
    deletions: meta?.deletions || 0,
    selected: !!file.selected
  }
}))

const selectedCount = computed(() => changes.value.filter(c => c.selected).length)

const toggleFile = (file) => {
  file.selected = !file.selected
}

const toggleFileByPath = (path) => {
  const file = changes.value.find(entry => entry.path === path)
  if (!file) return
  toggleFile(file)
}

const selectFile = async (file) => {
  if (!file || selectedFile.value === file.path) return
  selectedFile.value = file.path
}

const handleViewerFileSelect = async (path) => {
  const file = changes.value.find(entry => entry.path === path)
  if (!file) return
  await selectFile(file)
}

const loadDiff = async () => {
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
      if (changes.value.length > 0) {
        selectedFile.value = changes.value[0].path
      }
      await loadDiff()
    }
  } catch (e) {
    console.error('Failed to load changes:', e)
  }
}

const selectAll = () => {
  changes.value.forEach(c => {
    c.selected = true
  })
}

const deselectAll = () => {
  changes.value.forEach(c => {
    c.selected = false
  })
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
.dialog-body-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
  background: #fff;
}

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
