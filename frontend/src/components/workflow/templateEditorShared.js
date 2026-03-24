export const normalizeWorkflowStep = (step = {}) => ({
  id: step.id ?? '',
  name: step.name ?? '',
  instructionPrompt: step.instructionPrompt ?? '',
  agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null
})

export const normalizeWorkflowTemplate = (template, emptyValue = null) => {
  if (!template) return emptyValue

  return {
    ...template,
    steps: Array.isArray(template.steps) ? template.steps.map(normalizeWorkflowStep) : []
  }
}

export const getAgentDisplayName = (agent, t) => agent?.name || t('workflowTemplate.agentFallbackName', { id: agent?.id ?? '' })

export const formatExecutorType = (agent) => {
  const executorType = agent?.executorType || agent?.type
  if (!executorType) return ''

  return executorType
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const formatAgentOption = (agent, t) => {
  const parts = [getAgentDisplayName(agent, t)]
  const executorType = formatExecutorType(agent)

  if (executorType) {
    parts.push(`(${executorType})`)
  }

  if (agent?.enabled === false) {
    parts.push(`(${t('workflowTemplate.disabled')})`)
  }

  return parts.join(' ')
}

export const createAgentLookup = (agents) => (agentId) => agents.find((agent) => agent.id === agentId) || null

export const isMissingAgent = (step, getAgentById) => {
  if (typeof step?.agentId !== 'number') return false
  return !getAgentById(step.agentId)
}

export const isDisabledAgent = (step, getAgentById) => {
  if (typeof step?.agentId !== 'number') return false
  return getAgentById(step.agentId)?.enabled === false
}

export const formatBoundAgentState = (step, getAgentById, t) => {
  const agent = getAgentById(step?.agentId)
  if (!agent) return ''
  return `${getAgentDisplayName(agent, t)} (${t('workflowTemplate.disabled')})`
}
