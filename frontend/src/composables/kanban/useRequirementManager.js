import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * Composable for managing requirements and their lifecycle
 */
export function useRequirementManager({
  selectedProjectId,
  requirementStore,
  t
}) {
  // State
  const hideConvertedRequirements = ref(false)
  const showRequirementModal = ref(false)
  const editingRequirement = ref(null)

  // Watch for project changes and fetch requirements
  watch(
    selectedProjectId,
    async (newProjectId) => {
      if (newProjectId) {
        await requirementStore.fetchRequirements(newProjectId)
      }
    },
    { immediate: true }
  )

  // Computed
  const allRequirements = computed(() => {
    if (!selectedProjectId.value) return []
    return requirementStore.requirements || []
  })

  const requirements = computed(() => {
    const reqs = allRequirements.value
    if (hideConvertedRequirements.value) {
      return reqs.filter(r => r.status !== 'CONVERTED')
    }
    return reqs
  })

  // Actions
  function openRequirementModal(requirement = null) {
    editingRequirement.value = requirement
    showRequirementModal.value = true
  }

  function closeRequirementModal() {
    showRequirementModal.value = false
    editingRequirement.value = null
  }

  async function handleRequirementSubmit(data) {
    try {
      if (editingRequirement.value) {
        // Update existing
        const result = await requirementStore.updateRequirement(editingRequirement.value.id, data)
        if (result && result.success) {
          ElMessage.success(t('requirement.updateSuccess'))
        } else {
          ElMessage.error(t('requirement.updateFailed'))
        }
      } else {
        // Create new
        const result = await requirementStore.createRequirement({ ...data, project_id: selectedProjectId.value })
        if (result && result.success) {
          ElMessage.success(t('requirement.createSuccess'))
        } else {
          ElMessage.error(t('requirement.createFailed'))
        }
      }
      closeRequirementModal()
      return true
    } catch (error) {
      console.error('Failed to save requirement:', error)
      ElMessage.error(error.message || t('requirement.saveFailed'))
      return false
    }
  }

  async function handleDeleteRequirement(requirementId) {
    if (confirm(t('requirement.confirmDelete'))) {
      const result = await requirementStore.deleteRequirement(requirementId)
      if (result && result.success) {
        ElMessage.success(t('requirement.deleteSuccess'))
      } else {
        ElMessage.error(t('requirement.deleteFailed'))
      }
    }
  }

  return {
    // State
    hideConvertedRequirements,
    showRequirementModal,
    editingRequirement,
    // Computed
    allRequirements,
    requirements,
    // Actions
    openRequirementModal,
    closeRequirementModal,
    handleRequirementSubmit,
    handleDeleteRequirement
  }
}
