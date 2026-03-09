<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal task-generate-modal">
      <div class="modal-header">
        <h2>{{ $t('requirement.generateTasks') }}</h2>
        <button class="modal-close" @click="handleClose">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Step indicator -->
        <div class="step-indicator">
          <div class="step" :class="{ active: step === 1, completed: step > 1 }">
            <span class="step-number">1</span>
            <span class="step-label">{{ $t('requirement.selectAgents') }}</span>
          </div>
          <div class="step-line" :class="{ active: step > 1 }"></div>
          <div class="step" :class="{ active: step === 2 }">
            <span class="step-number">2</span>
            <span class="step-label">{{ $t('requirement.confirmWorkflow') }}</span>
          </div>
        </div>

        <!-- Step 1: Select Agents -->
        <div v-if="step === 1" class="step-content">
          <div class="step-header">
            <p class="step-hint">{{ $t('requirement.selectAgentsHint') }}</p>
            <div class="selected-count" v-if="selectedAgentIds.length > 0">
              <span class="count-badge">{{ selectedAgentIds.length }}</span>
              {{ $t('requirement.agentsSelected') }}
            </div>
          </div>

          <div v-if="loadingAgents" class="loading-state">
            <svg class="icon-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            <span>{{ $t('common.loading') }}</span>
          </div>

          <div v-else-if="agents.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                <circle cx="12" cy="5" r="2"></circle>
                <path d="M12 7v4"></path>
              </svg>
            </div>
            <p>{{ $t('requirement.noAgentsAvailable') }}</p>
          </div>

          <div v-else class="agent-grid">
            <div
              v-for="agent in agents"
              :key="agent.id"
              class="agent-card"
              :class="{ selected: selectedAgentIds.includes(agent.id) }"
              @click="toggleAgent(agent.id)"
            >
              <div class="agent-checkbox">
                <svg v-if="selectedAgentIds.includes(agent.id)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div class="agent-avatar" :style="{ background: getAgentRoleColor(agent) }">
                <span class="agent-icon">{{ getAgentIcon(agent) }}</span>
              </div>
              <div class="agent-details">
                <span class="agent-name">{{ agent.name }}</span>
                <span class="agent-type">
                  <span class="type-dot" :style="{ background: getAgentRoleColor(agent) }"></span>
                  {{ getAgentRoleName(agent) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Confirm Workflow -->
        <div v-if="step === 2" class="step-content">
          <p class="step-hint">{{ $t('requirement.workflowPreviewHint') }}</p>

          <div class="workflow-preview">
            <div class="requirement-summary">
              <h4>{{ requirement?.title }}</h4>
              <p>{{ requirement?.description }}</p>
            </div>

            <div class="workflow-stages">
              <div
                v-for="(stage, index) in generatedWorkflow.stages"
                :key="index"
                class="workflow-stage"
              >
                <div class="stage-header">
                  <span class="stage-order">{{ index + 1 }}</span>
                  <span class="stage-name">{{ stage.name }}</span>
                </div>
                <div class="stage-nodes">
                  <div
                    v-for="node in stage.nodes"
                    :key="node.id"
                    class="workflow-node"
                  >
                    <div class="node-avatar" :style="{ background: node.agentColor }">
                      {{ node.agentIcon }}
                    </div>
                    <div class="node-info">
                      <span class="node-task-name">{{ node.task?.title || node.agentName }}</span>
                      <span class="node-agent-info">
                        <span class="node-agent">{{ node.agentName }}</span>
                        <span class="node-divider">|</span>
                        <span class="node-role">{{ node.role }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="modal-actions">
          <button v-if="step === 1" class="btn btn-secondary" @click="handleClose">
            {{ $t('common.cancel') }}
          </button>
          <button v-if="step === 2" class="btn btn-secondary" @click="step = 1">
            {{ $t('common.back') }}
          </button>
          <button
            v-if="step === 1"
            class="btn btn-primary"
            :disabled="selectedAgentIds.length === 0"
            @click="goToStep2"
          >
            {{ $t('common.next') }}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button
            v-if="step === 2"
            class="btn btn-primary"
            :disabled="generating"
            @click="confirmGenerate"
          >
            <svg v-if="generating" class="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
            </svg>
            {{ $t('requirement.confirmGenerate') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getAgents } from '../../api/agent'
import { getRoleConfig, ROLE_CONFIG } from '../../constants/agent'
import { analyzeRequirementToTasks } from '../../mock/requirementAnalysis'
import { TASK_CATEGORY } from '../../constants/task'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  requirement: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'confirm'])

const { t } = useI18n()

const step = ref(1)
const agents = ref([])
const selectedAgentIds = ref([])
const loadingAgents = ref(false)
const generating = ref(false)
const generatedWorkflow = ref({ stages: [] })

const loadAgents = async () => {
  loadingAgents.value = true
  try {
    const response = await getAgents()
    console.log('[TaskGenerateDialog] Raw response:', response)

    // Handle different response formats:
    // - Mock API: axios returns { success, message, data: [agents] } (after interceptor)
    // - Real API: axios returns { success, message, data: [agents] } or [agents]
    let agentList = []

    if (Array.isArray(response)) {
      // Direct array response
      agentList = response
    } else if (response && typeof response === 'object') {
      if (Array.isArray(response.data)) {
        // response.data is the agents array
        agentList = response.data
      } else if (response.data && Array.isArray(response.data.data)) {
        // Nested data property (unusual case)
        agentList = response.data.data
      } else if (response.success && response.data) {
        // Standard API response format
        agentList = Array.isArray(response.data) ? response.data : []
      }
    }

    agents.value = agentList
    console.log('[TaskGenerateDialog] Loaded agents:', agents.value.length, agents.value)

    if (agents.value.length === 0) {
      console.warn('[TaskGenerateDialog] No agents loaded. Check if demo mode is enabled or backend is running.')
    }
  } catch (error) {
    console.error('[TaskGenerateDialog] Failed to load agents:', error)
    agents.value = []
    ElMessage.error(t('requirement.loadAgentsFailed'))
  } finally {
    loadingAgents.value = false
  }
}

// Load agents when dialog opens
watch(() => props.visible, (val) => {
  if (val) {
    step.value = 1
    selectedAgentIds.value = []
    generatedWorkflow.value = { stages: [] }
    loadAgents()
  }
}, { immediate: true })

const formatAgentType = (type) => {
  if (!type) return 'Unknown'
  return type.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, l => l.toUpperCase())
}

// Get agent icon based on role
const getAgentIcon = (agent) => {
  const roleConfig = getRoleConfig(agent.role)
  return roleConfig.icon
}

// Get agent color based on role
const getAgentRoleColor = (agent) => {
  const roleConfig = getRoleConfig(agent.role)
  return roleConfig.color
}

// Get role display name
const getAgentRoleName = (agent) => {
  const roleConfig = getRoleConfig(agent.role)
  return roleConfig.name
}

const toggleAgent = (agentId) => {
  const index = selectedAgentIds.value.indexOf(agentId)
  if (index === -1) {
    selectedAgentIds.value.push(agentId)
  } else {
    selectedAgentIds.value.splice(index, 1)
  }
}

const goToStep2 = () => {
  if (selectedAgentIds.value.length === 0) {
    ElMessage.warning(t('requirement.selectAtLeastOneAgent'))
    return
  }

  // Generate workflow preview
  generateWorkflowPreview()
  step.value = 2
}

const generateWorkflowPreview = () => {
  const selectedAgents = agents.value.filter(a => selectedAgentIds.value.includes(a.id))

  // Analyze requirement to get task list
  const analysisResult = analyzeRequirementToTasks(props.requirement)
  const tasks = analysisResult.tasks || []

  // Group tasks by category for stage assignment
  const designTasks = tasks.filter(t => t.category === TASK_CATEGORY.DESIGN)
  const devTasks = tasks.filter(t =>
    t.category === TASK_CATEGORY.FEATURE ||
    t.category === TASK_CATEGORY.BUG_FIX ||
    t.category === TASK_CATEGORY.REFACTORING ||
    t.category === TASK_CATEGORY.DOCUMENTATION
  )
  const testTasks = tasks.filter(t => t.category === TASK_CATEGORY.TESTING)

  // Define stage templates with their task categories
  const stageTemplates = [
    { name: t('requirement.stages.design'), roles: [t('requirement.roles.designer')], stageTasks: designTasks },
    { name: t('requirement.stages.development'), roles: [t('requirement.roles.developer')], stageTasks: devTasks },
    { name: t('requirement.stages.testing'), roles: [t('requirement.roles.tester')], stageTasks: testTasks }
  ]

  let taskIndex = 0

  const stages = stageTemplates.map((template, stageIndex) => {
    const nodes = []
    const stageTasks = template.stageTasks

    // Create nodes based on tasks in this stage
    if (stageTasks.length > 0) {
      stageTasks.forEach((task, i) => {
        const agent = selectedAgents[i % selectedAgents.length]
        const roleConfig = getRoleConfig(agent.role)
        nodes.push({
          id: `node-${Date.now()}-${stageIndex}-${i}`,
          name: `${template.roles[0]} - ${agent.name}`,
          role: template.roles[0],
          agentRole: agent.role,
          agentIcon: roleConfig.icon,
          agentColor: roleConfig.color,
          agentId: agent.id,
          agentName: agent.name,
          status: 'PENDING',
          task: {
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            labels: task.labels
          }
        })
      })
    } else {
      // If no tasks for this stage, still create a node with a placeholder task
      const agent = selectedAgents[0]
      if (agent) {
        const roleConfig = getRoleConfig(agent.role)
        nodes.push({
          id: `node-${Date.now()}-${stageIndex}-0`,
          name: `${template.roles[0]} - ${agent.name}`,
          role: template.roles[0],
          agentRole: agent.role,
          agentIcon: roleConfig.icon,
          agentColor: roleConfig.color,
          agentId: agent.id,
          agentName: agent.name,
          status: 'PENDING',
          task: null
        })
      }
    }

    return {
      id: `stage-${Date.now()}-${stageIndex}`,
      name: template.name,
      order: stageIndex + 1,
      nodes
    }
  }).filter(stage => stage.nodes.length > 0)

  generatedWorkflow.value = {
    name: `${props.requirement?.title || 'Task'} Workflow`,
    stages,
    analysisResult
  }
}

const confirmGenerate = async () => {
  generating.value = true
  try {
    emit('confirm', {
      requirement: props.requirement,
      workflow: generatedWorkflow.value,
      agentIds: selectedAgentIds.value
    })
  } finally {
    generating.value = false
  }
}

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
/* Base modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
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
  background: var(--bg-secondary);
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-tertiary);
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Button styles */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent-color) 0%, #5558e8 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
}

