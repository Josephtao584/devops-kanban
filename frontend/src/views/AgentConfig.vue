<template>
  <div class="agent-config page-shell">
    <!-- 顶部操作栏 -->
    <div class="header page-header page-header--compact">
      <h1 class="page-header__title">{{ $t('agent.title') }}</h1>
      <button class="btn btn-primary" data-testid="open-create-agent" @click="openAddForm">
        + {{ $t('agent.createAgent') }}
      </button>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="main-content-wrapper">
      <!-- 左侧：角色列表 -->
      <div class="agent-list-panel">
        <div class="panel-header">
          <h3>{{ $t('agent.teamList') }}</h3>
          <span class="agent-count">{{ agentStore.agents.length }}</span>
        </div>
        <div class="agent-list" v-if="!agentStore.loading">
          <div
            class="agent-list-item"
            v-for="agent in agentStore.agents"
            :key="agent.id"
            :class="{ 'active': selectedAgent?.id === agent.id }"
            @click="selectAgent(agent)"
          >
            <div class="agent-item-info">
              <span class="agent-name">{{ agent.name }}</span>
            </div>
            <div class="agent-item-meta">
              <span class="role-tag">{{ locale === 'zh' ? getRoleConfig(agent.role || 'BACKEND_DEV').name : getRoleConfig(agent.role || 'BACKEND_DEV').nameEn }}</span>
              <span class="enabled-badge" :class="{ 'disabled': !agent.enabled }">
                {{ agent.enabled ? $t('common.enabled') : $t('common.disabled') }}
              </span>
            </div>
          </div>
          <div v-if="agentStore.agents.length === 0" class="empty-list">
            {{ $t('agent.noAgents') }}
          </div>
        </div>
        <div v-else class="loading-state">
          {{ $t('common.loading') }}
        </div>
      </div>

      <!-- 右侧：角色详情面板 -->
      <div class="agent-detail-panel">
        <!-- 空状态：未选中角色 -->
        <div v-if="!selectedAgent" class="empty-detail">
          <p>{{ $t('agent.selectAgentHint') }}</p>
        </div>

        <!-- 详情内容 -->
        <div v-else class="detail-content">
          <!-- 角色头部信息 -->
          <div class="detail-header">
            <div class="agent-title-row">
              <div class="title-left">
                <h2>{{ selectedAgent.name }}</h2>
              </div>
              <div class="header-actions">
                <button class="btn btn-secondary btn-sm" @click="openEditForm">
                  {{ $t('common.edit') }}
                </button>
                <button class="btn btn-danger btn-sm" @click="confirmDelete">
                  {{ $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>

          <!-- 角色基本信息 -->
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">{{ $t('agent.agentType') }}</span>
              <span class="info-value">{{ formatExecutorType(selectedAgent.executorType) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('agent.role') }}</span>
              <span class="info-value">
                <span class="role-badge-inline">
                  {{ locale === 'zh' ? getRoleConfig(selectedAgent.role || 'BACKEND_DEV').name : getRoleConfig(selectedAgent.role || 'BACKEND_DEV').nameEn }}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('agent.description') }}</span>
              <span class="info-value description-text">{{ selectedAgent.description || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('common.enabled') }}</span>
              <label class="toggle">
                <input type="checkbox" :checked="selectedAgent.enabled" @change="toggleEnabled(selectedAgent)" />
                <span class="slider"></span>
              </label>
            </div>
          </div>

          <!-- 技能标签 -->
          <div class="skills-section">
            <span class="section-label">{{ $t('agent.skills') }}</span>
            <div class="skills-tags">
              <span v-for="skill in getVisibleAgentSkills(selectedAgent)" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
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
          <form data-testid="agent-form" @submit.prevent="saveAgent">
            <div class="form-group">
              <label>{{ $t('agent.agentName') }}</label>
              <input v-model="form.name" data-testid="agent-name-input" type="text" required />
            </div>

            <div class="form-group">
              <label>{{ $t('agent.agentType') }}</label>
              <select v-model="form.executorType" data-testid="agent-executor-type-select" required>
                <option value="CLAUDE_CODE">{{ $t('agent.types.CLAUDE_CODE') }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.role') }}</label>
              <select v-model="form.role" required @change="onRoleChange">
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.skills') }}</label>
              <div class="skills-editor">
                <select v-model="selectedSkillToAdd" class="skill-select">
                  <option value="">{{ $t('agent.selectExistingSkill') }}</option>
                  <option v-for="skill in availableSkillOptions" :key="skill" :value="skill">
                    {{ skillStore.skills.find(s => s.id === skill)?.name }}
                  </option>
                </select>
                <button type="button" class="btn btn-secondary btn-sm" @click="addSelectedSkill" :disabled="!selectedSkillToAdd">
                  {{ $t('common.add') }}
                </button>
                <div class="skills-input-container">
                  <span v-for="(skillId, index) in form.skills" :key="index" class="skill-tag-input">
                    {{ skillStore.skills.find(s => s.id === skillId)?.name }}
                    <button type="button" class="remove-skill-btn" @click="removeSkill(index)">&times;</button>
                  </span>
                </div>
              </div>
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
import { useSkillStore } from '../stores/skillStore'
import { ROLE_CONFIG, getRoleConfig } from '../constants/agent'

const { t, locale } = useI18n()
const agentStore = useAgentStore()
const skillStore = useSkillStore()

const saving = ref(false)
const showForm = ref(false)
const editingAgent = ref(null)

// Selected agent for detail view
const selectedAgent = ref(null)

const form = ref({
  name: '',
  executorType: 'CLAUDE_CODE',
  role: 'BACKEND_DEV',
  description: '',
  enabled: true,
  skills: []
})

const selectedSkillToAdd = ref('')
const availableSkills = computed(() => skillStore.skills.map(skill => skill.id))
const availableSkillOptions = computed(() => availableSkills.value.filter(id => !form.value.skills.includes(id)))

const setFormState = (agent) => {
  const normalizedSkills = Array.isArray(agent?.skills)
    ? [...new Set(agent.skills.map(skill => {
        if (typeof skill === 'number') return skill
        // Legacy: name string → id lookup
        const found = skillStore.skills.find(s => s.name === skill || s.identifier === skill)
        return found ? found.id : null
      }).filter(id => id !== null))]
    : []

  form.value = {
    name: agent?.name || '',
    executorType: agent?.executorType || 'CLAUDE_CODE',
    role: agent?.role || 'BACKEND_DEV',
    description: agent?.description || '',
    enabled: agent?.enabled ?? true,
    skills: normalizedSkills
  }
  selectedSkillToAdd.value = ''
}

const formatExecutorType = (executorType) => {
  if (!executorType) return '-'
  return t(`agent.types.${executorType}`)
}

const getVisibleAgentSkills = (agent) => {
  const skills = Array.isArray(agent?.skills) ? agent.skills : (typeof agent?.skills === 'string' ? JSON.parse(agent.skills) : [])
  return skills.map(skillId => {
    const skill = skillStore.skills.find(s => s.id === skillId)
    return skill ? skill.name : null
  }).filter(name => name !== null)
}

const buildAgentPayload = () => ({
  ...form.value,
  skills: [...form.value.skills]
})

const getResponseErrorMessage = (response, fallbackMessage) => {
  return response?.message || fallbackMessage
}

const resetFormState = () => {
  setFormState(null)
}

resetFormState()

// Get role options for select dropdown
const roleOptions = computed(() => {
  return Object.entries(ROLE_CONFIG).map(([key, config]) => ({
    value: key,
    label: locale.value === 'zh' ? config.name : config.nameEn
  }))
})

const toast = ref({ show: false, message: '', type: 'success' })

const showToast = (message, type = 'success') => {
  toast.value = { show: true, message, type }
  setTimeout(() => { toast.value.show = false }, 3000)
}

const loadAgents = async () => {
  try {
    await Promise.all([
      agentStore.fetchAgents(),
      skillStore.fetchSkills()
    ])
    if (agentStore.agents.length > 0 && !selectedAgent.value) {
      selectAgent(agentStore.agents[0])
    }
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

const selectAgent = async (agent) => {
  selectedAgent.value = agent
}

const openAddForm = () => {
  editingAgent.value = null
  resetFormState()
  showForm.value = true
}

const openEditForm = () => {
  if (!selectedAgent.value) return
  editingAgent.value = selectedAgent.value
  setFormState(selectedAgent.value)
  showForm.value = true
}

const saveAgent = async () => {
  saving.value = true
  try {
    const data = buildAgentPayload()
    const response = editingAgent.value
      ? await agentStore.updateAgent(editingAgent.value.id, data)
      : await agentStore.createAgent(data)

    if (!response?.success) {
      showToast(getResponseErrorMessage(response, t('messages.saveFailed', { name: t('agent.title') })), 'error')
      return
    }

    // Update selected agent reference
    if (editingAgent.value && selectedAgent.value?.id === editingAgent.value.id) {
      selectedAgent.value = agentStore.agents.find(a => a.id === editingAgent.value.id)
    }

    closeForm()
    showToast(t('messages.saved', { name: t('agent.title') }))
  } catch (e) {
    console.error('Failed to save:', e)
    showToast(e?.message || t('messages.saveFailed', { name: t('agent.title') }), 'error')
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (agent) => {
  try {
    const response = await agentStore.toggleAgentEnabled(agent.id)
    if (!response?.success) {
      showToast(getResponseErrorMessage(response, t('messages.updateFailed', { name: t('agent.title') })), 'error')
      return
    }

    // Update selected agent reference
    if (selectedAgent.value?.id === agent.id) {
      selectedAgent.value = agentStore.agents.find(a => a.id === agent.id)
    }
    showToast(t('messages.updated', { name: t('agent.title') }))
  } catch (e) {
    showToast(t('messages.updateFailed', { name: t('agent.title') }), 'error')
  }
}

const confirmDelete = async () => {
  if (!selectedAgent.value) return
  if (!confirm(t('agent.deleteConfirm'))) return
  try {
    const deletedId = selectedAgent.value.id
    const response = await agentStore.deleteAgent(deletedId)
    if (!response?.success) {
      showToast(getResponseErrorMessage(response, t('messages.deleteFailed', { name: t('agent.title') })), 'error')
      return
    }

    // Clear selection or select next available agent
    if (agentStore.agents.length > 0) {
      selectAgent(agentStore.agents[0])
    } else {
      selectedAgent.value = null
    }
    showToast(t('messages.deleted', { name: t('agent.title') }))
  } catch (e) {
    showToast(e?.message || t('messages.deleteFailed', { name: t('agent.title') }), 'error')
  }
}

const closeForm = () => {
  showForm.value = false
  editingAgent.value = null
  selectedSkillToAdd.value = ''
}

const onRoleChange = () => {
  form.value.skills = form.value.skills.filter(id => availableSkills.value.includes(id))
}

const addSelectedSkill = () => {
  if (selectedSkillToAdd.value && !form.value.skills.includes(selectedSkillToAdd.value)) {
    form.value.skills = [...form.value.skills, selectedSkillToAdd.value]
    selectedSkillToAdd.value = ''
  }
}

const removeSkill = (index) => {
  form.value.skills = form.value.skills.filter((_, i) => i !== index)
}

onMounted(loadAgents)
</script>

<style scoped>
.agent-config {
  padding: 0;
}

.header {
  align-items: center;
}

.header .btn {
  min-height: 36px;
}

/* Main content wrapper - left-right split */
.main-content-wrapper {
  display: flex;
  gap: var(--page-gap);
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--page-padding);
  background: var(--bg-secondary);
}

/* Left panel - Agent list */
.agent-list-panel {
  width: 300px;
  flex-shrink: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--panel-bg);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.agent-count {
  background: var(--accent-color-soft);
  color: var(--accent-color);
  padding: 3px 9px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: var(--panel-bg);
}

.agent-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.agent-list-item:hover {
  background: var(--bg-secondary);
  border-color: rgba(99, 102, 241, 0.35);
}

.agent-list-item.active {
  background: var(--hover-bg);
  border: 1px solid var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.1);
}

.agent-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.agent-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.role-tag {
  font-size: 10px;
  color: var(--text-secondary);
  background: rgba(31, 41, 55, 0.04);
  padding: 3px 7px;
  border-radius: 999px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.enabled-badge {
  font-size: 10px;
  padding: 3px 7px;
  border-radius: 999px;
  background: #d1fae5;
  color: #065f46;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.enabled-badge.disabled {
  background: #fee2e2;
  color: #991b1b;
}

.empty-list, .loading-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Right panel - Agent detail */
.agent-detail-panel {
  flex: 1;
  background: var(--panel-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--panel-bg);
}

.empty-detail p {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
}

.detail-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--panel-bg);
}

.agent-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-left {
  display: flex;
  align-items: center;
}

.agent-title-row h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.header-actions .btn {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  transition: all 0.2s;
}

/* Info section */
.info-section {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.info-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.info-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.info-label {
  width: 90px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.info-value {
  color: var(--text-primary);
  font-size: 13px;
}

.description-text {
  word-break: break-word;
  line-height: 1.5;
}

.role-badge-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-color);
  background: rgba(37, 198, 201, 0.10);
  border: 1px solid rgba(37, 198, 201, 0.16);
  letter-spacing: 0.02em;
}

/* Skills section */
.skills-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.section-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-tag {
  background: rgba(31, 41, 55, 0.04);
  color: rgba(75, 85, 99, 0.88);
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid rgba(31, 41, 55, 0.06);
  transition: all 0.2s;
}

.skill-tag:hover {
  background: rgba(31, 41, 55, 0.05);
  border-color: rgba(31, 41, 55, 0.08);
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
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
  background-color: var(--border-color);
  transition: 0.2s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

.toggle input:checked + .slider {
  background-color: var(--accent-color);
}

.toggle input:checked + .slider:before {
  transform: translateX(18px);
}

/* Buttons */
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

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
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

/* Modal */
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
  max-width: 500px;
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
  transition: all 0.2s;
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
  display: block;
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

.skills-editor {
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg-secondary);
}

.skills-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}

.skill-tag-input {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--accent-color);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}

.remove-skill-btn {
  background: none;
  border: none;
  color: white;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.remove-skill-btn:hover {
  opacity: 1;
}

.skill-input {
  flex: 1;
  min-width: 120px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.skill-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.add-skill-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.add-skill-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.preset-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.preset-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-right: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.preset-skill-btn {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.preset-skill-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  user-select: none;
}

.checkbox-label input {
  width: auto;
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

/* Toast */
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

</style>
