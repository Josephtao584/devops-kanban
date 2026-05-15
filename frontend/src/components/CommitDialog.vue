<template>
  <BaseDialog
    :model-value="true"
    title="提交更改"
    width="90%"
    :top="top"
    :body-padding="false"
    custom-class="commit-dialog"
    @close="$emit('close')"
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
  </BaseDialog>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import BaseDialog from './BaseDialog.vue'
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
      // Backend returns either { changes, isWorktree, ... } object or legacy array
      const raw = Array.isArray(response.data)
        ? response.data
        : (response.data?.changes || [])
      changes.value = raw.map(c => ({ ...c, selected: true }))
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
</style>
