import { ref } from 'vue'

/**
 * Composable for managing workflow state and interactions
 */
export function useWorkflowManager({
  selectedTask,
  selectedProjectId,
  showWorkflowDialog,
  t
}) {
  const selectedNodeId = ref(null)
  const selectedNode = ref(null)
  const showNodeDialog = ref(false)
  const workflowVersion = ref(0)

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
   * Start workflow for selected task
   */
  async function onStartWorkflow() {
    if (!selectedTask.value) {
      return
    }

    console.log('Starting workflow for task:', selectedTask.value)
  }

  return {
    selectedNodeId,
    selectedNode,
    showNodeDialog,
    workflowVersion,
    onNodeSelect,
    onNodeViewDetails,
    handleButlerControl,
    handleViewWorkflow,
    onStartWorkflow
  }
}
