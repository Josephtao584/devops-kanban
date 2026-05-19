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
          class="suggestion-card"
          :class="{ 'is-disabled': !enabledIndices.has(index), 'is-locked': isLocked(item) }"
        >
          <!-- Top bar: index + dependency chip + delete -->
          <div class="card-topbar">
            <label class="card-checkbox">
              <input
                type="checkbox"
                :checked="enabledIndices.has(index)"
                :disabled="isLocked(item)"
                @change="toggleEnabled(index)"
              />
              <span class="card-index">#{{ index + 1 }}</span>
            </label>
            <el-tag v-if="isLocked(item)" type="success" size="small" class="locked-tag">已创建</el-tag>
            <span v-if="item.depends_on_indices && item.depends_on_indices.length" class="card-chip chip-dep" :title="`依赖: ${dependencyLabel(item)}`">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              {{ dependencyLabel(item) }}
            </span>
            <span class="card-spacer"></span>
            <el-popconfirm
              v-if="!isLocked(item)"
              :title="`确认删除 #${index + 1} ${item.title || '此任务'}？`"
              confirm-button-text="删除"
              cancel-button-text="取消"
              confirm-button-type="danger"
              width="240"
              @confirm="onDelete(index)"
            >
              <template #reference>
                <button class="icon-btn icon-btn-danger" @click.stop title="删除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                  </svg>
                </button>
              </template>
            </el-popconfirm>
          </div>

          <!-- Title -->
          <input
            class="card-title-input"
            :value="item.title"
            :disabled="isLocked(item)"
            @input="updateField(index, 'title', $event.target.value)"
            placeholder="任务标题"
          />

          <!-- Description -->
          <textarea
            class="card-desc-input"
            :value="item.description"
            :disabled="isLocked(item)"
            @input="updateField(index, 'description', $event.target.value)"
            placeholder="任务描述（可选）"
            rows="2"
          ></textarea>

          <!-- Field grid -->
          <div class="card-fields">
            <div class="card-field">
              <span class="field-label">工作空间</span>
              <el-select
                :model-value="workspaceSelectValue(item)"
                size="small"
                class="full-width"
                placeholder="选择工作空间"
                :disabled="isLocked(item)"
                @update:model-value="(val) => onWorkspaceSelect(index, val)"
              >
                <el-option :label="`当前项目（${currentProjectName}）`" value="__current__" />
                <el-option-group v-if="otherProjects.length" label="其他 Coplat 项目">
                  <el-option
                    v-for="p in otherProjects"
                    :key="p.id"
                    :label="p.name"
                    :value="`project:${p.id}`"
                  />
                </el-option-group>
                <el-option label="外部仓库 URL..." value="__external__" />
              </el-select>
            </div>

            <div class="card-field">
              <span class="field-label">
                工作目录
                <button class="field-action" @click.stop="onPreviewPath(index)" title="查看完整路径">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  查看路径
                </button>
              </span>
              <el-input
                :model-value="item.work_dir || ''"
                size="small"
                class="full-width"
                placeholder="留空使用根目录，如 backend"
                :disabled="isLocked(item)"
                @update:model-value="(val) => updateField(index, 'work_dir', val || null)"
              />
            </div>

            <div v-if="item.target_repo_url != null" class="card-field card-field-full">
              <span class="field-label">外部仓库 URL</span>
              <el-input
                :model-value="item.target_repo_url"
                size="small"
                class="full-width"
                placeholder="git@github.com:org/repo.git"
                :disabled="isLocked(item)"
                @update:model-value="(val) => updateField(index, 'target_repo_url', val || null)"
              />
            </div>

            <div class="card-field card-field-full">
              <span class="field-label">AgentTeam 模板</span>
              <el-select
                :model-value="item.template_id || ''"
                size="small"
                class="full-width"
                placeholder="不选则不自动启动"
                clearable
                :disabled="isLocked(item)"
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

            <div class="card-field card-field-full">
              <span class="field-label">依赖任务</span>
              <el-select
                :model-value="item.depends_on_indices || []"
                size="small"
                class="full-width"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择此任务依赖的其他任务（无依赖则可立即启动）"
                :disabled="isLocked(item)"
                @update:model-value="(val) => updateField(index, 'depends_on_indices', val)"
              >
                <el-option
                  v-for="(other, otherIdx) in suggestions"
                  :key="otherIdx"
                  :label="`#${otherIdx + 1} ${other.title || '未命名'}`"
                  :value="otherIdx"
                  :disabled="otherIdx === index"
                />
              </el-select>
            </div>
          </div>

          <!-- Toggle switches -->
          <div class="card-switches">
            <label class="switch-pill" :class="{ active: item.create_worktree !== false, disabled: isLocked(item) }">
              <input
                type="checkbox"
                :checked="item.create_worktree !== false"
                :disabled="isLocked(item)"
                @change="updateField(index, 'create_worktree', $event.target.checked)"
              />
              <span class="switch-knob"></span>
              <span class="switch-label">创建 worktree</span>
            </label>
            <el-tooltip :disabled="!!item.template_id" content="请先选择 AgentTeam 模板" placement="top">
              <label class="switch-pill" :class="{ active: item.template_id != null && item.auto_start !== false, disabled: !item.template_id || isLocked(item) }">
                <input
                  type="checkbox"
                  :checked="(item.template_id != null) && (item.auto_start !== false)"
                  :disabled="!item.template_id || isLocked(item)"
                  @change="updateField(index, 'auto_start', $event.target.checked)"
                />
                <span class="switch-knob"></span>
                <span class="switch-label">自动启动</span>
              </label>
            </el-tooltip>
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

  <el-dialog
    v-model="showPathDialog"
    title="路径预览"
    width="600px"
    align-center
    class="path-preview-dialog"
  >
    <div v-if="pathInfo?.error" class="path-preview-error">
      {{ pathInfo.error }}
    </div>
    <div v-else class="path-preview-content">
      <div class="path-preview-item">
        <span class="path-preview-label">{{ pathInfo.is_external_repo ? '外部仓库缓存' : '项目路径' }}</span>
        <span class="path-preview-value path-preview-mono">{{ pathInfo.project_local_path }}</span>
        <span class="path-preview-status" :class="pathInfo.project_exists ? 'status-ok' : 'status-bad'">
          {{ pathInfo.project_exists ? '✅ 存在' : (pathInfo.is_external_repo ? '⏳ 首次使用时克隆' : '❌ 不存在') }}
        </span>
      </div>
      <div class="path-preview-item">
        <span class="path-preview-label">工作目录</span>
        <span class="path-preview-value path-preview-mono">{{ pathInfo.project_work_path }}</span>
        <span class="path-preview-status" :class="pathInfo.project_work_path_exists ? 'status-ok' : 'status-bad'">
          {{ pathInfo.project_work_path_exists ? '✅ 存在' : '❌ 不存在' }}
        </span>
      </div>
      <div v-if="pathInfo.create_worktree !== false" class="path-preview-hint">
        ℹ️ 已勾选"创建 worktree"，Agent 实际运行时会在该路径的副本（.worktrees/task-N-xxx{{ pathInfo.work_dir ? '/' + pathInfo.work_dir : '' }}）中执行
      </div>
      <div v-else class="path-preview-hint">
        ℹ️ 未勾选"创建 worktree"，Agent 将直接在上述工作目录运行
      </div>
    </div>
    <template #footer>
      <el-button size="small" @click="showPathDialog = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useWorkflowTemplateStore } from '../../stores/workflowTemplateStore.js'
