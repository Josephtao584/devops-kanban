<template>
  <DiffViewer
    :project-id="projectId"
    :task-id="taskId"
    :target-ref="worktreeBranch || '当前任务分支'"
    @close="$emit('close')"
  />
</template>

<script setup>
import DiffViewer from './DiffViewer.vue'

defineProps({
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

defineEmits(['close'])
</script>
