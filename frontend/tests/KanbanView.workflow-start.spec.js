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
import { startTask } from '../src/api/task.js'
import { getWorkflowTemplateById } from '../src/api/workflowTemplate.js'

const handleWorktreeMock = vi.fn()

vi.mock('../src/composables/useWorktree', () => ({
  useWorktree: () => ({
    handleWorktree: handleWorktreeMock
  })
}))

vi.mock('../src/api/task.js', async () => {
  const actual = await vi.importActual('../src/api/task.js')
  return {
    ...actual,
    startTask: vi.fn()
  }
})

vi.mock('../src/api/session.js', () => ({
  getActiveSessionByTask: vi.fn().mockResolvedValue({ success: true, data: null })
}))

vi.mock('../src/api/taskWorktree.js', () => ({
  deleteTaskWorktree: vi.fn()
}))

vi.mock('../src/api/workflowTemplate.js', () => ({
  getWorkflowTemplates: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        template_id: 'quick-fix-v1',
        name: '快速修复工作流',
        steps: []
      }
    ]
  }),
  getWorkflowTemplateById: vi.fn().mockResolvedValue({
    success: true,
    data: {
      template_id: 'quick-fix-v1',
      name: '快速修复工作流',
      steps: [
        {
          id: 'triage',
          name: '问题定位',
          instructionPrompt: '先确认问题范围。',
          agentId: 11
        },
        {
          id: 'fix',
          name: '实施修复',
          instructionPrompt: '完成最小修复。',
          agentId: 12
        }
      ]
    }
  })
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

const WorkflowTemplateSelectDialogStub = defineComponent({
  name: 'WorkflowTemplateSelectDialog',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'confirm'],
  setup(props, { emit }) {
    return () => props.modelValue
      ? h('div', { class: 'workflow-template-select-dialog-stub' }, [
          h('button', {
            class: 'confirm-template-selection',
            onClick: () => emit('confirm', {
              templateId: 'quick-fix-v1',
              autoCreateWorktree: false
            })
          }, 'confirm quick-fix'),
          h('button', {
            class: 'confirm-template-selection-with-worktree',
            onClick: () => emit('confirm', {
              templateId: 'quick-fix-v1',
              autoCreateWorktree: true
            })
          }, 'confirm quick-fix with worktree')
        ])
      : null
  }
})

const WorkflowStartEditorDialogStub = defineComponent({
  name: 'WorkflowStartEditorDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    draftTemplate: { type: Object, default: null }
  },
  emits: ['update:modelValue', 'confirm'],
  setup(props, { emit }) {
    return () => props.modelValue
      ? h('div', { class: 'workflow-start-editor-dialog-stub' }, [
          h('div', { class: 'draft-template-id' }, props.draftTemplate?.template_id || ''),
          h('div', { class: 'workflow-step-flow-stub' }, props.draftTemplate?.steps?.map((step) => h('div', { class: 'workflow-step-card-stub' }, [
            h('span', { class: 'workflow-step-name-stub' }, step.name),
            h('span', { class: 'workflow-step-id-stub' }, step.id)
          ])) || []),
          h('button', {
            class: 'confirm-workflow-edit',
            onClick: () => emit('confirm', {
              ...props.draftTemplate,
              template_id: 'quick-fix-v1-custom',
              steps: props.draftTemplate?.steps?.map((step, index) => ({
                ...step,
                instructionPrompt: index === 0 ? '先确认问题范围，并记录复现条件。' : step.instructionPrompt
              })) || []
            })
          }, 'confirm workflow edit')
        ])
      : null
  }
})

