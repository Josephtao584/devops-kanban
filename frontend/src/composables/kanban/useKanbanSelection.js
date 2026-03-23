import { ref, computed, watch } from 'vue'

const LAST_PROJECT_KEY = 'kanban-selected-project-id'
const LAST_ITERATION_KEY = 'kanban-selected-iteration-id'
const DEFAULT_ITERATION_NAME = '26.3.0'

export function useKanbanSelection({ route, projectStore, taskStore, iterationStore }) {
  const selectedProjectId = ref('')
  const selectedIterationId = ref(null)
  const viewMode = ref(localStorage.getItem('kanban-view-mode') || 'list')

  const projectIterations = computed(() => {
    if (!selectedProjectId.value) return []
    return iterationStore.iterations.filter(i => String(i.project_id) === selectedProjectId.value)
  })

  const restoreIterationSelection = () => {
    const storedIterationId = localStorage.getItem(LAST_ITERATION_KEY)
    if (storedIterationId === '__ALL__') {
      selectedIterationId.value = null
      return
    }

    const targetIteration = storedIterationId
      ? iterationStore.iterations.find(i => String(i.id) === storedIterationId)
      : null

    if (targetIteration) {
      selectedIterationId.value = Number(targetIteration.id)
      return
    }

    const defaultIteration = iterationStore.iterations.find(i => i.name === DEFAULT_ITERATION_NAME)
    if (defaultIteration) {
      selectedIterationId.value = Number(defaultIteration.id)
      localStorage.setItem(LAST_ITERATION_KEY, String(defaultIteration.id))
    }
  }

  const loadProjectData = async (projectId) => {
    if (!projectId) {
      taskStore.clearTasks()
      iterationStore.clearError()
      selectedIterationId.value = null
      return
    }

    await taskStore.fetchTasks(projectId)
    await iterationStore.fetchByProject(projectId)
    restoreIterationSelection()
  }

  const onProjectChange = async () => {
    selectedIterationId.value = null
    if (selectedProjectId.value) {
      localStorage.setItem(LAST_PROJECT_KEY, selectedProjectId.value)
      await loadProjectData(selectedProjectId.value)
    } else {
      taskStore.clearTasks()
    }
  }

  const initializeSelection = async () => {
    await projectStore.fetchProjects()

    const routeProjectId = route.params.projectId ? String(route.params.projectId) : null
    const storedProjectId = localStorage.getItem(LAST_PROJECT_KEY)

    let targetProjectId = routeProjectId || storedProjectId
    if (!targetProjectId || !projectStore.projects.find(p => String(p.id) === targetProjectId)) {
      targetProjectId = projectStore.projects[0]?.id ? String(projectStore.projects[0].id) : ''
    }

    if (targetProjectId) {
      selectedProjectId.value = targetProjectId
      localStorage.setItem(LAST_PROJECT_KEY, targetProjectId)
      await loadProjectData(targetProjectId)
    }
  }

  watch(viewMode, (newValue) => {
    localStorage.setItem('kanban-view-mode', newValue)
  })

  watch(selectedIterationId, (newValue) => {
    if (newValue) {
      localStorage.setItem(LAST_ITERATION_KEY, String(newValue))
    } else {
      localStorage.setItem(LAST_ITERATION_KEY, '__ALL__')
    }
  })

  return {
    selectedProjectId,
    selectedIterationId,
    viewMode,
    projectIterations,
    initializeSelection,
    onProjectChange,
    loadProjectData,
  }
}

export default useKanbanSelection
