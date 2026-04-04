import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useKanbanSelection } from '../src/composables/kanban/useKanbanSelection'

describe('useKanbanSelection', () => {
  let route, projectStore, taskStore, iterationStore

  beforeEach(() => {
    localStorage.clear()
    route = { params: {} }

    projectStore = {
      projects: [{ id: 1, name: 'Project A' }, { id: 2, name: 'Project B' }],
      fetchProjects: vi.fn(async () => {})
    }
    taskStore = {
      fetchTasks: vi.fn(async () => {}),
      clearTasks: vi.fn()
    }
    iterationStore = {
      iterations: [
        { id: 10, name: 'Sprint 1', project_id: 1 },
        { id: 20, name: '26.3.0', project_id: 1 },
        { id: 30, name: 'Sprint 2', project_id: 2 }
      ],
      fetchByProject: vi.fn(async () => {}),
      clearError: vi.fn()
    }
  })

  function createSelection() {
    return useKanbanSelection({ route, projectStore, taskStore, iterationStore })
  }

  it('projectIterations filters by selectedProjectId', () => {
    const sel = createSelection()
    sel.selectedProjectId.value = '1'
    expect(sel.projectIterations.value).toHaveLength(2)
    expect(sel.projectIterations.value[0].id).toBe(10)
    expect(sel.projectIterations.value[1].id).toBe(20)
  })

  it('projectIterations returns empty for no project', () => {
    const sel = createSelection()
    expect(sel.projectIterations.value).toEqual([])
  })

  it('projectIterations filters by different project', () => {
    const sel = createSelection()
    sel.selectedProjectId.value = '2'
    expect(sel.projectIterations.value).toHaveLength(1)
    expect(sel.projectIterations.value[0].id).toBe(30)
  })

  it('loadProjectData clears data when no projectId', async () => {
    const sel = createSelection()
    await sel.loadProjectData(null)
    expect(taskStore.clearTasks).toHaveBeenCalled()
    expect(sel.selectedIterationId.value).toBeNull()
  })

  it('loadProjectData fetches tasks and iterations', async () => {
    const sel = createSelection()
    await sel.loadProjectData('1')
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('1')
    expect(iterationStore.fetchByProject).toHaveBeenCalledWith('1')
  })

  it('onProjectChange saves to localStorage', async () => {
    const sel = createSelection()
    sel.selectedProjectId.value = '2'
    await sel.onProjectChange()
    expect(localStorage.getItem('kanban-selected-project-id')).toBe('2')
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('2')
  })

  it('onProjectChange clears tasks when no project', async () => {
    const sel = createSelection()
    sel.selectedProjectId.value = ''
    await sel.onProjectChange()
    expect(taskStore.clearTasks).toHaveBeenCalled()
  })

  it('initializeSelection uses route param over localStorage', async () => {
    route.params.projectId = '2'
    localStorage.setItem('kanban-selected-project-id', '1')

    const sel = createSelection()
    await sel.initializeSelection()

    expect(sel.selectedProjectId.value).toBe('2')
  })

  it('initializeSelection falls back to localStorage', async () => {
    localStorage.setItem('kanban-selected-project-id', '2')

    const sel = createSelection()
    await sel.initializeSelection()

    expect(sel.selectedProjectId.value).toBe('2')
  })

  it('initializeSelection falls back to first project', async () => {
    const sel = createSelection()
    await sel.initializeSelection()

    expect(sel.selectedProjectId.value).toBe('1')
  })

  it('initializeSelection handles empty project list', async () => {
    projectStore.projects = []

    const sel = createSelection()
    await sel.initializeSelection()

    expect(sel.selectedProjectId.value).toBe('')
  })

  it('initializeSelection handles invalid stored project', async () => {
    localStorage.setItem('kanban-selected-project-id', '999')

    const sel = createSelection()
    await sel.initializeSelection()

    expect(sel.selectedProjectId.value).toBe('1') // falls back to first
  })

  it('exposes viewMode ref', () => {
    const sel = createSelection()
    expect(sel.viewMode).toBeDefined()
    expect(sel.viewMode.value).toBe('list') // default from empty localStorage
  })

  it('viewMode initializes from localStorage', () => {
    localStorage.setItem('kanban-view-mode', 'board')
    const sel = createSelection()
    expect(sel.viewMode.value).toBe('board')
  })
})
