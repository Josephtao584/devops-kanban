import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import i18n from '../src/locales'
import KanbanView from '../src/views/KanbanView.vue'
import { useProjectStore } from '../src/stores/projectStore'
import { useTaskStore } from '../src/stores/taskStore'
import { useIterationStore } from '../src/stores/iterationStore'
import { useTaskSourceStore } from '../src/stores/taskSourceStore'

vi.mock('element-plus', async () => {
  const actual = await vi.importActual('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn()
    },
    ElMessageBox: {
      confirm: vi.fn().mockImplementation(async (message, _title, options) => {
        if (typeof globalThis.__ITERATION_DELETE_CONFIRM_HOOK__ === 'function') {
          globalThis.__ITERATION_DELETE_CONFIRM_HOOK__(message, options)
        }
        return 'confirm'
      })
    }
  }
})

vi.mock('../src/api/session.js', () => ({
  getActiveSessionByTask: vi.fn().mockResolvedValue({ success: true, data: null })
}))

vi.mock('../src/api/taskWorktree.js', () => ({
  deleteTaskWorktree: vi.fn()
}))

vi.mock('../src/api/workflowTemplate.js', () => ({
  getWorkflowTemplates: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getWorkflowTemplateById: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      projectId: '1'
    }
  })
}))

vi.mock('../src/composables/kanban/useTaskTimer', () => ({
  useTaskTimer: () => ({
    runningTasks: new Set(),
    isTaskRunning: () => false,
    startTaskTimer: vi.fn(),
    stopTaskTimer: vi.fn(),
    formatTaskElapsedTime: () => '',
    cleanup: vi.fn()
  })
}))

vi.mock('../src/composables/kanban/useWorkflowManager', () => ({
  useWorkflowManager: () => ({
    selectedNode: { value: null },
    showNodeDialog: { value: false },
    workflowVersion: { value: 0 },
    onNodeSelect: vi.fn(),
    onNodeViewDetails: vi.fn(),
    handleButlerControl: vi.fn(),
    handleViewWorkflow: vi.fn(),
    onNodeSessionCreated: vi.fn(),
    onStartWorkflow: vi.fn()
  })
}))

vi.mock('../src/mock/workflowAssignment', () => ({
  analyzeTaskCategory: vi.fn(() => 'FEATURE')
}))

vi.mock('../src/mock/workflowData', () => ({
  getWorkflowByProject: vi.fn(() => null),
  getWorkflowByTask: vi.fn(() => null),
  getOrCreateWorkflowForProject: vi.fn(() => null),
  addNodeToWorkflow: vi.fn()
}))

vi.mock('vuedraggable', () => ({
  default: defineComponent({
    name: 'DraggableStub',
    props: {
      list: { type: Array, default: () => [] },
      modelValue: { type: Array, default: () => [] }
    },
    setup(props, { slots }) {
      const items = props.list?.length ? props.list : props.modelValue
      return () => h('div', { class: 'draggable-stub' }, items.map((element, index) =>
        slots.item ? slots.item({ element, index }) : null
      ))
    }
  })
}))

const passthroughStub = (name) => defineComponent({
  name,
  setup(_, { slots }) {
    return () => h('div', { class: `${name}-stub` }, slots.default?.())
  }
})

const IterationSelectStub = defineComponent({
  name: 'IterationSelect',
  props: {
    modelValue: { type: [String, Number, null], default: null },
    iterations: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('select', {
      class: 'iteration-select-stub',
      value: props.modelValue ?? '',
      onChange: (event) => emit('update:modelValue', event.target.value || null)
    }, [h('option', { value: '' }, 'none')].concat(
      props.iterations.map((iteration) => h('option', { value: iteration.id }, iteration.name || String(iteration.id)))
    ))
  }
})

const IterationListStub = defineComponent({
  name: 'IterationList',
  props: {
    iterations: { type: Array, default: () => [] }
  },
  emits: ['delete', 'edit'],
  setup(props, { emit }) {
    return () => h('div', { class: 'iteration-list-stub' }, props.iterations.map((iteration) =>
      h('button', {
        class: `delete-iteration-${iteration.id}`,
        onClick: () => emit('delete', iteration)
      }, `delete ${iteration.name}`)
    ))
  }
})

