const STATUS_MAP = {
  PENDING: 'PENDING',
  RUNNING: 'IN_PROGRESS',
  SUSPENDED: 'SUSPENDED',
  COMPLETED: 'DONE',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  DONE: 'DONE',
  IN_PROGRESS: 'IN_PROGRESS'
}

export const normalizeWorkflowStatus = (status) => STATUS_MAP[status] || status || 'PENDING'

export const getAllNodes = (workflow) => {
  if (!workflow?.stages) return []
  return workflow.stages.flatMap(stage => stage.nodes || [])
}

export const getWorkflowProgress = (workflow) => {
  const nodes = getAllNodes(workflow)
  if (nodes.length === 0) {
    return { completed: 0, total: 0, percent: 0 }
  }
  const completed = nodes.filter(node => node.status === 'DONE').length
  return {
    completed,
    total: nodes.length,
    percent: Math.round((completed / nodes.length) * 100)
  }
}

export const getWorkflowDisplayStatus = (run) => {
  if (!run) return 'pending'
  if (run.status === 'RUNNING' || run.status === 'PENDING') return 'running'
  if (run.status === 'SUSPENDED') {
    const hasSuspendedStep = Array.isArray(run.steps) && run.steps.some((step) => step.status === 'SUSPENDED')
    return hasSuspendedStep ? 'suspended' : 'running'
  }
  if (run.status === 'COMPLETED') return 'done'
  if (run.status === 'FAILED') return 'failed'
  if (run.status === 'CANCELLED') return 'cancelled'
  return 'pending'
}

export const toTimelineWorkflow = (run) => {
  if (!run) return null

  const snapshotSteps = run.workflow_template_snapshot?.steps || []
  const snapshotById = new Map(snapshotSteps.map(step => [step.id, step]))

  return {
    id: run.id,
    name: run.workflow_template_snapshot?.name || run.workflow_id || 'Workflow',
    currentNodeId: run.current_step,
    stages: (run.steps || []).map((step, index) => {
      const snapshot = snapshotById.get(step.step_id)
      return {
        id: step.step_id,
        name: step.name,
        order: index,
        nodes: [
          {
            id: step.step_id,
            name: step.name,
            status: normalizeWorkflowStatus(step.status),
            started_at: step.started_at,
            completed_at: step.completed_at,
            error: step.error,
            output: step.output,
            sessionId: step.session_id ?? null,
            providerSessionId: step.provider_session_id ?? null,
            agentId: step.agent_id ?? snapshot?.agentId ?? null,
          }
        ]
      }
    })
  }
}

export const getCurrentWorkflowNode = (run, workflow) => {
  if (!run || !workflow?.stages) return null

  if (run.current_step) {
    for (const stage of workflow.stages) {
      const node = (stage.nodes || []).find(item => item.id === run.current_step)
      if (node) return node
    }
  }

  const allNodes = getAllNodes(workflow)
  return allNodes.find(node => node.status === 'IN_PROGRESS')
    || allNodes.find(node => node.status === 'FAILED')
    || null
}
