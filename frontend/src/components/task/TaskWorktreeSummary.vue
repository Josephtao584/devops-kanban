<template>
  <div class="workflow-section worktree-summary">
    <div class="worktree-summary-header">
      <div class="worktree-summary-header-main">
        <span class="worktree-summary-title">{{ $t('git.worktree', 'Git Worktree') }}</span>
        <span class="worktree-summary-status" :class="worktreeClass">{{ workflowWorktreeStatusText }}</span>
      </div>
      <button
        v-if="task.worktree_status === 'created'"
        class="worktree-summary-delete-btn"
        :disabled="worktreeLoading"
        @click.stop="emit('delete-worktree')"
      >
        {{ $t('git.deleteWorktree', '删除工作树') }}
      </button>
    </div>
    <div v-if="task.worktree_branch" class="worktree-summary-row">
      <span class="worktree-summary-label">{{ $t('git.branch', 'Branch') }}</span>
      <code class="worktree-summary-value worktree-summary-branch">{{ task.worktree_branch }}</code>
    </div>
    <div v-if="task.worktree_path" class="worktree-summary-row">
      <span class="worktree-summary-label">{{ $t('git.path', 'Path') }}</span>
      <span class="worktree-summary-value worktree-summary-path worktree-summary-path-wrap" :title="task.worktree_path">{{ task.worktree_path }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  task: { type: Object, required: true },
  worktreeLoading: { type: Boolean, default: false },
  worktreeClass: { type: String, default: 'worktree-none' },
  workflowWorktreeStatusText: { type: String, default: '' }
})

const emit = defineEmits(['delete-worktree'])
</script>
