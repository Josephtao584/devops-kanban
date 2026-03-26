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

const IterationFormStub = defineComponent({
  name: 'IterationForm',
  props: {
    modelValue: { type: Boolean, default: false },
    iteration: { type: Object, default: null }
  },
  emits: ['update:modelValue', 'submit', 'cancel'],
  setup(props) {
    return () => props.modelValue ? h('div', { class: 'iteration-form-stub' }, [
      h('div', { class: 'editing-iteration-name' }, props.iteration?.name || '')
    ]) : null
  }
})

const IterationListStub = defineComponent({
  name: 'IterationList',
  props: {
    iterations: { type: Array, default: () => [] }
  },
  emits: ['click', 'edit', 'delete'],
  setup(props, { emit }) {
    return () => h('div', { class: 'iteration-list-stub' }, props.iterations.map((iteration) => h('div', {
      key: iteration.id,
      class: `iteration-item-${iteration.id}`
    }, [
      h('button', {
        class: `select-iteration-${iteration.id}`,
        onClick: () => emit('click', iteration)
      }, `select ${iteration.name}`),
      h('button', {
        class: `edit-iteration-${iteration.id}`,
        onClick: () => emit('edit', iteration)
      }, `edit ${iteration.name}`),
      h('button', {
        class: `delete-iteration-${iteration.id}`,
        onClick: () => emit('delete', iteration)
      }, `delete ${iteration.name}`)
    ])))
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

const mockProjects = [{ id: 1, name: 'Alpha' }]
const mockTasks = [{ id: 7, title: 'Task', description: 'desc', status: 'TODO', project_id: 1, priority: 'HIGH', assignee: 'Alice', iteration_id: 3 }]
const mockIterations = [
  { id: 3, name: 'Sprint 3', description: '当前冲刺', goal: '收尾', start_date: '2026-03-01', end_date: '2026-03-15', status: 'ACTIVE', project_id: 1 },
  { id: 4, name: 'Sprint 4', project_id: 1, status: 'PLANNED' }
]

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
    iterationStore.updateIteration = vi.fn().mockResolvedValue({ success: true, data: mockIterations[0] })
    iterationStore.deleteIteration = vi.fn().mockResolvedValue({ success: true })

    taskSourceStore.showPreviewDialog = false
    taskSourceStore.closePreviewDialog = vi.fn()
  })

  it('opens the existing create iteration form from the manager dialog button', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await flushPromises()
    await wrapper.find('.open-create-iteration').trigger('click')
    await flushPromises()

    expect(wrapper.vm.showIterationModal).toBe(true)
    expect(wrapper.vm.editingIteration).toBe(null)
    expect(wrapper.find('.iteration-form-stub').exists()).toBe(true)
  })

  it('opens iteration form with selected iteration data when editing', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await flushPromises()
    await wrapper.find('.edit-iteration-3').trigger('click')
    await flushPromises()

    expect(wrapper.find('.iteration-form-stub').exists()).toBe(true)
    expect(wrapper.find('.editing-iteration-name').text()).toBe('Sprint 3')
  })

  it('deletes an iteration without deleting tasks when the checkbox stays unchecked', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    const iterationStore = useIterationStore()

    wrapper.vm.selectedIterationId = 3
    await wrapper.vm.$nextTick()

    await wrapper.find('.open-iteration-manager').trigger('click')
    await flushPromises()
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalled()
    expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3, { deleteTasks: false })
    expect(iterationStore.fetchByProject).toHaveBeenCalledWith('1')
    expect(taskStore.fetchTasks).toHaveBeenCalledWith('1')
    expect(wrapper.vm.selectedIterationId).toBe(null)
    expect(ElMessage.success).toHaveBeenCalledWith('迭代已删除')
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
    await flushPromises()
    await wrapper.find('.delete-iteration-3').trigger('click')
    await flushPromises()

    expect(iterationStore.deleteIteration).toHaveBeenCalledWith(3, { deleteTasks: true })
  })
})
