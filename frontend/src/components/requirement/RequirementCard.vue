<template>
  <div
    class="requirement-card"
    :class="{
      'is-converted': requirement.status === 'CONVERTED',
      'is-analyzing': requirement.status === 'ANALYZING'
    }"
  >
    <div class="requirement-header">
      <span class="requirement-priority" :class="priorityClass"></span>
      <h4 class="requirement-title">{{ requirement.title }}</h4>
    </div>

    <div class="requirement-body">
      <p class="requirement-description" :class="{ 'is-truncated': !expanded }">
        {{ requirement.description }}
      </p>
      <button
        v-if="showExpandButton"
        class="expand-btn"
        @click="expanded = !expanded"
      >
        {{ expanded ? $t('common.collapse') : $t('common.expand') }}
      </button>
    </div>

    <div class="requirement-meta">
      <span class="meta-item">
        <span class="meta-label">{{ $t('requirement.source') }}:</span>
        <span class="meta-value">{{ $t(`requirement.sources.${requirement.source}`) }}</span>
      </span>
      <span class="meta-item">
        <span class="meta-label">{{ $t('requirement.priority') }}:</span>
        <span class="meta-value priority-value" :class="priorityClass">
          {{ $t(`priority.${requirement.priority}`) }}
        </span>
      </span>
    </div>

    <div class="requirement-status">
      <span class="status-badge" :class="statusClass">
        {{ $t(`requirement.statuses.${requirement.status}`) }}
      </span>
      <span v-if="requirement.convertedTaskIds?.length > 0" class="task-count">
        {{ $t('requirement.taskCount', { count: requirement.convertedTaskIds.length }) }}
      </span>
    </div>

    <div class="requirement-actions">
      <button
        v-if="requirement.status === 'NEW'"
        class="btn btn-primary btn-sm"
        @click="handleSync"
        :disabled="syncing"
      >
        <svg v-if="syncing" class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        {{ syncing ? $t('requirement.syncing') : $t('requirement.generateTasks') }}
      </button>
      <button
        class="btn btn-secondary btn-sm"
        @click="$emit('edit', requirement)"
        :disabled="requirement.status === 'CONVERTED'"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        {{ $t('common.edit') }}
      </button>
      <button
        class="btn btn-danger btn-sm"
        @click="handleDelete"
        :disabled="requirement.status === 'CONVERTED'"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        {{ $t('common.delete') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { REQUIREMENT_STATUS } from '../../constants/requirement.js'

const props = defineProps({
  requirement: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['sync', 'edit', 'delete', 'generate'])

const expanded = ref(false)
const syncing = ref(false)

const priorityClass = computed(() => {
  return `priority-${(props.requirement.priority || 'MEDIUM').toLowerCase()}`
})

const statusClass = computed(() => {
  const status = props.requirement.status
  return {
    'status-new': status === REQUIREMENT_STATUS.NEW,
    'status-analyzing': status === REQUIREMENT_STATUS.ANALYZING,
    'status-converted': status === REQUIREMENT_STATUS.CONVERTED,
    'status-archived': status === REQUIREMENT_STATUS.ARCHIVED
  }
})

const showExpandButton = computed(() => {
  return props.requirement.description && props.requirement.description.length > 100
})

const handleSync = async () => {
  syncing.value = true
  try {
    await emit('sync', props.requirement)
  } finally {
    syncing.value = false
  }
}

const handleDelete = () => {
  emit('delete', props.requirement)
}
</script>

<style scoped>
.requirement-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-left: 3px solid #f59e0b;
  transition: all 0.2s ease;
}

.requirement-card:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.requirement-card.is-converted {
  border-left-color: #10b981;
  opacity: 0.8;
}

.requirement-card.is-analyzing {
  border-left-color: #3b82f6;
}

.requirement-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.requirement-priority {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.requirement-priority.priority-high {
  background-color: #ef4444;
}

.requirement-priority.priority-medium {
  background-color: #f59e0b;
}

.requirement-priority.priority-low {
  background-color: #6b7280;
}

.requirement-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
  line-height: 1.4;
}

.requirement-body {
  margin-bottom: 8px;
}

.requirement-description {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.requirement-description.is-truncated {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expand-btn {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 11px;
  cursor: pointer;
  padding: 4px 0 0 0;
}

.expand-btn:hover {
  text-decoration: underline;
}

.requirement-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 11px;
}

.meta-item {
  display: flex;
  gap: 4px;
}

.meta-label {
  color: #9ca3af;
}

.meta-value {
  color: #374151;
}

.priority-value.priority-high {
  color: #ef4444;
  font-weight: 600;
}

.priority-value.priority-medium {
  color: #f59e0b;
  font-weight: 600;
}

.priority-value.priority-low {
  color: #6b7280;
}

.requirement-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.status-badge.status-new {
  background-color: #fef3c7;
  color: #92400e;
}

.status-badge.status-analyzing {
  background-color: #dbeafe;
  color: #1e40af;
}

.status-badge.status-converted {
  background-color: #d1fae5;
  color: #065f46;
}

.status-badge.status-archived {
  background-color: #f3f4f6;
  color: #4b5563;
}

.task-count {
  font-size: 11px;
  color: #6b7280;
}

.requirement-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 4px 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.btn-danger {
  background-color: #fef2f2;
  color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background-color: #fee2e2;
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
