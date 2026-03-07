<template>
  <div class="agent-config">
    <div class="header">
      <h1>{{ $t('agent.title') }}</h1>
      <button class="btn btn-primary" @click="openAddForm">
        + {{ $t('agent.createAgent') }}
      </button>
    </div>

    <!-- Project Selector -->
    <div class="project-selector">
      <label for="project">{{ $t('project.selectProject') }}:</label>
      <select id="project" v-model="selectedProjectId" @change="loadAgents">
        <option value="">-- {{ $t('project.selectProject') }} --</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>

    <!-- Agents List -->
    <div class="agents-list" v-if="selectedProjectId">
      <div v-if="loading" class="loading">{{ $t('common.loading') }}</div>

      <div v-else-if="agents.length === 0" class="empty-state">
        {{ $t('agent.createAgent') }}
      </div>

      <div v-else class="agents-grid">
        <div v-for="agent in agents" :key="agent.id" class="agent-card">
          <div class="agent-header">
            <h3>{{ agent.name }}</h3>
            <span class="agent-type-badge">{{ $t(`agent.types.${agent.type}`) }}</span>
          </div>

          <div class="agent-details">
            <div class="detail-row">
              <span class="label">{{ $t('agent.command') }}:</span>
              <span class="value code">{{ agent.command || '-' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('common.enabled') }}:</span>
              <label class="toggle">
                <input type="checkbox" :checked="agent.enabled" @change="toggleEnabled(agent)" />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <div class="agent-actions">
            <button class="btn btn-secondary" @click="openEditForm(agent)">
              {{ $t('common.edit') }}
            </button>
            <button class="btn btn-danger" @click="confirmDelete(agent)">
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
    <div class="modal-overlay" v-if="showForm" @click.self="closeForm">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingAgent ? $t('agent.editAgent') : $t('agent.createAgent') }}</h2>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveAgent">
            <div class="form-group">
              <label>{{ $t('agent.agentName') }}</label>
              <input v-model="form.name" type="text" required />
            </div>

            <div class="form-group">
              <label>{{ $t('agent.agentType') }}</label>
              <select v-model="form.type" required>
                <option value="CLAUDE">{{ $t('agent.types.CLAUDE') }}</option>
                <option value="CODEX">{{ $t('agent.types.CODEX') }}</option>
                <option value="CURSOR">{{ $t('agent.types.CURSOR') }}</option>
                <option value="GEMINI">{{ $t('agent.types.GEMINI') }}</option>
                <option value="CUSTOM">{{ $t('agent.types.CUSTOM') }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.command') }}</label>
              <input v-model="form.command" type="text" :placeholder="$t('agent.commandHint')" />
              <small class="hint">{{ $t('agent.commandHint') }}</small>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.config') }} (JSON)</label>
              <textarea v-model="form.config" rows="3" placeholder='{"model": "claude-sonnet-4-6"}'></textarea>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="form.enabled" />
                {{ $t('common.enabled') }}
              </label>
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProjects } from '../api/project'
import { getAgents, createAgent, updateAgent, deleteAgent } from '../api/agent'

const { t } = useI18n()

const projects = ref([])
const agents = ref([])
const selectedProjectId = ref('')
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const editingAgent = ref(null)

const form = ref({
  name: '',
  type: 'CLAUDE',
  command: '',
  config: '{}',
  enabled: true
})

const toast = ref({ show: false, message: '', type: 'success' })

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const loadProjects = async () => {
  try {
    const res = await getProjects()
    projects.value = res.data || res || []
    if (projects.value.length > 0) {
      selectedProjectId.value = projects.value[0].id
      loadAgents()
    }
  } catch (e) {
    console.error('Failed to load projects:', e)
  }
}

const loadAgents = async () => {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const res = await getAgents(selectedProjectId.value)
    agents.value = res.data || res || []
  } catch (e) {
    console.error('Failed to load agents:', e)
  } finally {
    loading.value = false
  }
}

const openAddForm = () => {
  editingAgent.value = null
  form.value = { name: '', type: 'CLAUDE', command: '', config: '{}', enabled: true }
  showForm.value = true
}

const openEditForm = (agent) => {
  editingAgent.value = agent
  form.value = {
    name: agent.name,
    type: agent.type,
    command: agent.command || '',
    config: agent.config || '{}',
    enabled: agent.enabled
  }
  showForm.value = true
}

const saveAgent = async () => {
  saving.value = true
  try {
    const data = {
      ...form.value,
      projectId: selectedProjectId.value
    }
    if (editingAgent.value) {
      await updateAgent(editingAgent.value.id, data)
    } else {
      await createAgent(data)
    }
    closeForm()
    loadAgents()
    showToast(t('messages.saved', { name: t('agent.title') }))
  } catch (e) {
    console.error('Failed to save:', e)
    showToast(t('messages.saveFailed', { name: t('agent.title') }), 'error')
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (agent) => {
  try {
    await updateAgent(agent.id, { ...agent, enabled: !agent.enabled })
    agent.enabled = !agent.enabled
    showToast(t('messages.updated', { name: t('agent.title') }))
  } catch (e) {
    showToast(t('messages.updateFailed', { name: t('agent.title') }), 'error')
  }
}

const confirmDelete = async (agent) => {
  if (!confirm(t('agent.deleteConfirm'))) return
  try {
    await deleteAgent(agent.id)
    loadAgents()
    showToast(t('messages.deleted', { name: t('agent.title') }))
  } catch (e) {
    showToast(t('messages.deleteFailed', { name: t('agent.title') }), 'error')
  }
}

const closeForm = () => {
  showForm.value = false
  editingAgent.value = null
}

onMounted(loadProjects)
</script>

<style scoped>
.agent-config {
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

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.agent-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.agent-header h3 {
  margin: 0;
  font-size: 1rem;
}

.agent-type-badge {
  background: #bee3f8;
  color: #2b6cb0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.agent-details {
  margin-bottom: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.detail-row .label {
  color: #718096;
}

.detail-row .value.code {
  font-family: monospace;
  font-size: 0.75rem;
  background: #f7fafc;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e0;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle input:checked + .slider {
  background-color: #48bb78;
}

.toggle input:checked + .slider:before {
  transform: translateX(20px);
}

.agent-actions {
  display: flex;
  gap: 0.5rem;
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

.hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #718096;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
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