/* Component specific styles */
.task-generate-modal {
  width: 600px;
  max-width: 90vw;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.step {
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}

.step.active {
  opacity: 1;
}

.step.completed {
  opacity: 1;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: linear-gradient(135deg, var(--accent-color) 0%, #5558e8 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.step.completed .step-number {
  background: linear-gradient(135deg, var(--success-color) 0%, #16a34a 100%);
  color: white;
}

.step-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.step.active .step-label {
  color: var(--text-primary);
}

.step-line {
  width: 80px;
  height: 3px;
  background: var(--border-color);
  margin: 0 20px;
  border-radius: 2px;
  transition: background 0.3s ease;
}

.step-line.active {
  background: linear-gradient(90deg, var(--success-color) 0%, var(--accent-color) 100%);
}

.step-content {
  min-height: 320px;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.step-hint {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

.selected-count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: linear-gradient(135deg, var(--accent-color) 0%, #5558e8 100%);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  gap: 16px;
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  color: var(--text-secondary);
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 16px;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}

.agent-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.agent-card:hover {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.agent-card.selected {
  border-color: var(--accent-color);
  background: var(--accent-light);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15);
}

.agent-checkbox {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.agent-card.selected .agent-checkbox {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.agent-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.agent-icon {
  font-size: 22px;
  line-height: 1;
}

.agent-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Workflow Preview */
.workflow-preview {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-secondary);
}

.requirement-summary {
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  border-bottom: 1px solid var(--border-color);
}

.requirement-summary h4 {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.requirement-summary p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}

.workflow-stages {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.workflow-stage {
  display: flex;
  gap: 16px;
}

.stage-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 64px;
}

.stage-order {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-color) 0%, #5558e8 100%);
  color: white;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.stage-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
}

.stage-nodes {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workflow-node {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.node-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.node-task-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-agent-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.node-agent {
  color: var(--text-secondary);
}

.node-divider {
  opacity: 0.4;
}

.node-role {
  color: var(--text-secondary);
}

.icon-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .agent-grid {
    grid-template-columns: 1fr;
  }
}
</style>
