<template>
  <div
    class="requirement-card"
    :class="{
      'is-converted': requirement.status === 'CONVERTED',
      'is-selected': isSelected
    }"
  >
    <div class="requirement-header">
      <div class="header-left">
        <h4 class="requirement-title">{{ requirement.title }}</h4>
      </div>
      <div class="header-right">
        <span class="status-badge" :class="statusClass">
          {{ $t(`requirement.statuses.${requirement.status}`) }}
        </span>
        <span class="priority-badge" :class="priorityClass">
          {{ $t(`priority.${requirement.priority}`) }}
        </span>
      </div>
    </div>

    <div class="requirement-body">
      <div v-if="requirement.source" class="requirement-source">
        <span class="source-badge">{{ sourceLabel }}</span>
      </div>
      <div v-if="requirement.labels && requirement.labels.length > 0" class="requirement-labels">
        <el-tag
          v-for="label in requirement.labels"
          :key="label"
          size="small"
          type="info"
          class="requirement-label"
        >
          {{ label }}
        </el-tag>
      </div>
      <p v-if="requirement.description" class="requirement-description" :class="{ 'is-truncated': !expanded }">
        <span class="desc-label">描述:</span> {{ requirement.description }}
      </p>
      <div v-if="isExternal" class="requirement-meta">
        <a
          v-if="requirement.external_url"
          :href="requirement.external_url"
          target="_blank"
          class="external-link"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          {{ $t('requirement.viewOriginal') }}
        </a>
        <span v-if="requirement.created_at" class="meta-time">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          {{ formatDate(requirement.created_at) }}
        </span>
      </div>
      <button
        v-if="showExpandButton"
        class="expand-btn"
        @click="expanded = !expanded"
      >
        {{ expanded ? $t('common.collapse') : $t('common.expand') }}
      </button>
    </div>

    <div class="requirement-actions">
      <button
        class="btn btn-secondary btn-sm"
        @click="$emit('edit', requirement)"
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
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['edit', 'delete'])

const expanded = ref(false)

const priorityClass = computed(() => {
  return `priority-${(props.requirement.priority || 'MEDIUM').toLowerCase()}`
})

const statusClass = computed(() => {
  const status = props.requirement.status
  return {
    'status-new': status === REQUIREMENT_STATUS.NEW,
    'status-converted': status === REQUIREMENT_STATUS.CONVERTED
  }
})

const showExpandButton = computed(() => {
  return props.requirement.description && props.requirement.description.length > 100
})

// Check if requirement is from external source
const isExternal = computed(() => {
  return !!props.requirement.source
})

// Get source type display label
const sourceLabel = computed(() => {
  const labelMap = {
    GITHUB: 'GitHub',
    JIRA: 'Jira',
    GITLAB: 'GitLab',
    LINEAR: 'Linear'
  }
  return labelMap[props.requirement.source] || props.requirement.source
})

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

const handleDelete = () => {
  emit('delete', props.requirement)
}
</script>

<style scoped>
.requirement-card {
  background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%);
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-left: 4px solid #6366f1;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* Subtle pattern overlay */
.requirement-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
  pointer-events: none;
}

.requirement-card:hover {
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}

.requirement-card.is-converted {
  border-left-color: #10b981;
  opacity: 0.85;
  background: linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%);
  border-color: rgba(16, 185, 129, 0.2);
}

.requirement-card.is-selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2), 0 2px 8px rgba(99, 102, 241, 0.15);
}

.requirement-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.header-left {
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.requirement-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
  line-height: 1.4;
  text-align: left;
  word-break: break-word;
}

.priority-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.priority-badge.priority-critical {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.priority-badge.priority-high {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.priority-badge.priority-medium {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.priority-badge.priority-low {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
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

.requirement-source {
  margin-bottom: 6px;
}

.source-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}

.requirement-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.requirement-label {
  font-size: 10px;
  padding: 0 4px;
}

.requirement-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 11px;
  color: #6b7280;
}

.external-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #3b82f6;
  text-decoration: none;
}

.external-link:hover {
  text-decoration: underline;
}

.meta-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.requirement-description {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.desc-label {
  color: #9ca3af;
  font-size: 11px;
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

.status-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 6px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.status-badge.status-new {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
}

.status-badge.status-converted {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #065f46;
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
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
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
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
  transform: translateY(-1px);
}

.btn-secondary {
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.btn-danger {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #991b1b;
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
  transform: translateY(-1px);
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
