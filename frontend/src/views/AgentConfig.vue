<template>
  <div class="agent-config">
    <!-- 顶部操作栏 -->
    <div class="header">
      <h1>{{ $t('agent.title') }}</h1>
      <button class="btn btn-primary" @click="openAddForm">
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
              <span class="role-icon">{{ getRoleConfig(agent.role || 'BACKEND_DEV').icon }}</span>
              <span class="agent-name">{{ agent.name }}</span>
            </div>
            <div class="agent-item-meta">
              <span class="role-tag">{{ locale === 'zh' ? getRoleConfig(agent.role || 'BACKEND_DEV').name : getRoleConfig(agent.role || 'BACKEND_DEV').nameEn }}</span>
              <div class="status-row">
                <span class="agent-status-indicator" :class="getAgentStatus(agent.id)">
                  <span class="status-dot"></span>
                  <span class="status-text">{{ $t(`agent.status.${getAgentStatus(agent.id)}`) }}</span>
                </span>
                <span class="enabled-badge" :class="{ 'disabled': !agent.enabled }">
                  {{ agent.enabled ? $t('common.enabled') : $t('common.disabled') }}
                </span>
              </div>
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
          <div class="empty-icon">👤</div>
          <p>{{ $t('agent.selectAgentHint') }}</p>
        </div>

        <!-- 详情内容 -->
        <div v-else class="detail-content">
          <!-- 角色头部信息 -->
          <div class="detail-header">
            <div class="agent-title-row">
              <div class="title-left">
                <span class="role-icon-large">{{ getRoleConfig(selectedAgent.role || 'BACKEND_DEV').icon }}</span>
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
              <span class="info-value">{{ $t(`agent.types.${selectedAgent.type}`) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('agent.role') }}</span>
              <span class="info-value">
                <span class="role-badge-inline" :style="{ backgroundImage: getRoleConfig(selectedAgent.role || 'BACKEND_DEV').gradient }">
                  {{ getRoleConfig(selectedAgent.role || 'BACKEND_DEV').icon }}
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
              <span v-for="skill in (selectedAgent.skills || getRoleConfig(selectedAgent.role || 'BACKEND_DEV').skills)" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
          </div>

          <!-- 执行统计 -->
          <div class="stats-section">
            <div class="stat-item running">
              <span class="stat-value">{{ executionStats.running }}</span>
              <span class="stat-label">{{ locale === 'zh' ? '执行中' : 'Running' }}</span>
            </div>
            <div class="stat-item success">
              <span class="stat-value">{{ executionStats.success }}</span>
              <span class="stat-label">{{ locale === 'zh' ? '已完成' : 'Success' }}</span>
            </div>
            <div class="stat-item failed">
              <span class="stat-value">{{ executionStats.failed }}</span>
              <span class="stat-label">{{ locale === 'zh' ? '失败' : 'Failed' }}</span>
            </div>
          </div>

          <!-- 执行记录 -->
          <div class="executions-section">
            <div class="section-header">
              <h3>{{ $t('agent.executionHistory') }}</h3>
              <button class="btn btn-secondary btn-sm" @click="loadExecutions" :disabled="loadingExecutions">
                {{ locale === 'zh' ? '刷新' : 'Refresh' }}
              </button>
            </div>
            <div v-if="loadingExecutions" class="loading-state">
              {{ $t('common.loading') }}
            </div>
            <div v-else-if="executions.length === 0" class="empty-state">
              {{ $t('agent.noExecutions') }}
            </div>
            <div v-else class="executions-list">
              <div
                class="execution-item clickable"
                v-for="execution in executions"
                :key="execution.id"
                @click="openExecutionDetail(execution)"
              >
                <div class="execution-main">
                  <span class="task-title">{{ execution.taskTitle || `Task #${execution.taskId}` }}</span>
                  <span class="task-status-badge" :class="`status-${execution.taskStatus?.toLowerCase()}`">
                    {{ execution.taskStatus ? $t(`status.${execution.taskStatus}`) : '-' }}
                  </span>
                </div>
                <div class="execution-meta">
                  <span class="execution-status" :class="`status-${execution.status?.toLowerCase()}`">
                    {{ $t(`execution.statuses.${execution.status}`) }}
                  </span>
                  <span class="execution-time">
                    {{ formatDateTime(execution.startedAt) }}
                    <template v-if="execution.completedAt">
                      → {{ formatDateTime(execution.completedAt) }}
                    </template>
                  </span>
                </div>
              </div>
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
              <select v-model="form.role" required @change="onRoleChange">
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.skills') }}</label>
              <div class="skills-editor">
                <div class="skills-input-container">
                  <span v-for="(skill, index) in form.skills" :key="index" class="skill-tag-input">
                    {{ skill }}
                    <button type="button" class="remove-skill-btn" @click="removeSkill(index)">&times;</button>
                  </span>
                  <input
                    v-model="newSkill"
                    type="text"
                    :placeholder="$t('agent.skillPlaceholder')"
                    @keyup.enter="addSkill"
                    class="skill-input"
                  />
                  <button type="button" class="add-skill-btn" @click="addSkill" v-if="newSkill">+</button>
                </div>
                <div class="preset-skills">
                  <span class="preset-label">{{ $t('agent.recommendedSkills') }}:</span>
                  <button
                    v-for="(skill, index) in presetSkills"
                    :key="index"
                    type="button"
                    class="preset-skill-btn"
                    @click="addPresetSkill(skill)"
                  >
                    + {{ skill }}
                  </button>
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

    <!-- Execution Detail Drawer -->
    <ExecutionDetailDrawer
      :visible="showExecutionDetail"
      :execution-id="selectedExecutionId"
      @close="closeExecutionDetail"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '../stores/agentStore'
