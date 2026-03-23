<template>
  <el-dialog
    :model-value="true"
    title="比较分支差异"
    width="600px"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <div class="branch-select-form">
      <div class="form-item">
        <label>源分支（比较的基准）</label>
        <GitBranchSelect
          v-model="sourceBranch"
          :project-id="projectId"
          placeholder="选择源分支"
          :grouped="false"
        />
      </div>

      <div class="form-item">
        <label>目标分支（比较的目标）</label>
        <GitBranchSelect
          v-model="targetBranch"
          :project-id="projectId"
          placeholder="选择目标分支"
          :grouped="false"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('close')">取消</el-button>
        <el-button
          type="primary"
          :disabled="!sourceBranch || !targetBranch"
          @click="handleCompare"
        >
          比较差异
        </el-button>
      </div>
    </template>
  </el-dialog>

  <!-- Diff Viewer Dialog -->
  <DiffViewer
    v-if="showDiff"
    :project-id="projectId"
    :task-id="taskId"
    :source-ref="sourceBranch"
    :target-ref="targetBranch"
    @close="showDiff = false"
  />
</template>

<script setup>
import { ref, watch } from 'vue'
import GitBranchSelect from './GitBranchSelect.vue'
import DiffViewer from './DiffViewer.vue'

const props = defineProps({
  projectId: {
    type: Number,
    required: true
  },
  taskId: {
    type: Number,
    required: true
  },
  worktreeBranch: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

// Source branch: default to master (source repo branch)
const sourceBranch = ref('master')
// Target branch: should be the worktree branch
const targetBranch = ref(props.worktreeBranch || '')
const showDiff = ref(false)

// Watch for worktreeBranch changes
watch(() => props.worktreeBranch, (newVal) => {
  if (newVal) {
    targetBranch.value = newVal
  }
})

const handleCompare = () => {
  if (sourceBranch.value && targetBranch.value) {
    showDiff.value = true
  }
}
</script>

<style scoped>
.branch-select-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-item label {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>