const workflowTemplateStore = useWorkflowTemplateStore()
import { useProjectStore } from '../../stores/projectStore.js'
import { splitSuggestionsApi } from '../../api/splitSuggestions.js'

const projectStore = useProjectStore()

const props = defineProps({
  suggestion: { type: Object, default: null },
  taskId: { type: [String, Number], default: null },
  embedded: { type: Boolean, default: false },
  parentProjectId: { type: [String, Number], default: null },
})

const emit = defineEmits(['update', 'confirm', 'dismiss'])

function isLocked(item) {
  return item?.child_task_id != null
}

const expanded = ref(true)
const showPathDialog = ref(false)
const pathInfo = ref(null)

const suggestions = computed(() => {
  return props.suggestion?.suggestions ?? []
})

const enabledIndices = ref(new Set())
const templates = ref([])

onMounted(async () => {
  try {
    const resp = await workflowTemplateStore.fetchTemplates()
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
    val.suggestions.forEach((s) => {
      if (s.create_worktree === undefined) s.create_worktree = true
      if (s.auto_start === undefined) s.auto_start = true
      if (s.child_task_id === undefined) s.child_task_id = null
    })
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
  const list = suggestions.value.map((s, i) => {
    if (i !== index) return s
    const next = { ...s, [field]: value }
    if (field === 'template_id' && (value === null || value === '')) {
      next.auto_start = false
    }
    return next
  })
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
      create_worktree: true,
      auto_start: true,
      work_dir: null,
      child_task_id: null,
    },
  ]
  emitSuggestions(list)
}