import { getRoleOptions, getRoleConfig } from '../constants/agent'
import { getExecutionsByAgent } from '../api/execution'
import ExecutionDetailDrawer from '../components/ExecutionDetailDrawer.vue'

const { t, locale } = useI18n()
const agentStore = useAgentStore()

const saving = ref(false)
const showForm = ref(false)
const editingAgent = ref(null)

// Selected agent for detail view
const selectedAgent = ref(null)
const executions = ref([])
const loadingExecutions = ref(false)

// Execution detail drawer state
const showExecutionDetail = ref(false)
const selectedExecutionId = ref(null)

// Agent status tracking (for all agents)
const agentStatuses = ref({})

// Execution statistics
const executionStats = computed(() => {
  const stats = {
    running: 0,
    success: 0,
    failed: 0,
    total: executions.value.length
  }
  executions.value.forEach(e => {
    if (e.status === 'RUNNING' || e.status === 'PENDING') {
      stats.running++
    } else if (e.status === 'SUCCESS') {
      stats.success++
    } else if (e.status === 'FAILED') {
      stats.failed++
    }
  })
  return stats
})

const form = ref({
  name: '',
  type: 'CLAUDE',
  role: 'BACKEND_DEV',
  description: '',
  enabled: true,
  skills: []
})

const newSkill = ref('')

