import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { ElMessage } from 'element-plus'

import i18n from '../src/locales'
import KanbanView from '../src/views/KanbanView.vue'
import { useProjectStore } from '../src/stores/projectStore'
import { useTaskStore } from '../src/stores/taskStore'
import { useIterationStore } from '../src/stores/iterationStore'
import { useTaskSourceStore } from '../src/stores/taskSourceStore'

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

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

const mockProjects = [{ id: 1, name: 'Alpha' }]
const mockTasks = [{ id: 7, title: '旧任务', description: '旧描述', status: 'TODO', project_id: 1, priority: 'HIGH', assignee: 'Alice', iteration_id: 3 }]
const mockIterations = [{ id: 3, name: 'Sprint 3' }]

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
        IterationForm: passthroughStub('IterationForm'),
        TaskButlerChat: passthroughStub('TaskButlerChat'),
        ChatBox: passthroughStub('ChatBox'),
        WorkflowTemplateSelectDialog: passthroughStub('WorkflowTemplateSelectDialog'),
        WorkflowStartEditorDialog: passthroughStub('WorkflowStartEditorDialog'),
        IterationSelect: IterationSelectStub,
        draggable: true,
        'el-dialog': true,
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

describe('KanbanView add-task modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

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
    taskStore.createTask = vi.fn().mockResolvedValue({ id: 101 })
    taskStore.updateTask = vi.fn().mockResolvedValue({ id: 7 })

    iterationStore.fetchByProject = vi.fn().mockResolvedValue({ success: true, data: mockIterations })
    iterationStore.iterations = mockIterations

    taskSourceStore.showPreviewDialog = false
    taskSourceStore.closePreviewDialog = vi.fn()

    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
  })

  it('does not render the auto-assign-workflow option in the add-task modal', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.vm.openTaskModal()
    await flushPromises()

    const modal = wrapper.find('.modal')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).not.toContain('自动分配到工作流')
  })

  it('still creates a task from the add-task modal without autoAssignWorkflow in the payload', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()

    await wrapper.vm.openTaskModal()
    await flushPromises()

    await wrapper.find('.modal input[type="text"]').setValue('新任务')
    await wrapper.find('.modal .btn-primary').trigger('click')
    await flushPromises()

    expect(taskStore.createTask).toHaveBeenCalledTimes(1)
    expect(taskStore.createTask.mock.calls[0][0]).not.toHaveProperty('autoAssignWorkflow')
  })

  it('still updates an existing task without affecting other task fields', async () => {
    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()

    await wrapper.vm.openTaskModal(mockTasks[0])
    await flushPromises()

    await wrapper.find('.modal input[type="text"]').setValue('新标题')
    await wrapper.find('.modal .btn-primary').trigger('click')
    await flushPromises()

    expect(taskStore.updateTask).toHaveBeenCalledTimes(1)
    expect(taskStore.updateTask.mock.calls[0][1]).toMatchObject({
      title: '新标题',
      assignee: 'Alice',
      iteration_id: 3
    })
    expect(taskStore.updateTask.mock.calls[0][1]).not.toHaveProperty('autoAssignWorkflow')
  })
})