const otherProjects = computed(() =>
  projectStore.projects.filter((p) => p.id !== Number(props.parentProjectId))
)

const currentProjectName = computed(() => {
  const p = projectStore.projects.find((p) => p.id === Number(props.parentProjectId))
  return p?.name || ''
})

const currentProjectLocalPath = computed(() => {
  const p = projectStore.projects.find((p) => p.id === Number(props.parentProjectId))
  return p?.local_path || ''
})

function workspaceSelectValue(item) {
  if (item.linked_project_id != null) return `project:${item.linked_project_id}`
  if (item.target_repo_url != null) return '__external__'
  return '__current__'
}

function onWorkspaceSelect(index, val) {
  if (!props.suggestion) return
  const list = suggestions.value.map((s, i) => {
    if (i !== index) return s
    if (val === '__current__') return { ...s, linked_project_id: null, target_repo_url: null }
    if (val === '__external__') return { ...s, linked_project_id: null, target_repo_url: s.target_repo_url ?? '' }
    if (typeof val === 'string' && val.startsWith('project:')) {
      const projectId = Number(val.slice('project:'.length))
      return { ...s, linked_project_id: projectId, target_repo_url: null }
    }
    return s
  })
  emitSuggestions(list)
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

async function onPreviewPath(index) {
  const item = suggestions.value[index]
  if (!item || !props.suggestion?.id) return
  try {
    const resp = await splitSuggestionsApi.previewPath(props.suggestion.id, {
      title: item.title,
      work_dir: item.work_dir,
      linked_project_id: item.linked_project_id ?? null,
      target_repo_url: item.target_repo_url ?? null,
    })
    if (resp?.success) {
      pathInfo.value = {
        ...resp.data,
        create_worktree: item.create_worktree,
        work_dir: item.work_dir,
      }
      showPathDialog.value = true
    }
  } catch (e) {
    pathInfo.value = { error: '获取路径信息失败' }
    showPathDialog.value = true
  }
}

function onDismiss() {
  emit('dismiss')
}

// Exposed for component tests
defineExpose({ updateField, onAddTask, onWorkspaceSelect })
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

/* ========== Modern Suggestion Card ========== */
.suggestion-card {
  position: relative;
  padding: 14px 16px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  margin-bottom: 10px;
  background: var(--bg-primary);
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
}
.suggestion-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.suggestion-card:last-child {
  margin-bottom: 0;
}
.suggestion-card.is-disabled {
  opacity: 0.5;
  background: var(--bg-secondary);
}

/* Top bar */
.card-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.card-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.card-checkbox input {
  accent-color: var(--accent-color);
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
}
.card-index {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  letter-spacing: 0.3px;
}
.card-spacer {
  flex: 1;
}
.card-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 12px;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-dep {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
  border: 1px solid rgba(217, 119, 6, 0.2);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.15s;
}
.icon-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.icon-btn-danger:hover {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

/* Title and description */
.card-title-input {
  display: block;
  width: 100%;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 4px 0;
  outline: none;
  margin-bottom: 4px;
  font-family: inherit;
}
.card-title-input::placeholder {
  color: var(--text-tertiary);
  font-weight: 400;
}
.card-title-input:focus {
  background: var(--bg-secondary);
  padding: 4px 8px;
}

.card-desc-input {
  display: block;
  width: 100%;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 4px 0;
  resize: vertical;
  font-family: inherit;
  outline: none;
  margin-bottom: 12px;
}
.card-desc-input::placeholder {
  color: var(--text-tertiary);
}
.card-desc-input:focus {
  background: var(--bg-secondary);
  padding: 4px 8px;
}

/* Field grid */
.card-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
  padding: 12px 0;
  border-top: 1px solid var(--border-color);
}
.card-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.card-field-full {
  grid-column: 1 / -1;
}
.field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.field-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  color: var(--accent-color);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}
.field-action:hover {
  background: var(--accent-color-soft, rgba(64, 158, 255, 0.1));
}