const KanbanListViewStub = defineComponent({
  name: 'KanbanListView',
  props: {
    tasks: { type: Array, default: () => [] }
  },
  emits: ['select-task', 'workflow-action'],
  setup(props, { emit }) {
    return () => h('div', { class: 'kanban-list-view-stub' }, props.tasks.map((task) =>
      h('div', { key: task.id, class: 'kanban-task-row' }, [
        h('button', {
          class: `select-task-${task.id}`,
          onClick: () => emit('select-task', task)
        }, `select ${task.title}`),
        h('button', {
          class: `start-task-${task.id}`,
          onClick: () => emit('workflow-action', { action: 'start', task })
        }, `start ${task.title}`)
      ])
    ))
  }
})

const passthroughStub = (name) => defineComponent({
  name,
  setup(_, { slots }) {
    return () => h('div', { class: `${name}-stub` }, slots.default?.())
  }
})

const IterationSelectStub = defineComponent({
  name: 'IterationSelect',
  props: {
    modelValue: { type: [String, Number, null], default: null }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('select', {
      class: 'iteration-select-stub',
      value: props.modelValue ?? '',
      onChange: (event) => emit('update:modelValue', event.target.value || null)
    })
  }
})

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    return () => props.modelValue ? h('div', { class: 'el-dialog-stub' }, slots.default?.()) : null
  }
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () => h('button', { onClick: () => emit('click') }, slots.default?.())
  }
})

