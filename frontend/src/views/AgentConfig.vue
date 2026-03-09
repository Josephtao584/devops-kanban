<template>
  <div class="agent-config">
    <div class="header">
      <h1>{{ $t('agent.title') }}</h1>
      <button class="btn btn-primary" @click="openAddForm">
        + {{ $t('agent.createAgent') }}
      </button>
    </div>

    <!-- Agents List (Global) -->
    <div class="agents-list">
      <div v-if="agentStore.loading" class="loading">{{ $t('common.loading') }}</div>

      <div v-else-if="agentStore.agents.length === 0" class="empty-state">
        {{ $t('agent.createAgent') }}
      </div>

      <div v-else class="agents-grid">
        <div v-for="agent in agentStore.agents" :key="agent.id" class="agent-card">
          <div class="agent-header">
            <h3>{{ agent.name }}</h3>
            <span class="agent-type-badge">{{ $t(`agent.types.${agent.type}`) }}</span>
          </div>

          <div class="agent-details">
            <div class="detail-row">
              <span class="label">{{ $t('agent.role') }}:</span>
              <span class="role-badge" :style="{ backgroundColor: getRoleConfig(agent.role || 'BACKEND_DEV').color }">
                {{ getRoleConfig(agent.role || 'BACKEND_DEV').icon }}
                {{ locale === 'zh' ? getRoleConfig(agent.role || 'BACKEND_DEV').name : getRoleConfig(agent.role || 'BACKEND_DEV').nameEn }}
              </span>
            </div>
            <div class="detail-row description-row">
              <span class="label">{{ $t('agent.description') }}:</span>
              <span class="value">{{ agent.description || '-' }}</span>
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
              <label>{{ $t('agent.role') }}</label>
              <select v-model="form.role" required>
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.description') }}</label>
              <input v-model="form.description" type="text" :placeholder="$t('agent.descriptionPlaceholder')" />
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
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '../stores/agentStore'
import { getRoleOptions, getRoleConfig } from '../constants/agent'

const { t, locale } = useI18n()
const agentStore = useAgentStore()

const saving = ref(false)
const showForm = ref(false)
const editingAgent = ref(null)

const form = ref({
  name: '',
  type: 'CLAUDE',
  role: 'BACKEND_DEV',
  description: '',
  enabled: true
})

// Get role options for select dropdown
const roleOptions = computed(() => {
  return getRoleOptions().map(opt => ({
    value: opt.value,
    label: locale.value === 'zh' ? opt.label : opt.labelEn
  }))
})

const toast = ref({ show: false, message: '', type: 'success' })

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const loadAgents = async () => {
  try {
    await agentStore.fetchAgents()
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

const openAddForm = () => {
  editingAgent.value = null
  form.value = { name: '', type: 'CLAUDE', role: 'BACKEND_DEV', description: '', enabled: true }
  showForm.value = true
}

const openEditForm = (agent) => {
  editingAgent.value = agent
  form.value = {
    name: agent.name,
    type: agent.type,
    role: agent.role || 'BACKEND_DEV',
    description: agent.description || '',
    enabled: agent.enabled
  }
  showForm.value = true
}

const saveAgent = async () => {
  saving.value = true
  try {
    const data = { ...form.value }
    if (editingAgent.value) {
      await agentStore.updateAgent(editingAgent.value.id, data)
    } else {
      await agentStore.createAgent(data)
    }
    closeForm()
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
    await agentStore.toggleAgentEnabled(agent.id)
    showToast(t('messages.updated', { name: t('agent.title') }))
  } catch (e) {
    showToast(t('messages.updateFailed', { name: t('agent.title') }), 'error')
  }
}

const confirmDelete = async (agent) => {
  if (!confirm(t('agent.deleteConfirm'))) return
  try {
    await agentStore.deleteAgent(agent.id)
    showToast(t('messages.deleted', { name: t('agent.title') }))
  } catch (e) {
    showToast(t('messages.deleteFailed', { name: t('agent.title') }), 'error')
  }
}

const closeForm = () => {
  showForm.value = false
  editingAgent.value = null
}

onMounted(loadAgents)
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

.loading, .empty-state {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.agent-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  min-height: 180px;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.agent-header h3 {
  margin: 0;
  font-size: 0.9rem;
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
  flex: 1;
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

.detail-row .value {
  color: #2d3748;
  text-align: right;
  max-width: 60%;
  word-break: break-word;
}

.description-row {
  /* 保持水平布局，不换行 */
}

.description-row .value {
  text-align: right;
  max-width: 60%;
  font-size: 0.8rem;
  color: #4a5568;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
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
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

.agent-actions .btn {
  flex: 1;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
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
  max-width: 400px;
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
.form-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
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
