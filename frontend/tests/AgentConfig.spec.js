import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { ElMessage } from 'element-plus'
import AgentConfig from '../src/views/AgentConfig.vue'
import AgentSelector from '../src/components/AgentSelector.vue'
import TaskDetail from '../src/components/TaskDetail.vue'
import i18n from '../src/locales'
import {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent
} from '../src/api/agent'
import { getExecutionsByAgent } from '../src/api/execution'
import {
  getActiveSessionByTask,
  getSessionHistory,
  createSession,
  deleteSession
} from '../src/api/session'
import { getStatus, getDiff } from '../src/api/git'
import { createTask, updateTask, deleteTask } from '../src/api/task'

vi.mock('../src/api/agent', () => ({
  getAgents: vi.fn(),
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn()
}))

vi.mock('../src/api/execution', () => ({
  getExecutionsByAgent: vi.fn()
}))

vi.mock('../src/api/session', () => ({
  getActiveSessionByTask: vi.fn(),
  getSessionHistory: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn()
}))

vi.mock('../src/api/git', () => ({
  getStatus: vi.fn(),
  getDiff: vi.fn()
}))

vi.mock('../src/api/task', () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn()
}))

const ElDialogStub = defineComponent({
  name: 'ElDialogStub',
  props: {
    modelValue: { type: Boolean, default: true }
  },
  setup(props, { slots }) {
    return () => props.modelValue === false
      ? null
      : h('div', { class: 'el-dialog-stub' }, [
          slots.default?.(),
          slots.footer?.()
        ])
  }
})

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  props: {
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false }
  },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      disabled: props.disabled,
      'data-loading': String(props.loading),
      onClick: () => emit('click')
    }, slots.default?.())
  }
})

const ElSelectStub = defineComponent({
  name: 'ElSelectStub',
  props: {
    modelValue: {
      type: [Number, String, null],
      default: null
    },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    const onChange = (event) => {
      const { value } = event.target
      if (value === '') {
        emit('update:modelValue', null)
        return
      }

      const numericValue = Number(value)
      emit('update:modelValue', Number.isNaN(numericValue) ? value : numericValue)
    }

    return () => h('select', {
      class: 'el-select-stub',
      value: props.modelValue ?? '',
      disabled: props.disabled,
      onChange
    }, slots.default?.())
  }
})

const ElOptionStub = defineComponent({
  name: 'ElOptionStub',
  props: {
    label: { type: String, required: true },
    value: { type: [Number, String], required: true },
    disabled: { type: Boolean, default: false }
  },
  setup(props) {
    return () => h('option', {
      value: props.value,
      disabled: props.disabled
    }, props.label)
  }
})

const ElIconStub = defineComponent({
  name: 'ElIconStub',
  setup(_, { slots }) {
    return () => h('span', { class: 'el-icon-stub' }, slots.default?.())
  }
})

const ElEmptyStub = defineComponent({
  name: 'ElEmptyStub',
  props: {
    description: { type: String, default: '' }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-empty-stub' }, slots.description?.() || props.description)
  }
})

const ElDividerStub = defineComponent({
  name: 'ElDividerStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-divider-stub' }, slots.default?.())
  }
})

const ElScrollbarStub = defineComponent({
  name: 'ElScrollbarStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-scrollbar-stub' }, slots.default?.())
  }
})

const ElTagStub = defineComponent({
  name: 'ElTagStub',
  setup(_, { slots }) {
    return () => h('span', { class: 'el-tag-stub' }, slots.default?.())
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mountAgentConfig() {
  const pinia = createPinia()
  setActivePinia(pinia)

  return mount(AgentConfig, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        ExecutionDetailDrawer: true
      }
    }
  })
}

function mountAgentSelector(props = {}) {
  return mount(AgentSelector, {
    props: {
      modelValue: true,
      projectId: 1,
      task: null,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        'el-dialog': ElDialogStub,
        'el-empty': ElEmptyStub,
        'el-button': ElButtonStub,
        'el-icon': ElIconStub
      }
    }
  })
}

function mountTaskDetail(props = {}) {
  return mount(TaskDetail, {
    props: {
      task: {
        id: 1,
        title: 'Fix bug'
      },
      projectId: 1,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        'el-dialog': ElDialogStub,
        'el-divider': ElDividerStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-button': ElButtonStub,
        'el-scrollbar': ElScrollbarStub,
        'el-empty': ElEmptyStub,
        'el-tag': ElTagStub,
        'el-icon': ElIconStub,
        ChatBox: true,
        TaskForm: true,
        TaskHistory: true,
        CommitDialog: true
      }
    }
  })
}

