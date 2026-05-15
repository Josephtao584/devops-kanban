<template>
  <div class="ai-split-card" :class="{ collapsed: !expanded, 'is-embedded': embedded }">
    <div v-if="!embedded" class="split-card-header" @click="expanded = !expanded">
      <div class="split-header-left">
        <svg class="split-ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.6 4.6a3 3 0 0 0 1.8 1.8L20 11l-4.6 1.6a3 3 0 0 0-1.8 1.8L12 19l-1.6-4.6a3 3 0 0 0-1.8-1.8L4 11l4.6-1.6a3 3 0 0 0 1.8-1.8z"></path>
          <path d="M19 3v3"></path>
          <path d="M20.5 4.5h-3"></path>
          <path d="M5 18v3"></path>
          <path d="M6.5 19.5h-3"></path>
        </svg>
        <h4>AI 拆分建议</h4>
        <span class="split-subtitle">AgentTeam已完成，建议拆分为以下子任务</span>
      </div>
      <div class="split-header-right">
        <span class="split-task-count">{{ suggestions.length }} 个子任务</span>
        <span class="split-toggle" :class="{ open: expanded }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </div>
    </div>

    <div class="split-card-body" v-show="embedded || expanded">
      <div class="split-suggestions-list">
        <div
          v-for="(item, index) in suggestions"
          :key="index"
          class="split-suggestion-item"
        >
          <div class="suggestion-header">
            <div class="suggestion-check">
              <input type="checkbox" :checked="enabledIndices.has(index)" @change="toggleEnabled(index)" />
            </div>
            <div class="suggestion-main">
              <div class="suggestion-title-row">
                <input
                  class="suggestion-title-input"
                  :value="item.title"
                  @input="updateField(index, 'title', $event.target.value)"
                  placeholder="任务标题"
                />
                <el-select
                  :model-value="item.template_id || ''"
                  size="small"
                  class="suggestion-template-select"
                  placeholder="选择AgentTeam模板"
                  clearable
                  @update:model-value="(val) => updateField(index, 'template_id', val || null)"
                >
                  <el-option
                    v-for="tmpl in templates"
                    :key="tmpl.template_id"
                    :label="tmpl.name"
                    :value="tmpl.template_id"
                  />
                </el-select>
              </div>
              <textarea
                class="suggestion-desc-input"
                :value="item.description"
                @input="updateField(index, 'description', $event.target.value)"
                placeholder="任务描述"
                rows="2"
              ></textarea>
            </div>
            <div class="suggestion-actions">
              <el-button size="small" text type="danger" @click.stop="onDelete(index)">删除</el-button>
            </div>
          </div>
          <div class="suggestion-meta">
            <span class="meta-tag repo">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              {{ repoLabel(item) }}
            </span>
            <span class="meta-tag dep" v-if="item.depends_on_indices && item.depends_on_indices.length">
              依赖: {{ dependencyLabel(item) }}
            </span>
            <span class="meta-tag dep-none" v-else>
              依赖: 无
            </span>
          </div>
        </div>
      </div>

      <div class="split-footer">
        <el-button size="small" plain @click="onAddTask">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加任务
        </el-button>
        <div class="split-footer-actions">
          <el-button size="small" @click="onDismiss">取消</el-button>
          <el-button size="small" type="primary" @click="onConfirm">确认创建</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getWorkflowTemplates } from '../../api/workflowTemplate.js'
import { useProjectStore } from '../../stores/projectStore.js'

const projectStore = useProjectStore()

const props = defineProps({
  suggestion: { type: Object, default: null },
  taskId: { type: [String, Number], default: null },
  embedded: { type: Boolean, default: false }
})

const emit = defineEmits(['update', 'confirm', 'dismiss'])

const expanded = ref(true)

const suggestions = computed(() => {
  return props.suggestion?.suggestions ?? []
})

const enabledIndices = ref(new Set())
const templates = ref([])

onMounted(async () => {
  try {
    const resp = await getWorkflowTemplates()
    if (resp?.success) templates.value = resp.data || []
  } catch (e) {
    // silent — dropdown just stays empty
  }
})

// Initialize enabledIndices when suggestion changes. Respect the `enabled`
// flag from the backend payload so we don't accidentally re-enable everything
// on re-renders after a user disabled some items.
watch(() => props.suggestion, (val) => {
  if (val?.suggestions) {
    enabledIndices.value = new Set(
      val.suggestions
        .map((s, i) => (s?.enabled === false ? null : i))
        .filter((i) => i !== null)
    )
  } else {
    enabledIndices.value = new Set()
  }
}, { immediate: true })

function emitSuggestions(list) {
  emit('update', list)
}

