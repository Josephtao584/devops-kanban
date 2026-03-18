<template>
  <div class="action-buttons" :class="{ 'small': size === 'small' }">
    <!-- Edit button -->
    <el-tooltip :content="editTooltip" placement="top">
      <button
        class="btn btn-icon action-btn"
        @click.stop="handleEdit"
        :title="editTooltip"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    </el-tooltip>
    <!-- Delete button -->
    <el-tooltip :content="deleteTooltip" placement="top">
      <button
        class="btn btn-icon action-btn delete-btn"
        @click.stop="handleDelete"
        :title="deleteTooltip"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </el-tooltip>
  </div>
</template>

<script setup>
const props = defineProps({
  size: {
    type: String,
    default: 'default', // 'small' | 'default' | 'large'
    validator: (value) => ['small', 'default', 'large'].includes(value)
  },
  editTooltip: {
    type: String,
    default: 'Edit'
  },
  deleteTooltip: {
    type: String,
    default: 'Delete'
  },
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete'])

const handleEdit = () => {
  emit('edit', props.item)
}

const handleDelete = () => {
  emit('delete', props.item)
}
</script>

<style scoped>
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-buttons.small {
  gap: 2px;
}

/* Default size */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}

.action-btn svg {
  width: 14px;
  height: 14px;
}

.action-btn:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.action-btn.delete-btn:hover {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* Small size */
.action-buttons.small .action-btn {
  width: 24px;
  height: 24px;
}

.action-buttons.small .action-btn svg {
  width: 12px;
  height: 12px;
}

/* Large size */
.action-buttons:not(.small) .action-btn {
  width: 32px;
  height: 32px;
}

.action-buttons:not(.small) .action-btn svg {
  width: 16px;
  height: 16px;
}
</style>