<template>
  <div class="task-source-config">
    <div class="header">
      <h1>{{ $t('taskSource.title') }}</h1>
      <button class="btn btn-primary" @click="showAddForm = true">
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
              <span class="label">{{ $t('taskSource.syncInterval') }}:</span>
              <span class="value">{{ source.syncInterval }} min</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('taskSource.lastSync') }}:</span>
              <span class="value">{{ formatDateTime(source.lastSyncAt) }}</span>
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
          <form @submit.prevent="saveSource">
            <div class="form-group">
              <label>{{ $t('taskSource.sourceName') }}</label>
              <input v-model="form.name" type="text" required />
            </div>

            <div class="form-group">
              <label>{{ $t('taskSource.github.repo') }}</label>
              <input
                v-model="githubConfig.repo"
                type="text"
                :placeholder="$t('taskSource.github.repoHint')"
              />
              <span class="hint">{{ $t('taskSource.github.repoHint') }}</span>
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

            <div class="form-group">
              <label>{{ $t('taskSource.syncInterval') }}</label>
              <input v-model.number="form.syncInterval" type="number" min="0" />
            </div>

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

// GitHub config fields
const githubConfig = ref({
  repo: '',
  token: '',
  state: 'open'
})

const form = ref({
  name: '',
  type: 'GITHUB',
  config: JSON.stringify({ repo: '', token: '', state: 'open' }),
  syncInterval: 60
})

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
    const data = {
      ...form.value,
      projectId: selectedProjectId.value
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

const syncSource = async (source) => {
  const success = await taskSourceStore.syncTaskSource(source.id)
  if (success) {
    showToast(t('taskSource.syncNow') + ' ' + t('common.success'))
  } else {
    showToast(t('common.error'), 'error')
  }
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

const editSource = (source) => {
  editingSource.value = source
  form.value = {
    name: source.name,
    type: 'GITHUB',
    config: source.config || '{}',
    syncInterval: source.syncInterval || 60
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
  showAddForm.value = true
}

const closeForm = () => {
  showAddForm.value = false
  editingSource.value = null
  form.value = { name: '', type: 'GITHUB', config: JSON.stringify({ repo: '', token: '', state: 'open' }), syncInterval: 60 }
  githubConfig.value = { repo: '', token: '', state: 'open' }
}

// Sync githubConfig to form.config
watch(githubConfig, (newConfig) => {
  form.value.config = JSON.stringify(newConfig)
}, { deep: true })

onMounted(loadProjects)
</script>

<style scoped>
.task-source-config {
  padding: 1.5rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header h1 {
  font-size: 1.5rem;
  color: #2d3748;
}

.project-selector {
  margin-bottom: 1.5rem;
}

.project-selector label {
  margin-right: 0.5rem;
  font-weight: 500;
}

.project-selector select {
  padding: 0.5rem;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  min-width: 200px;
}

.loading, .empty-state, .select-project-prompt {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.source-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.source-header h3 {
  margin: 0;
  font-size: 1rem;
}

.source-type-badge {
  background: #edf2f7;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.source-details {
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.detail-row .label {
  color: #718096;
}

.source-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #4299e1;
  color: white;
}

.btn-secondary {
  background: #edf2f7;
  color: #4a5568;
}

.btn-danger {
  background: #fc8181;
  color: white;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.125rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #718096;
}

.modal-body {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
  font-size: 0.875rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.toast {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
  z-index: 2000;
}

.toast.success {
  background: #48bb78;
}

.toast.error {
  background: #fc8181;
}
</style>
