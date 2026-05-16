<template>
  <div class="agent-config page-shell">
    <!-- 顶部操作栏 -->
    <div class="header page-header page-header--compact">
      <div class="page-header__content">
        <h1 class="page-header__title">{{ $t('agent.title') }}</h1>
        <p class="page-header__description page-description">{{ $t('agent.pageDescription') }}</p>
      </div>
      <button class="btn btn-primary" data-testid="open-create-agent" @click="openAddForm">
        + {{ $t('agent.createAgent') }}
      </button>
    </div>

    <!-- 主内容区：左右分栏 -->
    <div class="main-content-wrapper">
      <!-- 左侧：角色列表 -->
      <AgentListSidebar
        :agents="agentStore.agents"
        :selected-id="selectedAgent?.id"
        :loading="agentStore.loading"
        @select="selectAgent($event)"
      />

      <!-- 右侧：角色详情面板 -->
      <AgentDetailPanel
        v-if="selectedAgent"
        :agent="selectedAgent"
        :skills="skillStore.skills"
        :mcp-servers="mcpServerStore.mcpServers"
        :collapsed="isChatCollapsed"
        @edit="openEditForm"
        @delete="confirmDelete"
        @toggle-enabled="toggleEnabled"
      />

      <!-- 空状态：未选中角色 -->
      <div v-else class="empty-detail">
        <p>{{ $t('agent.selectAgentHint') }}</p>
      </div>

      <!-- 第三栏：对话测试面板 -->
      <AgentChatPanel v-if="selectedAgent" :agent="selectedAgent" :collapsed="isChatCollapsed" @toggle-collapse="isChatCollapsed = !isChatCollapsed" />
    </div>

    <!-- Add/Edit Form Dialog -->
    <AgentFormDialog
      :visible="showForm"
      :is-edit="!!editingAgent"
      :form="formWithSelection"
      :saving="saving"
      @update:visible="showForm = $event"
      @save="saveAgent"
      @role-change="onRoleChange"
      @close="closeForm"
      @add-skill="handleAddSkill"
      @remove-skill="handleRemoveSkill"
      @add-mcp="handleAddMcp"
      @remove-mcp="handleRemoveMcp"
      @add-env-pair="addEnvPair"
      @remove-env-pair="removeEnvPair"
      @update:selected-skill="selectedSkillToAdd = $event"
      @update:selected-mcp="selectedMcpServerToAdd = $event"
    />

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
import AgentListSidebar from '../components/agent/AgentListSidebar.vue'
import AgentDetailPanel from '../components/agent/AgentDetailPanel.vue'
import AgentFormDialog from '../components/agent/AgentFormDialog.vue'
import AgentChatPanel from '../components/AgentChatPanel.vue'

defineOptions({ name: 'AgentConfig' })

const { t } = useI18n()
const agentStore = useAgentStore()
const skillStore = useSkillStore()
const mcpServerStore = useMcpServerStore()

const saving = ref(false)
const showForm = ref(false)
const editingAgent = ref(null)

// Selected agent for detail view
const selectedAgent = ref(null)
const isChatCollapsed = ref(false)

const form = ref({
  name: '',
  executorType: 'CLAUDE_CODE',
  role: 'BACKEND_DEV',
  description: '',
  enabled: true,
  skills: [],
  mcpServers: [],
  envPairs: [],
  settingsPath: ''
})

const selectedSkillToAdd = ref('')
const selectedMcpServerToAdd = ref('')
const availableSkills = computed(() => skillStore.skills.map(skill => skill.id))

const formWithSelection = computed(() => ({
  ...form.value,
  _selectedSkill: selectedSkillToAdd.value,
  _selectedMcp: selectedMcpServerToAdd.value
}))

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
    mcpServers: Array.isArray(agent?.mcpServers) ? [...agent.mcpServers] : [],
    envPairs: agent?.env && typeof agent.env === 'object'
      ? Object.entries(agent.env).map(([key, value]) => ({ key, value: String(value) }))
      : [],
    settingsPath: agent?.settingsPath || ''
  }
  selectedSkillToAdd.value = ''
  selectedMcpServerToAdd.value = ''
}

const buildAgentPayload = () => {
  const env = {}
  for (const pair of form.value.envPairs) {
    if (pair.key.trim()) {
      env[pair.key.trim()] = pair.value
    }
  }
  const { envPairs, ...rest } = form.value
  return {
    ...rest,
    skills: [...form.value.skills],
    mcpServers: [...form.value.mcpServers],
    env,
    settingsPath: form.value.settingsPath?.trim() || ''
  }
}

const getResponseErrorMessage = (response, fallbackMessage) => {
  return response?.message || fallbackMessage
}

const resetFormState = () => {
  setFormState(null)
}

resetFormState()

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

const handleAddSkill = (skillId) => {
  if (skillId && !form.value.skills.includes(skillId)) {
    form.value.skills = [...form.value.skills, skillId]
    selectedSkillToAdd.value = ''
  }
}

const handleRemoveSkill = (index) => {
  form.value.skills = form.value.skills.filter((_, i) => i !== index)
}

const handleAddMcp = (serverId) => {
  if (serverId && !form.value.mcpServers.includes(serverId)) {
    form.value.mcpServers = [...form.value.mcpServers, serverId]
    selectedMcpServerToAdd.value = ''
  }
}

const handleRemoveMcp = (index) => {
  form.value.mcpServers = form.value.mcpServers.filter((_, i) => i !== index)
}

const addEnvPair = () => {
  form.value.envPairs = [...form.value.envPairs, { key: '', value: '' }]
}

const removeEnvPair = (index) => {
  form.value.envPairs = form.value.envPairs.filter((_, i) => i !== index)
}

onMounted(loadAgents)
</script>

<style scoped>
@import '../styles/config-page.css';

.agent-config {
  padding: 0;
}

/* Empty state for unselected agent */
.empty-detail {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--panel-bg);
}

</style>
