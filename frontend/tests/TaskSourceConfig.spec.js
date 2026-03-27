import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import TaskSourceConfig from '../src/views/TaskSourceConfig.vue'
import i18n from '../src/locales'
import { useProjectStore } from '../src/stores/projectStore'
import { useTaskSourceStore } from '../src/stores/taskSourceStore'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {}
  })
}))

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

  it('renders backend-configured sources from the store', async () => {
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

    expect(wrapper.text()).toContain('Orders 需求池')
    expect(wrapper.text()).toContain('ID: requirement-orders')
    expect(wrapper.text()).toContain('REQUIREMENT')
    expect(wrapper.text()).toContain('同步')
    expect(wrapper.text()).toContain('测试连接')
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

  it('defines the taskSource.testing locale key', () => {
    expect(i18n.global.t('taskSource.testing')).toBe('测试中...')
  })

  it('shows INTERNAL_API friendly labels and placeholders', async () => {
    const taskSourceStore = useTaskSourceStore()
    taskSourceStore.availableTypes = [
      {
        key: 'INTERNAL_API',
        name: 'Internal API',
        configFields: {
          baseUrl: { type: 'string', required: true, description: 'base' },
          token: { type: 'string', required: false, description: 'token' },
          listPath: { type: 'string', required: true, description: 'list path' },
          detailPath: { type: 'string', required: true, description: 'detail path' },
          detailIdField: { type: 'string', required: false, description: 'detail field' }
        }
      }
    ]

    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.formData.type = 'INTERNAL_API'

    expect(wrapper.vm.getFieldLabel('baseUrl', {})).toBe('API 基础地址')
    expect(wrapper.vm.getFieldLabel('listPath', {})).toBe('列表接口路径')
    expect(wrapper.vm.getFieldLabel('detailPath', {})).toBe('详情接口路径模板')
    expect(wrapper.vm.getFieldLabel('detailIdField', {})).toBe('详情ID字段')

    expect(wrapper.vm.getFieldPlaceholder('baseUrl', {})).toBe('例如: https://internal.example.com')
    expect(wrapper.vm.getFieldPlaceholder('token', {})).toBe('例如: Bearer xxx 或 ApiKey xxx')
    expect(wrapper.vm.getFieldPlaceholder('listPath', {})).toBe('例如: /api/tasks')
    expect(wrapper.vm.getFieldPlaceholder('detailPath', {})).toBe('例如: /api/tasks/{id}')
    expect(wrapper.vm.getFieldPlaceholder('detailIdField', {})).toBe('例如: id 或 data.taskId')
  })

  it('keeps non-INTERNAL_API placeholders unchanged', async () => {
    const wrapper = mountView()
    await flushPromises()

    wrapper.vm.formData.type = 'GITHUB'
    expect(wrapper.vm.getFieldPlaceholder('token', {})).toBe('ghp_xxx...')

    wrapper.vm.formData.type = 'CODEHUB'
    expect(wrapper.vm.getFieldLabel('baseUrl', {})).toBe('API 地址')
    expect(wrapper.vm.getFieldPlaceholder('baseUrl', {})).toBe('https://codehub.huawei.com/api/v4')
  })

  it('renders sync preview descriptions safely', async () => {
    const taskSourceStore = useTaskSourceStore()
    taskSourceStore.showPreviewDialog = true
    taskSourceStore.syncPreviewTasks = [
      {
        external_id: 'STORY-1',
        title: '同步任务',
        status: 'TODO',
        labels: ['story'],
        description: '<script>alert(1)</script> **重点**\n- 条目',
        imported: false,
        sourceName: 'CloudDevOps',
        external_url: 'https://example.com/story/1'
      }
    ]
    taskSourceStore.selectedSyncTasks = new Set(['STORY-1'])
    taskSourceStore.syncError = ''

    const wrapper = mountView()
    await flushPromises()
    await nextTick()

    const description = wrapper.find('.item-description')
    expect(description.exists()).toBe(true)
    expect(description.html()).toContain('<strong>重点</strong>')
    expect(description.html()).not.toContain('<script>alert(1)</script>')
    expect(description.text()).toContain('alert(1)')
    expect(description.text()).toContain('• 条目')
  })
})