describe('AgentConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})

    getAgents.mockResolvedValue({
      success: true,
      data: []
    })
    getAgent.mockResolvedValue({
      success: true,
      data: null
    })
    createAgent.mockImplementation(async (payload) => ({
      success: true,
      data: {
        id: 101,
        ...payload
      }
    }))
    updateAgent.mockImplementation(async (_id, payload) => ({
      success: true,
      data: payload
    }))
    deleteAgent.mockResolvedValue({
      success: true,
      data: null
    })
    getExecutionsByAgent.mockResolvedValue({
      success: true,
      data: []
    })
    getActiveSessionByTask.mockResolvedValue({
      success: true,
      data: {
        id: 55,
        agentId: 1,
        status: 'IDLE'
      }
    })
    getSessionHistory.mockResolvedValue({
      success: true,
      data: []
    })
    createSession.mockResolvedValue({
      success: true,
      data: {
        id: 77,
        agentId: 1,
        status: 'CREATED'
      }
    })
    deleteSession.mockResolvedValue({
      success: true,
      data: null
    })
    getStatus.mockResolvedValue({
      success: false,
      data: null
    })
    getDiff.mockResolvedValue({
      success: true,
      data: {
        content: ''
      }
    })
    createTask.mockResolvedValue({
      success: true,
      data: {}
    })
    updateTask.mockResolvedValue({
      success: true,
      data: {}
    })
    deleteTask.mockResolvedValue({
      success: true,
      data: null
    })
  })

  it('submits executor runtime config fields without legacy type', async () => {
    const wrapper = mountAgentConfig()
    await flushPromises()

    await wrapper.get('[data-testid="open-create-agent"]').trigger('click')
    await wrapper.get('[data-testid="agent-name-input"]').setValue('Claude Dev')
    await wrapper.get('[data-testid="agent-executor-type-select"]').setValue('CLAUDE_CODE')
    await wrapper.get('[data-testid="agent-command-override-input"]').setValue('claude --run')
    await wrapper.get('[data-testid="agent-args-input"]').setValue('--json, --verbose')
    await wrapper.get('[data-testid="agent-env-key-0"]').setValue('CI')
    await wrapper.get('[data-testid="agent-env-value-0"]').setValue('true')

    await wrapper.get('[data-testid="agent-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(createAgent).toHaveBeenCalledTimes(1)
    const payload = createAgent.mock.calls[0][0]

    expect(payload).toMatchObject({
      name: 'Claude Dev',
      executorType: 'CLAUDE_CODE',
      commandOverride: 'claude --run',
      args: ['--json', '--verbose'],
      env: {
        CI: 'true'
      }
    })
    expect(payload).not.toHaveProperty('type')
  })

  it('keeps the form open and shows an error when create returns success false', async () => {
    createAgent.mockResolvedValueOnce({
      success: false,
      message: '保存被拒绝',
      data: null
    })

    const wrapper = mountAgentConfig()
    await flushPromises()

    await wrapper.get('[data-testid="open-create-agent"]').trigger('click')
    await wrapper.get('[data-testid="agent-name-input"]').setValue('Claude Dev')
    await wrapper.get('[data-testid="agent-form"]').trigger('submit.prevent')
    await flushPromises()

    expect(createAgent).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="agent-form"]').exists()).toBe(true)
    expect(wrapper.find('.toast.error').exists()).toBe(true)
    expect(wrapper.find('.toast.error').text()).toContain('保存被拒绝')
  })

  it('shows a localized load error and ignores data when agent selector gets success false', async () => {
    getAgents.mockResolvedValueOnce({
      success: false,
      message: '成员接口失败',
      data: [
        { id: 1, name: 'Should Not Render', executorType: 'CODEX' }
      ]
    })

    const wrapper = mountAgentSelector()
    await flushPromises()

    expect(ElMessage.error).toHaveBeenCalledWith('成员接口失败')
    expect(wrapper.findAll('.agent-item')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Should Not Render')
  })

  it('renders localized executor type labels in agent selector', async () => {
    getAgents.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 1, name: 'Reviewer', executorType: 'CODEX' }
      ]
    })

    const wrapper = mountAgentSelector()
    await flushPromises()

    expect(wrapper.text()).toContain('Reviewer')
    expect(wrapper.text()).toContain('OpenAI Codex')
    expect(wrapper.text()).not.toContain('CODEX')
  })

  it('renders localized executor type labels in task detail agent options', async () => {
    getAgents.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 1, name: 'Reviewer', executorType: 'CODEX' }
      ]
    })

    const wrapper = mountTaskDetail({
      task: {
        id: 123,
        title: 'Fix bug'
      },
      projectId: 9
    })
    await flushPromises()

    const option = wrapper.get('option[value="1"]')
    expect(option.text()).toBe('Reviewer (OpenAI Codex)')
  })

  it('does not auto-create a session when active session lookup returns success false', async () => {
    getAgents.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 1, name: 'Reviewer', executorType: 'CODEX' }
      ]
    })
    getActiveSessionByTask.mockResolvedValueOnce({
      success: false,
      message: '会话查询失败',
      data: null
    })

    const wrapper = mountTaskDetail({
      task: {
        id: 456,
        title: 'Session lookup failure'
      },
      projectId: 9
    })
    await flushPromises()

    expect(createSession).not.toHaveBeenCalled()
    expect(wrapper.find('option[value="1"]').exists()).toBe(false)
  })

  it('shows an error instead of false success when delete returns success false', async () => {
    getAgents.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 1,
          name: 'Claude Dev',
          executorType: 'CLAUDE_CODE',
          role: 'BACKEND_DEV',
          enabled: true,
          skills: []
        }
      ]
    })
    deleteAgent.mockResolvedValueOnce({
      success: false,
      message: '删除被拒绝',
      data: null
    })
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)

    const wrapper = mountAgentConfig()
    await flushPromises()

    await wrapper.get('.agent-list-item').trigger('click')
    await flushPromises()
    await wrapper.get('.detail-header .btn-danger').trigger('click')
    await flushPromises()

    expect(deleteAgent).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.toast.error').exists()).toBe(true)
    expect(wrapper.find('.toast.error').text()).toContain('删除被拒绝')
    expect(wrapper.find('.toast.success').exists()).toBe(false)
  })
})