// Get preset skills based on selected role
const presetSkills = computed(() => {
  return getRoleConfig(form.value.role || 'BACKEND_DEV').skills || []
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
    // Load statuses for all agents
    await loadAllAgentStatuses()
    // Auto-select first agent if available
    if (agentStore.agents.length > 0 && !selectedAgent.value) {
      selectAgent(agentStore.agents[0])
    }
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

// Load execution statuses for all agents
const loadAllAgentStatuses = async () => {
  const statuses = {}
  for (const agent of agentStore.agents) {
    try {
      const response = await getExecutionsByAgent(agent.id)
      if (response.success && response.data) {
        // Check if any execution is RUNNING
        const hasRunning = response.data.some(e => e.status === 'RUNNING' || e.status === 'PENDING')
        statuses[agent.id] = hasRunning ? 'working' : 'idle'
      } else {
        statuses[agent.id] = 'idle'
      }
    } catch (e) {
      statuses[agent.id] = 'idle'
    }
  }
  agentStatuses.value = statuses
}

// Get agent status (working or idle)
const getAgentStatus = (agentId) => {
  return agentStatuses.value[agentId] || 'idle'
}

const selectAgent = async (agent) => {
  selectedAgent.value = agent
  executions.value = []
  loadingExecutions.value = true
  try {
    const response = await getExecutionsByAgent(agent.id)
    if (response.success && response.data) {
      executions.value = response.data
    }
  } catch (e) {
    console.error('Failed to load executions:', e)
  } finally {
    loadingExecutions.value = false
  }
}

const loadExecutions = async () => {
  if (!selectedAgent.value) return
  loadingExecutions.value = true
  try {
    const response = await getExecutionsByAgent(selectedAgent.value.id)
    if (response.success && response.data) {
      executions.value = response.data
    }
  } catch (e) {
    console.error('Failed to load executions:', e)
  } finally {
    loadingExecutions.value = false
  }
}

const openExecutionDetail = (execution) => {
  selectedExecutionId.value = execution.id
  showExecutionDetail.value = true
}

const closeExecutionDetail = () => {
  showExecutionDetail.value = false
  selectedExecutionId.value = null
}

const openAddForm = () => {
  editingAgent.value = null
  form.value = { name: '', type: 'CLAUDE', role: 'BACKEND_DEV', description: '', enabled: true, skills: [...presetSkills.value] }
  showForm.value = true
}

const openEditForm = () => {
  if (!selectedAgent.value) return
  editingAgent.value = selectedAgent.value
  form.value = {
    name: selectedAgent.value.name,
    type: selectedAgent.value.type,
    role: selectedAgent.value.role || 'BACKEND_DEV',
    description: selectedAgent.value.description || '',
    enabled: selectedAgent.value.enabled,
    skills: selectedAgent.value.skills || [...getRoleConfig(selectedAgent.value.role || 'BACKEND_DEV').skills]
  }
  showForm.value = true
}

const saveAgent = async () => {
  saving.value = true
  try {
    const data = { ...form.value }
    if (editingAgent.value) {
      await agentStore.updateAgent(editingAgent.value.id, data)
      // Update selected agent reference
      if (selectedAgent.value?.id === editingAgent.value.id) {
        selectedAgent.value = agentStore.agents.find(a => a.id === editingAgent.value.id)
      }
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
    await agentStore.deleteAgent(deletedId)
    // Clear selection or select next available agent
    if (agentStore.agents.length > 0) {
      selectAgent(agentStore.agents[0])
    } else {
      selectedAgent.value = null
    }
    showToast(t('messages.deleted', { name: t('agent.title') }))
  } catch (e) {
    showToast(t('messages.deleteFailed', { name: t('agent.title') }), 'error')
  }
}

const closeForm = () => {
  showForm.value = false
  editingAgent.value = null
  newSkill.value = ''
}

const onRoleChange = () => {
  // When role changes, reset skills to the preset skills for that role
  form.value.skills = [...presetSkills.value]
}

const addSkill = () => {
  if (newSkill.value && !form.value.skills.includes(newSkill.value)) {
    form.value.skills = [...form.value.skills, newSkill.value]
    newSkill.value = ''
  }
}

const removeSkill = (index) => {
  form.value.skills = form.value.skills.filter((_, i) => i !== index)
}

const addPresetSkill = (skill) => {
  if (!form.value.skills.includes(skill)) {
    form.value.skills = [...form.value.skills, skill]
  }
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(loadAgents)
</script>

<style scoped>
.agent-config {
  padding: 1.5rem;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.header h1 {
  font-size: 1.5rem;
  color: #2d3748;
  margin: 0;
}

/* Main content wrapper - left-right split */
.main-content-wrapper {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Left panel - Agent list */
.agent-list-panel {
  width: 280px;
  flex-shrink: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: 0.875rem;
  color: #4a5568;
}

.agent-count {
  background: #e2e8f0;
  color: #4a5568;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.agent-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.25rem;
}

.agent-list-item:hover {
  background: #f7fafc;
}

.agent-list-item.active {
  background: #ebf8ff;
  border: 1px solid #90cdf4;
}

.agent-item-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.role-icon {
  font-size: 1.25rem;
}

.agent-name {
  font-weight: 500;
  font-size: 0.875rem;
  color: #2d3748;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.role-tag {
  font-size: 0.7rem;
  color: #718096;
  background: #edf2f7;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.enabled-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: #c6f6d5;
  color: #22543d;
}

.enabled-badge.disabled {
  background: #fed7d7;
  color: #742a2a;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.agent-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.agent-status-indicator.idle {
  background: #edf2f7;
  color: #718096;
}

.agent-status-indicator.working {
  background: #c6f6d5;
  color: #22543d;
}

.agent-status-indicator.idle .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a0aec0;
}

.agent-status-indicator.working .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38a169;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  font-weight: 500;
}

.empty-list, .loading-state {
  text-align: center;
  padding: 2rem;
  color: #718096;
  font-size: 0.875rem;
}

/* Right panel - Agent detail */
.agent-detail-panel {
  flex: 1;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a0aec0;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-detail p {
  font-size: 0.875rem;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.agent-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.role-icon-large {
  font-size: 2rem;
}

.agent-title-row h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #2d3748;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Info section */
.info-section {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
}

.info-item:not(:last-child) {
  border-bottom: 1px solid #f7fafc;
}

.info-label {
  width: 100px;
  flex-shrink: 0;
  color: #718096;
  font-size: 0.875rem;
}

.info-value {
  color: #2d3748;
  font-size: 0.875rem;
}

.description-text {
  word-break: break-word;
}

.role-badge-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: white;
}

/* Skills section */
.skills-section {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.section-label {
  display: block;
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.skill-tag {
  background: #e2e8f0;
  color: #4a5568;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Stats section */
.stats-section {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem;
  border-radius: 8px;
  background: #f7fafc;
}

.stat-item.running {
  background: #ebf8ff;
}

.stat-item.running .stat-value {
  color: #3182ce;
}

.stat-item.success {
  background: #f0fff4;
}

.stat-item.success .stat-value {
  color: #38a169;
}

.stat-item.failed {
  background: #fff5f5;
}

.stat-item.failed .stat-value {
  color: #e53e3e;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: #718096;
  margin-top: 0.25rem;
}

/* Executions section */
.executions-section {
  padding: 1rem 1.25rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.section-header h3 {
  margin: 0;
  font-size: 0.875rem;
  color: #4a5568;
}

.executions-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.execution-item {
  padding: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

.execution-item.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.execution-item.clickable:hover {
  background-color: #f0f7ff;
}

.execution-item:last-child {
  border-bottom: none;
}

.execution-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.task-title {
  font-weight: 500;
  color: #2d3748;
  font-size: 0.875rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 0.5rem;
}

.task-status-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.task-status-badge.status-todo {
  background: #faf089;
  color: #744210;
}

.task-status-badge.status-in_progress {
  background: #90cdf4;
  color: #2a4365;
}

.task-status-badge.status-done {
  background: #9ae6b4;
  color: #22543d;
}

.task-status-badge.status-blocked {
  background: #feb2b2;
  color: #742a2a;
}

.execution-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #718096;
}

.execution-status {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.execution-status.status-pending {
  background: #e2e8f0;
  color: #4a5568;
}

.execution-status.status-running {
  background: #90cdf4;
  color: #2a4365;
}

.execution-status.status-success {
  background: #9ae6b4;
  color: #22543d;
}

.execution-status.status-completed {
  background: #9ae6b4;
  color: #22543d;
}

.execution-status.status-failed {
  background: #feb2b2;
  color: #742a2a;
}

.execution-status.status-cancelled {
  background: #e2e8f0;
  color: #718096;
}

.execution-time {
  color: #718096;
}

/* Toggle switch */
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

/* Buttons */
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

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background: #4299e1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3182ce;
}

.btn-secondary {
  background: #edf2f7;
  color: #4a5568;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-danger {
  background: #fc8181;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #f56565;
}

/* Modal */
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

.skills-editor {
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  padding: 0.75rem;
  background: #f7fafc;
}

.skills-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.skill-tag-input {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #4299e1;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.remove-skill-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.remove-skill-btn:hover {
  color: #cbd5e0;
}

.skill-input {
  flex: 1;
  min-width: 120px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  font-size: 0.875rem;
}

.add-skill-btn {
  background: #48bb78;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
}

.add-skill-btn:hover {
  background: #38a169;
}

.preset-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

.preset-label {
  font-size: 0.75rem;
  color: #718096;
  margin-right: 0.25rem;
}

.preset-skill-btn {
  background: #edf2f7;
  color: #4a5568;
  border: 1px solid #cbd5e0;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-skill-btn:hover {
  background: #4299e1;
  color: white;
  border-color: #4299e1;
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

/* Toast */
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

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #718096;
  font-size: 0.875rem;
}
</style>
