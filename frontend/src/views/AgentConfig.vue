<template>
  <div class="agent-config">
    <!-- 顶部操作栏 -->
    <div class="header">
      <h1>{{ $t('agent.title') }}</h1>
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
              <span class="info-label">{{ $t('agent.commandOverride') }}</span>
              <span class="info-value description-text">{{ selectedAgent.commandOverride || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('agent.args') }}</span>
              <span class="info-value description-text">{{ formatArgs(selectedAgent.args) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('agent.env') }}</span>
              <span class="info-value description-text">{{ formatEnv(selectedAgent.env) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">{{ $t('agent.role') }}</span>
              <span class="info-value">
                <span class="role-badge-inline" :style="{ backgroundImage: getRoleConfig(selectedAgent.role || 'BACKEND_DEV').gradient }">
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
          <form data-testid="agent-form" @submit.prevent="saveAgent">
            <div class="form-group">
              <label>{{ $t('agent.agentName') }}</label>
              <input v-model="form.name" data-testid="agent-name-input" type="text" required />
            </div>

            <div class="form-group">
              <label>{{ $t('agent.agentType') }}</label>
              <select v-model="form.executorType" data-testid="agent-executor-type-select" required>
                <option value="CLAUDE_CODE">{{ $t('agent.types.CLAUDE_CODE') }}</option>
                <option value="CODEX">{{ $t('agent.types.CODEX') }}</option>
                <option value="OPENCODE">{{ $t('agent.types.OPENCODE') }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ $t('agent.commandOverride') }}</label>
              <input
                v-model="form.commandOverride"
                data-testid="agent-command-override-input"
                type="text"
                :placeholder="$t('agent.commandOverridePlaceholder')"
              />
            </div>

            <div class="form-group">
              <label>{{ $t('agent.args') }}</label>
              <input
                v-model="argsInput"
                data-testid="agent-args-input"
                type="text"
                :placeholder="$t('agent.argsPlaceholder')"
              />
            </div>

            <div class="form-group">
              <label>{{ $t('agent.env') }}</label>
              <div class="env-editor">
                <div
                  v-for="(entry, index) in envEntries"
                  :key="`env-${index}`"
                  class="env-row"
                >
                  <input
                    :data-testid="`agent-env-key-${index}`"
                    :value="entry.key"
                    type="text"
                    :placeholder="$t('agent.envKeyPlaceholder')"
                    @input="updateEnvEntry(index, 'key', $event.target.value)"
                  />
                  <input
                    :data-testid="`agent-env-value-${index}`"
                    :value="entry.value"
                    type="text"
                    :placeholder="$t('agent.envValuePlaceholder')"
                    @input="updateEnvEntry(index, 'value', $event.target.value)"
                  />
                  <button type="button" class="btn btn-secondary btn-sm" @click="removeEnvEntry(index)">
                    {{ $t('common.delete') }}
                  </button>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" @click="addEnvEntry">
                  + {{ $t('agent.addEnv') }}
                </button>
              </div>
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
import { ROLE_CONFIG, getRoleConfig } from '../constants/agent'
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

const DEFAULT_ENV_ENTRY = () => ({ key: '', value: '' })

const form = ref({
  name: '',
  executorType: 'CLAUDE_CODE',
  role: 'BACKEND_DEV',
  description: '',
  enabled: true,
  skills: [],
  commandOverride: '',
  args: [],
  env: {}
})

const argsInput = ref('')
const envEntries = ref([DEFAULT_ENV_ENTRY()])
const newSkill = ref('')

const normalizeArgs = (value) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }

  if (typeof value !== 'string') {
    return []
  }

  return value.split(',').map(item => item.trim()).filter(Boolean)
}

const buildEnvObject = (entries) => {
  return entries.reduce((acc, entry) => {
    const key = entry.key?.trim()
    const value = entry.value?.trim()

    if (!key) {
      return acc
    }

    acc[key] = value || ''
    return acc
  }, {})
}

const toEnvEntries = (env) => {
  const entries = Object.entries(env || {}).map(([key, value]) => ({
    key,
    value: String(value ?? '')
  }))

  return entries.length > 0 ? entries : [DEFAULT_ENV_ENTRY()]
}

const syncRuntimeConfigInputs = () => {
  argsInput.value = (form.value.args || []).join(', ')
  envEntries.value = toEnvEntries(form.value.env)
}

const setFormState = (agent) => {
  form.value = {
    name: agent?.name || '',
    executorType: agent?.executorType || 'CLAUDE_CODE',
    role: agent?.role || 'BACKEND_DEV',
    description: agent?.description || '',
    enabled: agent?.enabled ?? true,
    skills: agent?.skills || [...getRoleConfig(agent?.role || 'BACKEND_DEV').skills],
    commandOverride: agent?.commandOverride || '',
    args: normalizeArgs(agent?.args || []),
    env: { ...(agent?.env || {}) }
  }
  syncRuntimeConfigInputs()
}

