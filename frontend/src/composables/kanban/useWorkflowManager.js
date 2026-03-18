import { ref, computed } from 'vue'
import { useSessionManager } from '../useSessionManager'

/**
 * Composable for managing workflow state and interactions
 */
export function useWorkflowManager({
  selectedTask,
  selectedProjectId,
  showWorkflowDialog,
  getWorkflowByTask,
  getWorkflowByProject,
  t
}) {
  const selectedNodeId = ref(null)
  const selectedNode = computed(() => {
    if (!selectedNodeId.value || !currentWorkflow.value) {
      return null
    }
    return findNodeById(currentWorkflow.value, selectedNodeId.value)
  })
  const showNodeDialog = ref(false)
  const workflowVersion = ref(0)
  const currentWorkflow = computed(() => {
    if (selectedProjectId.value) {
      return getWorkflowByProject(selectedProjectId.value)
    }
    return null
  })

  // Session manager
  const { createSession, startSession, setSession, clearSession } = useSessionManager()

  /**
   * Find node by ID in workflow
   */
  function findNodeById(workflow, nodeId) {
    if (!workflow || !workflow.stages) {
      return null
    }
    for (const stage of workflow.stages) {
      for (const node of stage.nodes) {
        if (node.id === nodeId) {
          return node
        }
      }
    }
    return null
  }

  /**
   * Handle node selection
   */
  function onNodeSelect(node) {
    selectedNodeId.value = node.id
    selectedNode.value = node
  }

  /**
   * Handle node view details
   */
  function onNodeViewDetails(node) {
    selectedNodeId.value = node.id
    showNodeDialog.value = true
  }

  /**
   * Handle butler control (start/stop workflow)
   */
  async function handleButlerControl(action) {
    if (!selectedTask.value) {
      return
    }

    if (action === 'start') {
      await onStartWorkflow()
    } else if (action === 'stop') {
      // Stop current session
      // This would require session management integration
      console.log('Stopping workflow')
    }
  }

  /**
   * Handle view workflow
   */
  function handleViewWorkflow() {
    showWorkflowDialog.value = true
  }

  /**
   * Handle session created event from WorkflowNodeCard
   */
  async function onNodeSessionCreated({ node, session }) {
    if (session) {
      setSession(session)
    }
  }

  /**
   * Start workflow for selected task
   */
  async function onStartWorkflow() {
    if (!selectedTask.value) {
      return
    }

    // Get or create workflow
    let workflow = getWorkflowByTask(selectedTask.value.id)
    if (!workflow) {
      workflow = getWorkflowByProject(selectedProjectId.value)
    }

    if (!workflow) {
      console.warn('No workflow found for task')
      return
    }

    // Create session for the task
    // This would typically use an agent adapter
    console.log('Starting workflow for task:', selectedTask.value)
  }

  return {
    selectedNodeId,
    selectedNode,
    showNodeDialog,
    workflowVersion,
    currentWorkflow,
    onNodeSelect,
    onNodeViewDetails,
    handleButlerControl,
    handleViewWorkflow,
    onNodeSessionCreated,
    onStartWorkflow
  }
}
