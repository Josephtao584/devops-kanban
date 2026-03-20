import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TaskSourceConfig from '../src/views/TaskSourceConfig.vue'
import i18n from '../src/locales'
import { useProjectStore } from '../src/stores/projectStore'
import { useTaskSourceStore } from '../src/stores/taskSourceStore'

const mockProjects = [
  { id: 'project-1', name: 'Demo Project', gitUrl: 'https://github.com/org/repo.git' }
]

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

let pinia

function mountView() {
  return mount(TaskSourceConfig, {
    global: {
      plugins: [pinia, i18n]
    }
  })
}

describe('TaskSourceConfig', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.restoreAllMocks()

    const projectStore = useProjectStore()
    const taskSourceStore = useTaskSourceStore()

    projectStore.fetchProjects = vi.fn().mockImplementation(async () => {
      projectStore.projects = mockProjects
      return { success: true, data: mockProjects }
    })

    taskSourceStore.fetchTaskSources = vi.fn().mockResolvedValue({ success: true, data: [] })
    taskSourceStore.loadAvailableTypes = vi.fn().mockResolvedValue([])
    taskSourceStore.loading = false
    taskSourceStore.taskSources = []
  })

  it('renders backend-configured sources in read-only mode', async () => {
    const taskSourceStore = useTaskSourceStore()
    taskSourceStore.taskSources = [
      {
        id: 'requirement-orders',
        name: 'Orders 需求池',
        type: 'REQUIREMENT',
        last_sync_at: '2026-03-20T10:00:00.000Z'
      }
    ]

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('任务源由后端 config.yaml 提供')
    expect(wrapper.text()).toContain('Orders 需求池')
    expect(wrapper.text()).toContain('标识: requirement-orders')
    expect(wrapper.text()).toContain('需求池')
    expect(wrapper.text()).not.toContain('测试连接')
    expect(wrapper.text()).not.toContain('立即同步')
    expect(useTaskSourceStore().loadAvailableTypes).toHaveBeenCalledTimes(1)
  })

  it('loads task sources when project selection changes', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskSourceStore = useTaskSourceStore()
    taskSourceStore.fetchTaskSources.mockClear()

    const select = wrapper.find('#project')
    await select.setValue('project-1')
    await flushPromises()

    expect(taskSourceStore.fetchTaskSources).toHaveBeenCalledWith('project-1')
  })
})
