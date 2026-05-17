<template>
  <BaseDialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="$t('taskSource.previewTitle', '同步预览')"
    width="650px"
    custom-class="sync-preview-dialog"
    append-to-body
  >
    <div v-if="loading && syncPreviewTasks.length === 0 && !syncError" class="sync-preview-loading">
      <span>{{ $t('common.loading', '加载中...') }}</span>
    </div>
    <div v-else-if="syncError" class="sync-preview-error">
      {{ syncError }}
    </div>
    <div v-else>
      <div class="sync-preview-controls">
        <el-button size="small" @click.stop="emit('select-all')">{{ $t('taskSource.selectAll', '全选') }}</el-button>
        <el-button size="small" @click.stop="emit('deselect-all')">{{ $t('taskSource.deselectAll', '取消全选') }}</el-button>
        <span class="selected-count">
          {{ selectedTasks.size }} / {{ syncPreviewTasks.filter(t => !t.imported).length }} {{ $t('taskSource.selected', '已选') }}
        </span>
      </div>
      <div class="sync-preview-list">
        <div
          v-for="task in syncPreviewTasks"
          :key="task.external_id"
          class="sync-preview-item"
          :class="{ selected: selectedTasks.has(task.external_id), imported: task.imported }"
          @click="!task.imported && emit('toggle-task', task)"
        >
          <div class="item-checkbox">
            <input
              type="checkbox"
              :checked="selectedTasks.has(task.external_id)"
              :disabled="task.imported"
              @click.stop="!task.imported && emit('toggle-task', task)"
            />
          </div>
          <div class="item-content">
            <div class="item-header">
              <span class="item-title">{{ task.title }}</span>
              <span class="item-status" :class="task.status?.toLowerCase()">{{ task.status }}</span>
            </div>
            <span v-if="task.imported" class="imported-badge">{{ $t('taskSource.imported', '已导入') }}</span>
            <div class="item-labels" v-if="task.labels && task.labels.length > 0">
              <span v-for="label in task.labels.slice(0, 5)" :key="label" class="label-badge">{{ label }}</span>
            </div>
            <div v-if="task.description" class="item-description-wrapper">
              <div
                :ref="el => setDescriptionRef(el, task.external_id)"
                class="item-description"
                :class="{ expanded: expandedDescriptions.has(task.external_id) }"
                v-html="formatTaskDescription(task.description || '')"
              ></div>
              <button
                v-if="descriptionOverflow(task.external_id) || expandedDescriptions.has(task.external_id)"
                class="description-toggle-btn"
                @click.stop="toggleDescription(task.external_id)"
              >
                {{ expandedDescriptions.has(task.external_id) ? '收起 ↑' : '展开 ↓' }}
              </button>
            </div>
            <div class="item-meta">
              <span class="item-id">#{{ task.external_id }}</span>
              <span class="item-source">{{ task.sourceName }}</span>
              <template v-if="task.external_url && task.external_url.startsWith('file://')">
                <span
                  class="external-link local-path"
                  :title="formatExternalUrl(task.external_url)"
                >
                  {{ formatExternalUrl(task.external_url) }}
                </span>
              </template>
              <a
                v-else-if="task.external_url"
                :href="task.external_url"
                target="_blank"
                class="external-link"
                @click.stop
              >
                {{ $t('taskSource.viewExternalItem', '查看外部条目') }} →
              </a>
            </div>
          </div>
        </div>
        <div v-if="syncPreviewTasks.length === 0" class="sync-preview-empty">
          {{ $t('taskSource.noTasksToImport', '没有可导入的任务') }}
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click.stop="emit('close')">{{ $t('common.cancel', '取消') }}</el-button>
      <el-button
        type="primary"
        @click.stop="emit('confirm-import')"
        :disabled="selectedTasks.size === 0"
      >
        {{ $t('taskSource.confirmImport', '确认导入') }} ({{ selectedTasks.size }})
      </el-button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import BaseDialog from '../BaseDialog.vue'
import { formatTaskDescription } from '../../utils/taskDescriptionFormatter'

const props = defineProps({
  visible: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  syncError: { type: String, default: '' },
  syncPreviewTasks: { type: Array, default: () => [] },
  selectedTasks: { type: Set, default: () => new Set() },
  expandedDescriptions: { type: Set, default: () => new Set() }
})

const emit = defineEmits([
  'update:visible',
  'toggle-task',
  'select-all',
  'deselect-all',
  'confirm-import',
  'close'
])

const descriptionRefs = ref({})
const descriptionOverflowState = ref({})

const setDescriptionRef = (el, externalId) => {
  if (el) {
    descriptionRefs.value[externalId] = el
    nextTick(() => {
      if (el && el.scrollHeight > el.clientHeight + 2) {
        descriptionOverflowState.value[externalId] = true
      }
    })
  }
}

const descriptionOverflow = (externalId) => {
  return !!descriptionOverflowState.value[externalId]
}

const toggleDescription = (externalId) => {
  emit('toggle-description', externalId)
}

const formatExternalUrl = (url) => {
  if (url.startsWith('file://')) return url.replace('file://', '')
  return url
}
</script>

<style scoped>
.sync-preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--text-secondary);
}

.sync-preview-error {
  padding: 20px;
  color: #f56c6c;
  text-align: center;
}

.sync-preview-controls {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color-lightest, #eee);
}

.sync-preview-controls :deep(.el-button) {
  min-height: 28px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
}

.selected-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.sync-preview-list {
  max-height: 400px;
  overflow-y: auto;
}

.sync-preview-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--border-color-lightest, #eee);
}

.sync-preview-item:hover {
  background: var(--bg-secondary);
}

.sync-preview-item.selected {
  background: #ecf5ff;
}

.sync-preview-item.imported {
  opacity: 0.6;
  cursor: not-allowed;
}

.item-checkbox {
  flex-shrink: 0;
  padding-top: 2px;
}

.item-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;
}

.item-status.todo { background: #f4f4f5; color: #909399; }
.item-status.in_progress { background: #fdf6ec; color: #e6a23c; }
.item-status.done { background: #f0f9eb; color: #67c23a; }
.item-status.blocked { background: #fef0f0; color: #f56c6c; }

.imported-badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f0f9eb;
  color: #67c23a;
  margin-bottom: 4px;
}

.item-description {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-description.expanded {
  -webkit-line-clamp: unset;
  max-height: 300px;
  overflow-y: auto;
}

.item-description-wrapper {
  margin-bottom: 4px;
  position: relative;
}

.description-toggle-btn {
  font-size: 11px;
  color: #409eff;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
}

.item-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.label-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #f2f6fc;
  color: var(--text-secondary);
}

.item-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #c0c4cc;
}

.item-id {
  font-family: monospace;
}

.external-link {
  color: #409eff;
  text-decoration: none;
}

.external-link:hover {
  text-decoration: underline;
}

.external-link.local-path {
  color: #909399;
  cursor: default;
  font-family: monospace;
  font-size: 12px;
}

.external-link.local-path:hover {
  text-decoration: none;
}

.sync-preview-empty {
  text-align: center;
  padding: 40px;
  color: #c0c4cc;
}
</style>