.full-width {
  width: 100%;
}

/* Toggle pill switches */
.card-switches {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}
.switch-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px 5px 5px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.18s;
  user-select: none;
  font-size: 12px;
  color: var(--text-secondary);
}
.switch-pill input {
  display: none;
}
.switch-knob {
  position: relative;
  width: 28px;
  height: 16px;
  background: var(--text-tertiary);
  border-radius: 10px;
  flex-shrink: 0;
  transition: background 0.18s;
}
.switch-knob::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.18s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.switch-pill.active {
  border-color: var(--accent-color);
  background: var(--accent-color-soft, rgba(64, 158, 255, 0.08));
  color: var(--accent-color);
}
.switch-pill.active .switch-knob {
  background: var(--accent-color);
}
.switch-pill.active .switch-knob::after {
  transform: translateX(12px);
}
.switch-pill.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.switch-label {
  font-weight: 500;
}

.split-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.split-footer-actions {
  display: flex;
  gap: 8px;
}

.suggestion-card.is-locked {
  background: var(--el-fill-color-lighter, #fafafa);
  border-color: var(--el-border-color-lighter, #e8e8e8);
}
.suggestion-card.is-locked .card-title-input,
.suggestion-card.is-locked .card-desc-input {
  color: var(--el-text-color-secondary, #888);
  background: transparent;
  cursor: not-allowed;
}
.locked-tag {
  margin-left: 4px;
}
</style>

<style>
.path-preview-dialog .el-dialog__body {
  padding: 16px 20px;
}
.path-preview-dialog .path-preview-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.path-preview-dialog .path-preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 6px;
  border: 1px solid var(--border-color, #e4e7ed);
}
.path-preview-dialog .path-preview-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #606266);
  white-space: nowrap;
  min-width: 72px;
}
.path-preview-dialog .path-preview-value {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary, #303133);
  word-break: break-all;
}
.path-preview-dialog .path-preview-mono {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 11.5px;
  background: var(--bg-primary, #fff);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color, #e4e7ed);
}
.path-preview-dialog .path-preview-status {
  font-size: 11px;
  white-space: nowrap;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
}
.path-preview-dialog .path-preview-status.status-ok {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}
.path-preview-dialog .path-preview-status.status-bad {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}
.path-preview-dialog .path-preview-status.status-warn {
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.1);
}
.path-preview-dialog .path-preview-hint {
  font-size: 12px;
  color: var(--text-secondary, #909399);
  padding: 8px 14px;
  background: rgba(230, 162, 60, 0.08);
  border-left: 3px solid #e6a23c;
  border-radius: 4px;
}
.path-preview-dialog .path-preview-error {
  text-align: center;
  padding: 20px;
  color: #f56c6c;
  font-size: 13px;
}
</style>