function toggleEnabled(index) {
  const next = new Set(enabledIndices.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  enabledIndices.value = next

  if (!props.suggestion) return
  const list = suggestions.value.map((item, i) => ({
    ...item,
    enabled: next.has(i)
  }))
  emitSuggestions(list)
}

function updateField(index, field, value) {
  if (!props.suggestion) return
  const list = suggestions.value.map((s, i) =>
    i === index ? { ...s, [field]: value } : s
  )
  emitSuggestions(list)
}

function onDelete(index) {
  if (!props.suggestion) return
  const list = suggestions.value.filter((_, i) => i !== index)
  // Rebuild depends_on_indices so dangling references don't remain. Any index
  // that pointed at or past the removed slot gets shifted down by one.
  const reindexed = list.map((item) => ({
    ...item,
    depends_on_indices: (item.depends_on_indices || [])
      .filter((idx) => idx !== index)
      .map((idx) => (idx > index ? idx - 1 : idx))
  }))
  emitSuggestions(reindexed)
}

function onAddTask() {
  if (!props.suggestion) return
  const list = [
    ...suggestions.value,
    {
      title: '新任务',
      description: '',
      template_id: null,
      linked_project_id: null,
      target_repo_url: null,
      depends_on_indices: [],
      enabled: true,
    },
  ]
  emitSuggestions(list)
}

function repoLabel(item) {
  if (item.linked_project_id != null) {
    const project = projectStore.projects.find(p => p.id === item.linked_project_id)
    return project ? project.name : `项目 #${item.linked_project_id}`
  }
  if (item.target_repo_url) return item.target_repo_url
  return '当前项目'
}

function dependencyLabel(item) {
  const indices = item.depends_on_indices || []
  if (!indices.length) return '无'
  return indices
    .map((i) => suggestions.value[i]?.title || `#${i}`)
    .join(', ')
}

function onConfirm() {
  emit('confirm')
}

function onDismiss() {
  emit('dismiss')
}
</script>

<style scoped>
.ai-split-card {
  margin: 0;
  border: none;
  border-bottom: 1px solid var(--border-color);
  border-radius: 0;
  background: var(--bg-primary);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  max-height: 320px;
  transition: max-height 0.2s ease;
}

.ai-split-card.is-embedded {
  border: none;
  max-height: none;
  background: transparent;
}

.ai-split-card.collapsed {
  max-height: none;
}

.split-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  background: linear-gradient(135deg, var(--teal-accent-weak), var(--teal-accent-mid));
  position: relative;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.split-card-header:hover {
  background: linear-gradient(135deg, var(--teal-accent-mid), var(--teal-accent-strong));
}

.ai-split-card.collapsed .split-card-header {
  border-bottom: none;
}

.split-card-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent-color);
}

.split-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.split-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.split-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.split-toggle.open {
  transform: rotate(180deg);
}

.split-card-body {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  max-height: 280px;
}

.ai-split-card.is-embedded .split-card-body {
  max-height: none;
  overflow: visible;
}

.split-ai-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-color);
  flex-shrink: 0;
}

.split-card-header h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.split-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

.split-task-count {
  font-size: 11px;
  color: var(--accent-color);
  background: var(--bg-primary);
  border: 1px solid var(--teal-border-soft);
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 600;
}

.split-suggestions-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.split-suggestion-item {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  margin-bottom: 6px;
  background: var(--bg-secondary);
  transition: all 0.15s;
}

.split-suggestion-item:hover {
  border-color: var(--teal-border-soft);
  background: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.split-suggestion-item:last-child {
  margin-bottom: 0;
}

.suggestion-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.suggestion-check input {
  margin: 2px 0 0;
  accent-color: var(--accent-color);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.suggestion-main {
  flex: 1;
  min-width: 0;
}

.suggestion-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.suggestion-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.suggestion-title-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 3px 6px;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}

.suggestion-title-input:hover {
  border-color: var(--border-color);
}

.suggestion-title-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-primary);
}

.suggestion-desc-input {
  width: 100%;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  resize: vertical;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}

.suggestion-desc-input:hover {
  border-color: var(--border-color);
}

.suggestion-desc-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-primary);
}

.suggestion-template-badge {
  font-size: 10px;
  color: var(--accent-color);
  background: var(--accent-color-soft);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.suggestion-template-select {
  width: 180px;
  flex-shrink: 0;
}

.suggestion-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.suggestion-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.suggestion-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 24px;
}

.meta-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
}

.meta-tag.repo {
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}

.meta-tag.dep {
  color: var(--warning-strong);
  background: var(--warning-soft);
  font-family: inherit;
}

.meta-tag.dep-none {
  color: var(--done-strong);
  background: var(--done-soft);
  font-family: inherit;
}

.split-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.split-footer-actions {
  display: flex;
  gap: 6px;
}
</style>