const ElRadioGroupStub = defineComponent({
  name: 'ElRadioGroup',
  props: {
    modelValue: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(_, { slots }) {
    return () => h('div', { class: 'el-radio-group-stub' }, slots.default?.())
  }
})

const ElRadioButtonStub = defineComponent({
  name: 'ElRadioButton',
  setup(_, { slots }) {
    return () => h('button', { class: 'el-radio-button-stub' }, slots.default?.())
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

const mockProjects = [
  { id: 1, name: 'Alpha' }
]

const mockTasks = [
  {
    id: 7,
    title: '修复启动流程',
    status: 'TODO',
    project_id: 1,
    priority: 'HIGH'
  }
]

function mountView() {
  return mount(KanbanView, {
    global: {
      plugins: [i18n],
      stubs: {
        KanbanListView: KanbanListViewStub,
        KanbanColumn: passthroughStub('KanbanColumn'),
        AgentSelector: passthroughStub('AgentSelector'),
        WorkflowTimelineDialog: passthroughStub('WorkflowTimelineDialog'),
        WorkflowProgressDialog: passthroughStub('WorkflowProgressDialog'),
        DiffSelectDialog: passthroughStub('DiffSelectDialog'),
        CommitDialog: passthroughStub('CommitDialog'),
        IterationForm: passthroughStub('IterationForm'),
        TaskButlerChat: passthroughStub('TaskButlerChat'),
        ChatBox: passthroughStub('ChatBox'),
        WorkflowTemplateSelectDialog: WorkflowTemplateSelectDialogStub,
        WorkflowStartEditorDialog: WorkflowStartEditorDialogStub,
        IterationSelect: IterationSelectStub,
        draggable: true,
        'el-dialog': ElDialogStub,
        'el-button': ElButtonStub,
        'el-radio-group': ElRadioGroupStub,
        'el-radio-button': ElRadioButtonStub,
        'el-checkbox-group': true,
        'el-checkbox-button': true,
        'el-icon': true
      }
    }
  })
}

describe('KanbanView workflow start entrypoint', () => {
  beforeEach(() => {
    getWorkflowTemplateById.mockClear()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    handleWorktreeMock.mockReset()
    handleWorktreeMock.mockResolvedValue(null)
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

    iterationStore.fetchByProject = vi.fn().mockResolvedValue({ success: true, data: [] })
    iterationStore.iterations = []

    taskSourceStore.showPreviewDialog = false
    taskSourceStore.closePreviewDialog = vi.fn()

    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
  })

  it('opens template selection before starting the task', async () => {
    startTask.mockResolvedValue({ success: true })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.select-task-7').trigger('click')
    await wrapper.find('.start-task-7').trigger('click')
    await flushPromises()

    expect(startTask).not.toHaveBeenCalled()
    expect(wrapper.find('.workflow-template-select-dialog-stub').exists()).toBe(true)
  })

  it('opens workflow edit after template selection before starting the task', async () => {
    startTask.mockResolvedValue({ success: true })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.select-task-7').trigger('click')
    await wrapper.find('.start-task-7').trigger('click')
    await flushPromises()
    await wrapper.find('.confirm-template-selection').trigger('click')
    await flushPromises()

    expect(getWorkflowTemplateById).toHaveBeenCalledWith('quick-fix-v1')
    expect(startTask).not.toHaveBeenCalled()
    expect(wrapper.find('.workflow-template-select-dialog-stub').exists()).toBe(false)
    expect(wrapper.find('.workflow-start-editor-dialog-stub').exists()).toBe(true)
    expect(wrapper.find('.draft-template-id').text()).toBe('quick-fix-v1')
    expect(wrapper.find('.workflow-step-flow-stub').exists()).toBe(true)
    expect(wrapper.findAll('.workflow-step-card-stub')).toHaveLength(2)
    expect(wrapper.findAll('.workflow-step-name-stub')[0].text()).toBe('问题定位')
  })

  it('starts the selected task with workflow_template_id and edited workflow_template_snapshot after edit confirmation', async () => {
    startTask.mockResolvedValue({ success: true })

    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()

    await wrapper.find('.select-task-7').trigger('click')
    await wrapper.find('.start-task-7').trigger('click')
    await flushPromises()
    await wrapper.find('.confirm-template-selection').trigger('click')
    await flushPromises()
    await wrapper.find('.confirm-workflow-edit').trigger('click')
    await flushPromises()

    expect(startTask).toHaveBeenCalledWith(7, {
      workflow_template_id: 'quick-fix-v1',
      workflow_template_snapshot: {
        template_id: 'quick-fix-v1-custom',
        name: '快速修复工作流',
        autoCreateWorktree: false,
        steps: [
          {
            id: 'triage',
            name: '问题定位',
            instructionPrompt: '先确认问题范围，并记录复现条件。',
            agentId: 11
          },
          {
            id: 'fix',
            name: '实施修复',
            instructionPrompt: '完成最小修复。',
            agentId: 12
          }
        ]
      }
    })
    expect(ElMessage.success).toHaveBeenCalledWith('任务已启动')
    expect(taskStore.fetchTasks).toHaveBeenCalledTimes(2)
  })

  it('does not toggle an existing worktree when auto-create is enabled during workflow start', async () => {
    startTask.mockResolvedValue({ success: true })

    const wrapper = mountView()
    await flushPromises()

    const taskStore = useTaskStore()
    taskStore.tasks = [
      {
        id: 7,
        title: '修复启动流程',
        status: 'TODO',
        project_id: 1,
        priority: 'HIGH',
        worktree_status: 'created',
        worktree_path: '/tmp/task-7',
        worktree_branch: 'task/7'
      }
    ]

    await wrapper.find('.select-task-7').trigger('click')
    await wrapper.find('.start-task-7').trigger('click')
    await flushPromises()
    await wrapper.find('.confirm-template-selection-with-worktree').trigger('click')
    await flushPromises()
    await wrapper.find('.confirm-workflow-edit').trigger('click')
    await flushPromises()

    expect(handleWorktreeMock).not.toHaveBeenCalled()
    expect(startTask).toHaveBeenCalledWith(7, {
      workflow_template_id: 'quick-fix-v1',
      workflow_template_snapshot: {
        template_id: 'quick-fix-v1-custom',
        name: '快速修复工作流',
        autoCreateWorktree: true,
        steps: [
          {
            id: 'triage',
            name: '问题定位',
            instructionPrompt: '先确认问题范围，并记录复现条件。',
            agentId: 11
          },
          {
            id: 'fix',
            name: '实施修复',
            instructionPrompt: '完成最小修复。',
            agentId: 12
          }
        ]
      }
    })
  })
})
