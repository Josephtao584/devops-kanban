<template>
  <div class="task-source-config">
    <div class="header">
      <h1>{{ $t('taskSource.title') }}</h1>
      <button class="btn btn-primary" @click="createNewSource">
        + {{ $t('taskSource.createSource') }}
      </button>
    </div>

    <!-- Project Selector -->
    <div class="project-selector">
      <label for="project">{{ $t('project.selectProject') }}:</label>
      <select id="project" v-model="selectedProjectId" @change="onProjectChange">
        <option value="">-- {{ $t('project.selectProject') }} --</option>
        <option v-for="project in projectStore.projectList" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>

    <!-- Task Sources List -->
    <div class="task-sources-list" v-if="selectedProjectId">
      <div v-if="taskSourceStore.loading" class="loading">{{ $t('common.loading') }}</div>

      <div v-else-if="taskSourceStore.taskSources.length === 0" class="empty-state">
        {{ $t('taskSource.createSource') }}
      </div>

      <div v-else class="sources-grid">
        <div v-for="source in taskSourceStore.taskSources" :key="source.id" class="source-card">
          <div class="source-header">
            <h3>{{ source.name }}</h3>
            <span class="source-type-badge">{{ $t(`taskSource.types.${source.type}`) }}</span>
          </div>

          <div class="source-details">
            <div class="detail-row">
              <span class="label">{{ $t('taskSource.lastSync') }}:</span>
              <span class="value">{{ formatDateTime(source.updated_at || source.last_sync_at) }}</span>
            </div>
          </div>

          <div class="source-actions">
            <button
              class="btn btn-secondary"
              @click="editSource(source)"
            >
              {{ $t('common.edit') }}
            </button>
            <button
              class="btn btn-secondary"
              @click="testConnection(source)"
              :disabled="taskSourceStore.testing === source.id"
            >
              {{ taskSourceStore.testing === source.id ? $t('common.loading') : $t('taskSource.testConnection') }}
            </button>
            <button
              class="btn btn-secondary"
              @click="syncSource(source)"
              :disabled="taskSourceStore.syncing === source.id"
            >
              {{ taskSourceStore.syncing === source.id ? $t('taskSource.syncing') : $t('taskSource.syncNow') }}
            </button>
            <button class="btn btn-danger" @click="confirmDelete(source)">
              {{ $t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="select-project-prompt">
      {{ $t('project.noProject') }}
    </div>

    <!-- Add/Edit Form Modal -->
    <div class="modal-overlay" v-if="showAddForm" @click.self="closeForm">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingSource ? $t('taskSource.editSource') : $t('taskSource.createSource') }}</h2>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Step 1: Select Source Type -->
          <div v-if="!editingSource && formStep === 1" class="step-content">
            <div class="step-title">{{ $t('taskSource.selectSource') || '选择任务源类型' }}</div>
            <div class="source-type-list">
              <div
                v-for="type in availableTypes"
                :key="type.key"
                class="source-type-option"
                :class="{ selected: form.type === type.key }"
                @click="selectType(type.key)"
              >
                <div class="type-info">
                  <div class="type-name">{{ type.name }}</div>
                  <div class="type-desc">{{ type.description }}</div>
                </div>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeForm">
                {{ $t('common.cancel') }}
              </button>
              <button type="button" class="btn btn-primary" @click="goToStep2">
                {{ $t('common.next') }}
              </button>
            </div>
          </div>

          <!-- Step 2: Configure Source -->
          <form v-else @submit.prevent="saveSource" class="step-content">
            <div v-if="!editingSource" class="step-indicator">
              <span class="step-back" @click="formStep = 1">← {{ $t('taskSource.selectSource') || '选择类型' }}</span>
            </div>

            <div class="form-group">
              <label>{{ $t('taskSource.sourceName') }}</label>
              <input v-model="form.name" type="text" required />
            </div>

            <!-- GitHub Config -->
            <template v-if="form.type === 'GITHUB'">
              <div class="form-group">
                <label>
                  {{ $t('taskSource.github.repo') }}
                  <span v-if="inheritedRepo && !allowOverride" class="inherited-badge">{{ $t('taskSource.github.inheritedFromProject') }}</span>
                </label>
                <input
                  v-model="githubConfig.repo"
                  type="text"
                  :placeholder="inheritedRepo && !allowOverride ? '' : $t('taskSource.github.repoHint')"
                  :readonly="inheritedRepo && !allowOverride"
                  :class="{ 'readonly': inheritedRepo && !allowOverride }"
                />
                <span class="hint" v-if="allowOverride || !inheritedRepo">{{ $t('taskSource.github.repoHint') }}</span>
                <label class="checkbox-label" style="margin-top: 0.5rem;">
                  <input type="checkbox" v-model="allowOverride" />
                  {{ $t('taskSource.github.overrideDefault') }}
                </label>
              </div>

              <div class="form-group">
                <label>{{ $t('taskSource.github.token') }}</label>
                <input
                  v-model="githubConfig.token"
                  type="password"
                  :placeholder="$t('taskSource.github.tokenPlaceholder')"
                />
                <span class="hint">{{ $t('taskSource.github.tokenHint') }}</span>
              </div>

              <div class="form-group">
                <label>{{ $t('taskSource.github.state') }}</label>
                <select v-model="githubConfig.state">
                  <option value="open">{{ $t('taskSource.github.stateOpen') }}</option>
                  <option value="closed">{{ $t('taskSource.github.stateClosed') }}</option>
                  <option value="all">{{ $t('taskSource.github.stateAll') }}</option>
                </select>
              </div>
            </template>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" @click="closeForm">
                {{ $t('common.cancel') }}
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? $t('common.loading') : $t('common.save') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>

    <!-- Preview Dialog -->
    <div class="modal-overlay" v-if="taskSourceStore.showPreviewDialog" @click.self="closePreviewDialog">
      <div class="modal preview-modal">
        <div class="modal-header">
          <h2>{{ $t('taskSource.previewTitle') }}</h2>
          <button class="close-btn" @click="closePreviewDialog">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Selection controls -->
          <div class="preview-controls">
            <button class="btn btn-secondary btn-sm" @click="selectAll">{{ $t('taskSource.selectAll') }}</button>
            <button class="btn btn-secondary btn-sm" @click="deselectAll">{{ $t('taskSource.deselectAll') }}</button>
            <span class="selected-count">
              {{ selectedItems.size }} / {{ taskSourceStore.previewItems.filter(i => !i.imported).length }} {{ $t('taskSource.selected') }}
            </span>
          </div>

          <!-- Issues list -->
          <div class="preview-list" v-if="!taskSourceStore.previewLoading">
            <div
              v-for="item in taskSourceStore.previewItems"
              :key="item.external_id"
              class="preview-item"
              :class="{ imported: item.imported, selected: selectedItems.has(item.external_id) }"
              @click="toggleSelection(item)"
            >
              <div class="item-checkbox">
                <input
                  type="checkbox"
                  :checked="selectedItems.has(item.external_id)"
                  :disabled="item.imported"
                  @click.stop="toggleSelection(item)"
                />
              </div>
              <div class="item-content">
                <div class="item-header">
                  <span class="item-title">{{ item.title }}</span>
                  <span v-if="item.imported" class="imported-badge">{{ $t('taskSource.imported') }}</span>
                </div>
                <div class="item-meta">
                  <span class="item-id">#{{ item.external_id }}</span>
                  <span class="item-status" :class="item.status.toLowerCase()">{{ item.status }}</span>
                </div>
                <div class="item-labels" v-if="item.labels && item.labels.length > 0">
                  <span v-for="label in item.labels" :key="label" class="label-badge">{{ label }}</span>
                </div>
                <a
                  v-if="item.external_url"
                  :href="item.external_url"
                  target="_blank"
                  class="external-link"
                  @click.stop
                >
                  {{ $t('taskSource.viewOnGitHub') }} →
                </a>
              </div>
            </div>
          </div>

          <div v-else class="loading">{{ $t('common.loading') }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closePreviewDialog">
            {{ $t('common.cancel') }}
          </button>
          <button
            class="btn btn-primary"
            @click="confirmImport(taskSourceStore.currentTaskSource)"
            :disabled="selectedItems.size === 0"
          >
            {{ $t('taskSource.confirmImport') }} ({{ selectedItems.size }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../stores/projectStore'
import { useTaskSourceStore } from '../stores/taskSourceStore'

const { t } = useI18n()
const projectStore = useProjectStore()
const taskSourceStore = useTaskSourceStore()

const selectedProjectId = ref('')
const saving = ref(false)
const showAddForm = ref(false)
const editingSource = ref(null)
const formStep = ref(2)  // Direct to config step

// Available source types
const availableTypes = [
  {
    key: 'GITHUB',
    name: 'GitHub',
    description: '从 GitHub Issues 同步任务'
  }
]

const form = ref({
  name: '',
  type: 'GITHUB',
  config: JSON.stringify({ repo: '', token: '', state: 'open' })
})

// Inherited repo from project
const inheritedRepo = ref('')
const allowOverride = ref(false)

// GitHub config fields
const githubConfig = ref({
  repo: '',
  token: '',
  state: 'open'
})

// Preview dialog state
const selectedItems = ref(new Set())

const toast = ref({ show: false, message: '', type: 'success' })

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

const loadProjects = async () => {
  try {
    await projectStore.fetchProjects()
    if (projectStore.projectList.length > 0) {
      selectedProjectId.value = projectStore.projectList[0].id
      await taskSourceStore.fetchTaskSources(selectedProjectId.value)
    }
  } catch (e) {
    console.error('Failed to load projects:', e)
  }
}

const onProjectChange = async () => {
  if (selectedProjectId.value) {
    await taskSourceStore.fetchTaskSources(selectedProjectId.value)
  } else {
    taskSourceStore.clearTaskSources()
  }
}

const saveSource = async () => {
  saving.value = true
  try {
    // Use inherited repo if override is not enabled
    if (!allowOverride.value && inheritedRepo.value) {
      githubConfig.value.repo = inheritedRepo.value
    }

    const data = {
      name: form.value.name,
      type: form.value.type,
      project_id: selectedProjectId.value,
      config: githubConfig.value
    }

    if (editingSource.value) {
      await taskSourceStore.updateTaskSource(editingSource.value.id, data)
    } else {
      await taskSourceStore.createTaskSource(data)
    }
    closeForm()
    showToast(t('messages.saved', { name: t('taskSource.title') }))
  } catch (e) {
    console.error('Failed to save:', e)
    showToast(t('messages.saveFailed', { name: t('taskSource.title') }), 'error')
  } finally {
    saving.value = false
  }
}

const testConnection = async (source) => {
  const success = await taskSourceStore.testConnection(source.id)
  showToast(
    success ? t('taskSource.connectionSuccess') : t('taskSource.connectionFailed'),
    success ? 'success' : 'error'
  )
}

const toggleSelection = (item) => {
  if (item.imported) return
  const key = item.external_id
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  } else {
    selectedItems.value.add(key)
  }
  selectedItems.value = new Set(selectedItems.value)
}

const selectAll = () => {
  taskSourceStore.previewItems.forEach(item => {
    if (!item.imported) {
      selectedItems.value.add(item.external_id)
    }
  })
  selectedItems.value = new Set(selectedItems.value)
}

const deselectAll = () => {
  selectedItems.value.clear()
  selectedItems.value = new Set(selectedItems.value)
}

const syncSource = async (source) => {
  // First preview the issues
  await taskSourceStore.previewSync(source.id)
}

const confirmImport = async (source) => {
  const selectedArray = taskSourceStore.previewItems.filter(
    item => selectedItems.value.has(item.external_id)
  )

  if (selectedArray.length === 0) {
    showToast(t('taskSource.selectAtLeastOne'), 'error')
    return
  }

  try {
    const result = await taskSourceStore.importSelectedIssues(
      source.id,
      selectedArray,
      selectedProjectId.value
    )
    showToast(t('taskSource.importSuccess', { count: result.created }))
    selectedItems.value = new Set()
  } catch (e) {
    showToast(t('taskSource.importFailed'), 'error')
  }
}

const closePreviewDialog = () => {
  taskSourceStore.closePreviewDialog()
  selectedItems.value = new Set()
}

const confirmDelete = async (source) => {
  if (!confirm(t('common.delete') + '?')) return
  try {
    await taskSourceStore.deleteTaskSource(source.id)
    showToast(t('messages.deleted', { name: t('taskSource.title') }))
  } catch (e) {
    showToast(t('messages.deleteFailed', { name: t('taskSource.title') }), 'error')
  }
}

const createNewSource = () => {
  editingSource.value = null
  formStep.value = 1
  form.value = { name: '', type: 'GITHUB', config: JSON.stringify({ repo: '', token: '', state: 'open' }) }
  githubConfig.value = { repo: '', token: '', state: 'open' }
  inheritedRepo.value = ''
  allowOverride.value = false

  // Auto-fill repo from project if available
  if (selectedProjectId.value) {
    const project = projectStore.projectList.find(p => p.id === selectedProjectId.value)
    if (project && (project.gitUrl || project.git_url || project.repository_url)) {
      inheritedRepo.value = project.gitUrl || project.git_url || project.repository_url
      githubConfig.value.repo = inheritedRepo.value
    }
  }

  showAddForm.value = true
}

const selectType = (type) => {
  form.value.type = type
}

const goToStep2 = () => {
  if (form.value.type) {
    formStep.value = 2
  }
}

const editSource = (source) => {
  editingSource.value = source
  formStep.value = 2  // Edit goes directly to config step
  form.value = {
    name: source.name,
    type: source.type || 'GITHUB',
    config: source.config || '{}'
  }
  // Parse existing config
  try {
    const config = JSON.parse(source.config || '{}')
    githubConfig.value = {
      repo: config.repo || '',
      token: config.token || '',
      state: config.state || 'open'
    }
  } catch (e) {
    githubConfig.value = { repo: '', token: '', state: 'open' }
  }

  // For editing, show the inherited value for reference
  if (selectedProjectId.value) {
    const project = projectStore.projectList.find(p => p.id === selectedProjectId.value)
    if (project && (project.gitUrl || project.git_url || project.repository_url)) {
      inheritedRepo.value = project.gitUrl || project.git_url || project.repository_url
    }
  }

  showAddForm.value = true
}

const closeForm = () => {
  showAddForm.value = false
  editingSource.value = null
  formStep.value = 2
  inheritedRepo.value = ''
  allowOverride.value = false
  form.value = { name: '', type: 'GITHUB', config: JSON.stringify({ repo: '', token: '', state: 'open' }) }
  githubConfig.value = { repo: '', token: '', state: 'open' }
}

// Sync githubConfig to form.config
watch(githubConfig, (newConfig) => {
  form.value.config = JSON.stringify(newConfig)
}, { deep: true })

// Watch for project changes to update inherited repo
watch(selectedProjectId, async (newProjectId) => {
  inheritedRepo.value = ''
  if (newProjectId && !showAddForm.value) {
    const project = projectStore.projectList.find(p => p.id === newProjectId)
    if (project && (project.gitUrl || project.git_url || project.repository_url)) {
      inheritedRepo.value = project.gitUrl || project.git_url || project.repository_url
    }
  }
})

onMounted(loadProjects)
</script>

<style scoped>
.task-source-config {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.header h1 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.project-selector {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-primary);
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.project-selector label {
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 12px;
  margin: 0;
  white-space: nowrap;
}

.project-selector select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  min-width: 200px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.project-selector select:hover {
  border-color: var(--accent-color);
}

.project-selector select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.loading, .empty-state, .select-project-prompt {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 13px;
  background: var(--bg-secondary);
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
}

.source-card {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
  position: relative;
}

.source-card:hover {
  border-color: var(--accent-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.source-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.source-type-badge {
  background: var(--accent-color);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.source-details {
  margin-bottom: 10px;
  background: var(--bg-tertiary);
  padding: 8px;
  border-radius: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
  padding: 2px 0;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-row .label {
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-row .value {
  color: var(--text-primary);
  font-weight: 500;
}

.source-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.2s;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.modal-body {
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input:hover,
.form-group select:hover,
.form-group textarea:hover {
  border-color: var(--border-color);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.form-group input.readonly,
.form-group input[readonly] {
  background: var(--bg-secondary);
  cursor: not-allowed;
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.form-group .hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
}

.inherited-badge {
  font-size: 11px;
  color: #10b981;
  font-weight: 500;
  margin-left: 6px;
  padding: 2px 8px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  margin-right: 6px;
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 10px 16px;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toast.success {
  background: #10b981;
}

.toast.error {
  background: #ef4444;
}

/* Scrollbar styling */
.modal::-webkit-scrollbar {
  width: 8px;
}

.modal::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 0 8px 8px 0;
}

.modal::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

.modal::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

/* Preview Modal Styles */
.preview-modal {
  max-width: 700px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.preview-controls .btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.selected-count {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-list {
  max-height: 400px;
  overflow-y: auto;
}

.preview-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-item:hover:not(.imported) {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
}

.preview-item.selected {
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.05);
}

.preview-item.imported {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--bg-tertiary);
}

.item-checkbox {
  flex-shrink: 0;
  padding-top: 2px;
}

.item-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent-color);
}

.item-checkbox input:disabled {
  cursor: not-allowed;
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
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.imported-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: #10b981;
  color: white;
  border-radius: 4px;
}

.item-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.item-status {
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.item-status.todo {
  background: #fef3c7;
  color: #92400e;
}

.item-status.done {
  background: #d1fae5;
  color: #065f46;
}

.item-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.label-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 3px;
}

.external-link {
  font-size: 11px;
  color: var(--accent-color);
  text-decoration: none;
}

.external-link:hover {
  text-decoration: underline;
}

/* Two-step form styles */
.step-content {
  min-height: 300px;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  text-align: center;
}

.step-indicator {
  margin-bottom: 12px;
}

.step-back {
  font-size: 13px;
  color: var(--accent-color);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.step-back:hover {
  text-decoration: underline;
}

.source-type-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.source-type-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.source-type-option:hover {
  border-color: var(--accent-color);
  background: var(--bg-secondary);
}

.source-type-option.selected {
  border-color: var(--accent-color);
  background: rgba(99, 102, 241, 0.05);
}

.type-info {
  flex: 1;
}

.type-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.type-desc {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
