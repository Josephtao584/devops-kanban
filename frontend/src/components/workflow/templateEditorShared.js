export const MIN_WORKFLOW_TEMPLATE_STEPS = 1

export const normalizeWorkflowStep = (step = {}) => ({
  id: step.id ?? '',
  name: step.name ?? '',
  instructionPrompt: step.instructionPrompt ?? '',
  agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null,
  requiresConfirmation: step.requiresConfirmation === true,
  canEarlyExit: step.canEarlyExit === true
})

export const normalizeWorkflowTemplate = (template, emptyValue = null) => {
  if (!template) return emptyValue

  return {
    ...template,
    steps: Array.isArray(template.steps) ? template.steps.map(normalizeWorkflowStep) : []
  }
}

export const sanitizeWorkflowStep = (step = {}) => ({
  id: (step.id || '').trim(),
  name: (step.name || '').trim(),
  instructionPrompt: (step.instructionPrompt || '').trim(),
  agentId: typeof step.agentId === 'number' && Number.isFinite(step.agentId) ? step.agentId : null,
  requiresConfirmation: step.requiresConfirmation === true,
  canEarlyExit: step.canEarlyExit === true
})

export const createEmptyWorkflowStep = (defaultName = '') => ({
  id: '',
  name: defaultName,
  instructionPrompt: '',
  agentId: null,
  requiresConfirmation: false,
  canEarlyExit: false
})

export const insertWorkflowStep = (steps = [], targetIndex, position = 'after', step = createEmptyWorkflowStep()) => {
  const normalizedSteps = Array.isArray(steps) ? [...steps] : []
  const baseIndex = Math.max(0, Math.min(targetIndex, normalizedSteps.length - 1))
  const insertIndex = position === 'before' ? baseIndex : baseIndex + 1
  normalizedSteps.splice(insertIndex, 0, step)
  return {
    steps: normalizedSteps,
    insertedIndex: insertIndex
  }
}

export const removeWorkflowStep = (steps = [], targetIndex, options = {}) => {
  const { minSteps = MIN_WORKFLOW_TEMPLATE_STEPS } = options
  const normalizedSteps = Array.isArray(steps) ? [...steps] : []

  if (normalizedSteps.length <= minSteps) {
    return {
      steps: normalizedSteps,
      removed: false
    }
  }

  normalizedSteps.splice(targetIndex, 1)
  return {
    steps: normalizedSteps,
    removed: true
  }
}

export const resolveSelectedStepIndexAfterRemoval = (selectedIndex, removedIndex, nextLength) => {
  if (nextLength <= 0) return 0
  if (selectedIndex > removedIndex) return selectedIndex - 1
  if (selectedIndex === removedIndex) return Math.max(0, Math.min(removedIndex - 1, nextLength - 1))
  return Math.min(selectedIndex, nextLength - 1)
}

const slugifyWorkflowStepName = (value = '') => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const createGeneratedWorkflowStepId = (step, index, usedIds) => {
  const base = slugifyWorkflowStepName(step.name) || `step-${index + 1}`
  let candidate = base
  let suffix = 2

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  usedIds.add(candidate)
  return candidate
}

export const buildWorkflowStepsPayload = (steps = []) => {
  const usedIds = new Set()

  return steps.map((step, index) => {
    const normalizedStep = sanitizeWorkflowStep(step)
    const generatedId = normalizedStep.id || createGeneratedWorkflowStepId(normalizedStep, index, usedIds)
    usedIds.add(generatedId)

    return {
      id: generatedId,
      name: normalizedStep.name,
      instructionPrompt: normalizedStep.instructionPrompt,
      agentId: normalizedStep.agentId,
      requiresConfirmation: normalizedStep.requiresConfirmation,
      canEarlyExit: normalizedStep.canEarlyExit,
    }
  })
}

export const buildWorkflowTemplatePayload = (currentTemplate) => ({
  template_id: currentTemplate?.template_id ?? '',
  name: currentTemplate?.name?.trim?.() || '',
  tags: Array.isArray(currentTemplate?.tags) ? currentTemplate.tags : [],
  steps: buildWorkflowStepsPayload(currentTemplate?.steps || [])
})

export const validateWorkflowTemplatePayload = (currentTemplate, t, options = {}) => {
  const {
    requireTemplateName = true,
    requireAssignedAgent = true,
    requireExistingEnabledAgent = false,
    isMissingAgent = () => false,
    isDisabledAgent = () => false,
    minSteps = MIN_WORKFLOW_TEMPLATE_STEPS
  } = options

  const template = buildWorkflowTemplatePayload(currentTemplate)

  if (requireTemplateName && !template.name) {
    return t('workflowTemplate.templateNameRequired')
  }

  if (template.steps.length < minSteps) {
    return t('workflowTemplate.minimumStepsHint', { count: minSteps })
  }

  const seenIds = new Set()
  for (const step of template.steps) {
    if (!step.name) {
      return t('workflowTemplate.stepNameRequired')
    }
    if (!step.id || seenIds.has(step.id)) {
      return t('workflowTemplate.stepIdUnique')
    }
    seenIds.add(step.id)
    if (requireAssignedAgent && typeof step.agentId !== 'number') {
      return t('workflowTemplate.stepAgentRequired')
    }
    if (!step.instructionPrompt) {
      return t('workflowTemplate.stepPromptRequired')
    }
    if (requireExistingEnabledAgent && typeof step.agentId === 'number' && (isMissingAgent(step) || isDisabledAgent(step))) {
      return t('workflowTemplate.stepAgentRequired')
    }
  }

  return ''
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