const IterationFormStub = defineComponent({
  name: 'IterationForm',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  setup(props) {
    return () => props.modelValue ? h('div', { class: 'iteration-form-stub' }, 'iteration form') : null
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

const mockProjects = [{ id: 1, name: 'Alpha' }]
const mockTasks = [{ id: 7, title: 'Task', description: 'desc', status: 'TODO', project_id: 1, priority: 'HIGH', assignee: 'Alice', iteration_id: 3 }]
const mockIterations = [{ id: 3, name: 'Sprint 3', project_id: 1 }]

function mountView() {
  return mount(KanbanView, {
    global: {
      plugins: [i18n],
      stubs: {
        KanbanListView: passthroughStub('KanbanListView'),
        KanbanColumn: passthroughStub('KanbanColumn'),
        AgentSelector: passthroughStub('AgentSelector'),
        WorkflowTimelineDialog: passthroughStub('WorkflowTimelineDialog'),
        WorkflowProgressDialog: passthroughStub('WorkflowProgressDialog'),
        DiffSelectDialog: passthroughStub('DiffSelectDialog'),
        CommitDialog: passthroughStub('CommitDialog'),
        MergeDialog: passthroughStub('MergeDialog'),
        IterationForm: IterationFormStub,
        IterationList: IterationListStub,
        TaskButlerChat: passthroughStub('TaskButlerChat'),
        ChatBox: passthroughStub('ChatBox'),
        WorkflowTemplateSelectDialog: passthroughStub('WorkflowTemplateSelectDialog'),
        WorkflowStartEditorDialog: passthroughStub('WorkflowStartEditorDialog'),
        IterationSelect: IterationSelectStub,
        draggable: true,
        'el-dialog': passthroughStub('el-dialog'),
        'el-button': true,
        'el-radio-group': true,
        'el-radio-button': true,
        'el-checkbox-group': true,
        'el-checkbox-button': true,
        'el-icon': true
      }
    }
  })
}

describe('KanbanView iteration management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    globalThis.__ITERATION_DELETE_CONFIRM_HOOK__ = null

    const pinia = createPinia()
    setActivePinia(pinia)

    const projectStore = useProjectStore()
    const taskStore = useTaskStore()
    const iterationStore = useIterationStore()
    const taskSourceStore = useTaskSourceStore()

    projectStore.fetchProjects = vi.fn().mockImplementation(async () => {
      projectStore.projects = mockProjects
      return { success: true, data: mockProjects }
    })
    projectStore.projects = mockProjects

    taskStore.fetchTasks = vi.fn().mockImplementation(async () => {
      taskStore.tasks = mockTasks
      return { success: true, data: mockTasks }
    })
    taskStore.tasks = mockTasks

    iterationStore.fetchByProject = vi.fn().mockImplementation(async () => {
      iterationStore.iterations = mockIterations
      return { success: true, data: mockIterations }
    })
    iterationStore.iterations = mockIterations
    iterationStore.deleteIteration = vi.fn().mockResolvedValue({ success: true })

    taskSourceStore.showPreviewDialog = false
    taskSourceStore.closePreviewDialog = vi.fn()
  })

  it('moves the create iteration button from the toolbar into the manager dialog', async () => {
    const wrapper = mountView()
    await flushPromises()

    const filter = wrapper.find('.iteration-filter')
    expect(filter.find('.open-iteration-manager').exists()).toBe(true)
    expect(filter.find('.open-create-iteration').exists()).toBe(false)

    expect(wrapper.find('.open-create-iteration').exists()).toBe(true)
  })

  it('opens the existing create iteration form from the manager dialog button', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.open-create-iteration').trigger('click')
    await flushPromises()

    expect(wrapper.vm.showIterationModal).toBe(true)
    expect(wrapper.vm.editingIteration).toBe(null)
    expect(wrapper.find('.iteration-form-stub').exists()).toBe(true)
  })

  it('deletes an iteration without deleting tasks when the checkbox stays unchecked', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const iterationStore = useIterationStore()

    wrapper.vm.selectedIterationId = 3
    await wrapper.vm.$nextTick()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalled()
    expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3, { deleteTasks: false })
    expect(iterationStore.fetchByProject).toHaveBeenCalledWith('1')
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('1')
    expect(wrapper.vm.selectedIterationId).toBe(null)
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('builds the delete confirmation checkbox as a real component vnode', async () => {
    let capturedMessage = null
    globalThis.__ITERATION_DELETE_CONFIRM_HOOK__ = (message) => {
      capturedMessage = message
    }

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    const checkboxNode = capturedMessage.children[1]
    expect(typeof checkboxNode.type).not.toBe('string')
  })

  it('deletes iteration tasks when the checkbox is checked in the confirmation', async () => {
    globalThis.__ITERATION_DELETE_CONFIRM_HOOK__ = (message) => {
      const checkboxNode = message.children[1]
      checkboxNode.props['onUpdate:modelValue'](true)
    }

    const wrapper = mountView()
    await flushPromises()

    const iterationStore = useIterationStore()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3, { deleteTasks: true })
  })

  it('deletes an iteration, refreshes data, and clears the active iteration filter when needed', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const iterationStore = useIterationStore()

    wrapper.vm.selectedIterationId = 3
    await wrapper.vm.$nextTick()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalled()
    expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3, { deleteTasks: false })
    expect(iterationStore.fetchByProject).toHaveBeenCalledWith('1')
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('1')
    expect(wrapper.vm.selectedIterationId).toBe(null)
    expect(ElMessage.success).toHaveBeenCalled()
  })

  it('stores __ALL__ after deleting the currently selected iteration', async () => {
    const wrapper = mountView()
    await flushPromises()

    wrapper.vm.selectedIterationId = 3
    await wrapper.vm.$nextTick()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(wrapper.vm.selectedIterationId).toBe(null)
    expect(localStorage.getItem('kanban-selected-iteration-id')).toBe('__ALL__')
  })

  it('shows an error and skips refresh when delete returns success false', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const iterationStore = useIterationStore()
    const initialIterationFetchCalls = iterationStore.fetchByProject.mock.calls.length
    const initialTaskFetchCalls = taskStore.fetchTasks.mock.calls.length
    iterationStore.deleteIteration.mockResolvedValueOnce({ success: false, message: '删除失败' })

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(iterationStore.fetchByProject.mock.calls.length).toBe(initialIterationFetchCalls)
    expect(taskStore.fetchTasks.mock.calls.length).toBe(initialTaskFetchCalls)
    expect(ElMessage.error).toHaveBeenCalledWith('删除迭代失败')
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('keeps the delete result but warns when refresh fails after delete succeeds', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const iterationStore = useIterationStore()
    iterationStore.fetchByProject.mockRejectedValueOnce(new Error('refresh failed'))

    wrapper.vm.selectedIterationId = 3
    await wrapper.vm.$nextTick()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3, { deleteTasks: false })
    expect(wrapper.vm.selectedIterationId).toBe(null)
    expect(localStorage.getItem('kanban-selected-iteration-id')).toBe('__ALL__')
    expect(taskStore.fetchTasks).toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith('迭代已删除，但刷新列表失败')
    expect(ElMessage.error).not.toHaveBeenCalled()
  })

  it('passes the selected iteration when confirming sync import', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const taskSourceStore = useTaskSourceStore()
    taskSourceStore.importSelectedPreviewTasks = vi.fn().mockResolvedValue(1)
    taskSourceStore.selectedSyncTasks = new Set(['ext-1'])

    wrapper.vm.selectedIterationId = 3
    await wrapper.vm.$nextTick()

    await wrapper.vm.confirmSyncImport()
    await flushPromises()

    expect(taskSourceStore.importSelectedPreviewTasks).toHaveBeenCalledWith('1', 3)
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('1')
  })

  it('passes null iteration when syncing from all-iterations view', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const taskSourceStore = useTaskSourceStore()
    taskSourceStore.importSelectedPreviewTasks = vi.fn().mockResolvedValue(1)
    taskSourceStore.selectedSyncTasks = new Set(['ext-1'])

    wrapper.vm.selectedIterationId = null
    await wrapper.vm.$nextTick()

    await wrapper.vm.confirmSyncImport()
    await flushPromises()

    expect(taskSourceStore.importSelectedPreviewTasks).toHaveBeenCalledWith('1', null)
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('1')
  })
})
