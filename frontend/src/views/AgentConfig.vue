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

          <!-- MCP 服务器 -->
          <div class="skills-section">
            <span class="section-label">{{ $t('agent.mcpServers') }}</span>
            <div class="skills-tags">
              <span v-for="name in getVisibleAgentMcpServers(selectedAgent)" :key="name" class="skill-tag mcp-tag">
                {{ name }}
              </span>
              <span v-if="getVisibleAgentMcpServers(selectedAgent).length === 0" class="no-items-hint">-</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <BaseDialog
      v-model="showForm"
      :title="editingAgent ? $t('agent.editAgent') : $t('agent.createAgent')"
      width="520px"
    >
      <el-form data-testid="agent-form" label-position="top" @submit.prevent="saveAgent">
        <el-form-item :label="$t('agent.agentName')">
          <el-input v-model="form.name" data-testid="agent-name-input" />
        </el-form-item>

        <el-form-item :label="$t('agent.agentType')">
          <el-select v-model="form.executorType" data-testid="agent-executor-type-select" style="width: 100%">
            <el-option value="CLAUDE_CODE" :label="$t('agent.types.CLAUDE_CODE')" />
            <el-option value="OPEN_CODE" :label="$t('agent.types.OPEN_CODE')" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('agent.role')">
          <el-select v-model="form.role" style="width: 100%" @change="onRoleChange">
            <el-option v-for="opt in roleOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
          </el-select>
        </el-form-item>

        <el-form-item :label="$t('agent.skills')">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
            <el-select v-model="selectedSkillToAdd" :placeholder="$t('agent.selectExistingSkill')" style="width: 100%" @change="addSelectedSkill">
              <el-option v-for="skill in availableSkillOptions" :key="skill" :value="skill" :label="skillStore.skills.find(s => s.id === skill)?.name" />
            </el-select>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              <el-tag v-for="(skillId, index) in form.skills" :key="index" closable @close="removeSkill(index)">
                {{ skillStore.skills.find(s => s.id === skillId)?.name }}
              </el-tag>
            </div>
          </div>
        </el-form-item>

        <el-form-item :label="$t('agent.mcpServers')">
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">
            <el-select v-model="selectedMcpServerToAdd" :placeholder="$t('agent.selectMcpServer')" style="width: 100%" @change="addSelectedMcpServer">
              <el-option v-for="server in availableMcpServerOptions" :key="server.id" :value="server.id" :label="server.name" />
            </el-select>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              <el-tag v-for="(serverId, index) in form.mcpServers" :key="index" closable @close="removeMcpServer(index)">
                {{ mcpServerStore.mcpServers.find(s => s.id === serverId)?.name }}
              </el-tag>
            </div>
          </div>
        </el-form-item>

        <el-form-item :label="$t('agent.description')">
          <el-input v-model="form.description" :placeholder="$t('agent.descriptionPlaceholder')" />
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="form.enabled">{{ $t('common.enabled') }}</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeForm">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="saving" @click="saveAgent">{{ saving ? $t('common.loading') : $t('common.save') }}</el-button>
      </template>
    </BaseDialog>

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
import { useMcpServerStore } from '../stores/mcpServerStore'
import { ROLE_CONFIG, getRoleConfig } from '../constants/agent'
import BaseDialog from '../components/BaseDialog.vue'

const { t, locale } = useI18n()
const agentStore = useAgentStore()
const skillStore = useSkillStore()
const mcpServerStore = useMcpServerStore()

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
  skills: [],
  mcpServers: []
})

const selectedSkillToAdd = ref('')
const selectedMcpServerToAdd = ref('')
const availableSkills = computed(() => skillStore.skills.map(skill => skill.id))
const availableSkillOptions = computed(() => availableSkills.value.filter(id => !form.value.skills.includes(id)))
const availableMcpServerOptions = computed(() => mcpServerStore.mcpServers.filter(s => !form.value.mcpServers.includes(s.id)))

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
    skills: normalizedSkills,
    mcpServers: Array.isArray(agent?.mcpServers) ? [...agent.mcpServers] : []
  }
  selectedSkillToAdd.value = ''
  selectedMcpServerToAdd.value = ''
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
  skills: [...form.value.skills],
  mcpServers: [...form.value.mcpServers]
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
      skillStore.fetchSkills(),
      mcpServerStore.fetchMcpServers()
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
  selectedMcpServerToAdd.value = ''
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

const addSelectedMcpServer = () => {
  if (selectedMcpServerToAdd.value && !form.value.mcpServers.includes(selectedMcpServerToAdd.value)) {
    form.value.mcpServers = [...form.value.mcpServers, selectedMcpServerToAdd.value]
    selectedMcpServerToAdd.value = ''
  }
}

const removeMcpServer = (index) => {
  form.value.mcpServers = form.value.mcpServers.filter((_, i) => i !== index)
}

const getVisibleAgentMcpServers = (agent) => {
  const servers = Array.isArray(agent?.mcpServers) ? agent.mcpServers : []
  return servers.map(id => {
    const server = mcpServerStore.mcpServers.find(s => s.id === id)
    return server ? server.name : null
  }).filter(name => name !== null)
}

onMounted(loadAgents)
</script>

<style scoped>
@import '../styles/config-page.css';

.agent-config {
  padding: 0;
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
  border-color: rgba(37, 198, 201, 0.35);
}

.agent-list-item.active {
  background: var(--hover-bg);
  border: 1px solid var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(37, 198, 201, 0.1);
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

.agent-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.agent-title-row h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--text-primary);
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

.skill-tag.mcp-tag {
  background: rgba(37, 198, 201, 0.08);
  color: #1EA9AC;
  border-color: rgba(37, 198, 201, 0.14);
}

.skill-tag-input.mcp-tag-input {
  background: #25C6C9;
}

.no-items-hint {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
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
  box-shadow: 0 0 0 2px rgba(37, 198, 201, 0.1);
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

</style>