const updateEnvEntry = (index, field, value) => {
  envEntries.value[index] = {
    ...envEntries.value[index],
    [field]: value
  }
}

const addEnvEntry = () => {
  envEntries.value = [...envEntries.value, DEFAULT_ENV_ENTRY()]
}

const removeEnvEntry = (index) => {
  const nextEntries = envEntries.value.filter((_, entryIndex) => entryIndex !== index)
  envEntries.value = nextEntries.length > 0 ? nextEntries : [DEFAULT_ENV_ENTRY()]
}

const formatExecutorType = (executorType) => {
  if (!executorType) return '-'
  return t(`agent.types.${executorType}`)
}

const formatArgs = (args) => {
  const normalizedArgs = normalizeArgs(args)
  return normalizedArgs.length > 0 ? normalizedArgs.join(', ') : '-'
}

const formatEnv = (env) => {
  const entries = Object.entries(env || {})
  if (entries.length === 0) {
    return '-'
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(', ')
}

const buildAgentPayload = () => ({
  ...form.value,
  commandOverride: form.value.commandOverride.trim() || null,
  args: normalizeArgs(argsInput.value),
  env: buildEnvObject(envEntries.value)
})

const getResponseErrorMessage = (response, fallbackMessage) => {
  return response?.message || fallbackMessage
}

const resetFormState = () => {
  setFormState(null)
}

resetFormState()

// Get preset skills based on selected role
const presetSkills = computed(() => {
  return getRoleConfig(form.value.role || 'BACKEND_DEV').skills || []
})

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
  resetFormState()
  form.value.skills = [...presetSkills.value]
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
  margin-bottom: 1rem;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.header h1 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* Main content wrapper - left-right split */
.main-content-wrapper {
  display: flex;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-primary);
}

/* Left panel - Agent list */
.agent-list-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.panel-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-count {
  background: var(--accent-color);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: var(--bg-primary);
}

.agent-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;
  background: var(--bg-primary);
  border: 1px solid transparent;
}

.agent-list-item:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
}

.agent-list-item.active {
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-color);
}

.agent-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.agent-name {
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-item-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.role-tag {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.enabled-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #d1fae5;
  color: #065f46;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.enabled-badge.disabled {
  background: #fee2e2;
  color: #991b1b;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.agent-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.agent-status-indicator.idle {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.agent-status-indicator.working {
  background: #d1fae5;
  color: #065f46;
}

.agent-status-indicator.idle .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
}

.agent-status-indicator.working .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
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
  padding: 2rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Right panel - Agent detail */
.agent-detail-panel {
  flex: 1;
  background: var(--bg-primary);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-color);
}

.empty-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.empty-detail p {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--bg-secondary);
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

/* Info section */
.info-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
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
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  text-transform: uppercase;
  letter-spacing: 0.3px;
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
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.skill-tag:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

/* Stats section */
.stats-section {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.stat-item:hover {
  border-color: var(--accent-color);
}

.stat-item.running .stat-value {
  color: #0284c7;
}

.stat-item.success .stat-value {
  color: #16a34a;
}

.stat-item.failed .stat-value {
  color: #dc2626;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Executions section */
.executions-section {
  padding: 12px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-shrink: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.section-header h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.executions-list {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
}

.execution-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  transition: all 0.2s;
}

.execution-item.clickable {
  cursor: pointer;
}

.execution-item.clickable:hover {
  background-color: var(--bg-tertiary);
}

.execution-item:last-child {
  border-bottom: none;
}

.execution-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.task-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.task-status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.task-status-badge.status-todo {
  background: #fef3c7;
  color: #92400e;
}

.task-status-badge.status-in_progress {
  background: #bfdbfe;
  color: #1e40af;
}

.task-status-badge.status-done {
  background: #bbf7d0;
  color: #166534;
}

.task-status-badge.status-blocked {
  background: #fecaca;
  color: #991b1b;
}

.execution-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--text-secondary);
}

.execution-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.execution-status.status-pending {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.execution-status.status-running {
  background: #bae6fd;
  color: #075985;
}

.execution-status.status-success,
.execution-status.status-completed {
  background: #bbf7d0;
  color: #166534;
}

.execution-status.status-failed {
  background: #fecaca;
  color: #991b1b;
}

.execution-status.status-cancelled {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.execution-time {
  color: var(--text-secondary);
  font-weight: 500;
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

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}
</style>
