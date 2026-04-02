import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'

import WorkflowProgressDialog from '../src/components/WorkflowProgressDialog.vue'

const getWorkflowRun = vi.fn()
const cancelWorkflow = vi.fn()

vi.mock('../src/api/workflow.js', () => ({
  getWorkflowRun: (...args) => getWorkflowRun(...args),
  cancelWorkflow: (...args) => cancelWorkflow(...args)
}))

const StepSessionPanelStub = defineComponent({
  name: 'StepSessionPanel',
  props: {
    sessionId: { type: Number, default: null },
    stepName: { type: String, default: '' }
  },
  setup(props) {
    return () => h('div', {
      class: 'step-session-panel-stub',
      'data-session-id': String(props.sessionId),
      'data-step-name': props.stepName
    })
  }
})

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ['close', 'opened', 'update:modelValue'],
  setup(props, { slots, emit }) {
    return () => props.modelValue
      ? h('div', { class: 'el-dialog-stub' }, [
          h('div', { class: 'dialog-body' }, slots.default?.()),
          h('div', { class: 'dialog-footer' }, slots.footer?.()),
          h('button', { class: 'dialog-opened', onClick: () => emit('opened') }, 'opened'),
          h('button', { class: 'dialog-close', onClick: () => emit('close') }, 'close')
        ])
      : null
  }
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () => h('button', { onClick: () => emit('click') }, slots.default?.())
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

function createRun(overrides = {}) {
  return {
    id: 9,
    status: 'RUNNING',
    created_at: '2026-03-24T10:00:00.000Z',
    context: {},
    steps: [
      {
        step_id: 'requirement-design',
        name: '需求设计',
        status: 'COMPLETED',
        session_id: 101,
        error: null,
        summary: 'done'
      },
      {
        step_id: 'code-development',
        name: '代码开发',
        status: 'RUNNING',
        session_id: 102,
        error: null,
        summary: null
      },
      {
        step_id: 'testing',
        name: '测试',
        status: 'PENDING',
        session_id: null,
        error: null,
        summary: null
      }
    ],
    ...overrides
  }
}

function mountDialog(props = {}) {
  return mount(WorkflowProgressDialog, {
    props: {
      modelValue: true,
      workflowRunId: 9,
      taskTitle: '实现任务',
      ...props
    },
    global: {
      stubs: {
        StepSessionPanel: StepSessionPanelStub,
        'el-dialog': ElDialogStub,
        'el-button': ElButtonStub,
        'el-icon': true
      }
    }
  })
}

describe('WorkflowProgressDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defaults to the running step and renders its session panel', async () => {
    getWorkflowRun.mockResolvedValue({ success: true, data: createRun() })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    expect(getWorkflowRun).toHaveBeenCalledWith(9)
    expect(wrapper.find('.step-item.selected').attributes('data-step-id')).toBe('code-development')
    expect(wrapper.find('.step-session-panel-stub').attributes('data-session-id')).toBe('102')
    expect(wrapper.find('.step-session-panel-stub').attributes('data-step-name')).toBe('代码开发')
  })

  it('falls back to the last step with a session when no step is running', async () => {
    getWorkflowRun.mockResolvedValue({
      success: true,
      data: createRun({
        status: 'COMPLETED',
        steps: [
          {
            step_id: 'requirement-design',
            name: '需求设计',
            status: 'COMPLETED',
            session_id: 101,
            error: null,
            summary: 'done'
          },
          {
            step_id: 'code-development',
            name: '代码开发',
            status: 'COMPLETED',
            session_id: 102,
            error: null,
            summary: 'done'
          }
        ]
      })
    })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    expect(wrapper.find('.step-item.selected').attributes('data-step-id')).toBe('code-development')
    expect(wrapper.find('.step-session-panel-stub').attributes('data-session-id')).toBe('102')
  })

  it('switches the right panel when clicking another step with session history', async () => {
    getWorkflowRun.mockResolvedValue({ success: true, data: createRun() })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    await wrapper.find('.step-item[data-step-id="requirement-design"]').trigger('click')
    await nextTick()

    expect(wrapper.find('.step-item.selected').attributes('data-step-id')).toBe('requirement-design')
    expect(wrapper.find('.step-session-panel-stub').attributes('data-session-id')).toBe('101')
  })

  it('re-selects the new running step before the user makes a manual selection', async () => {
    getWorkflowRun
      .mockResolvedValueOnce({
        success: true,
        data: createRun({
          status: 'PENDING',
          steps: [
            {
              step_id: 'requirement-design',
              name: '需求设计',
              status: 'PENDING',
              session_id: null,
              error: null,
              summary: null
            },
            {
              step_id: 'code-development',
              name: '代码开发',
              status: 'PENDING',
              session_id: null,
              error: null,
              summary: null
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        success: true,
        data: createRun({
          status: 'RUNNING',
          steps: [
            {
              step_id: 'requirement-design',
              name: '需求设计',
              status: 'COMPLETED',
              session_id: 101,
              error: null,
              summary: 'done'
            },
            {
              step_id: 'code-development',
              name: '代码开发',
              status: 'RUNNING',
              session_id: 102,
              error: null,
              summary: null
            }
          ]
        })
      })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    expect(wrapper.find('.step-item.selected').attributes('data-step-id')).toBe('requirement-design')

    await wrapper.vm.fetchRun()
    await flushPromises()

    expect(wrapper.find('.step-item.selected').attributes('data-step-id')).toBe('code-development')
    expect(wrapper.find('.step-session-panel-stub').attributes('data-session-id')).toBe('102')
  })

  it('keeps manual selection after later polling updates', async () => {
    getWorkflowRun
      .mockResolvedValue({ success: true, data: createRun() })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    await wrapper.find('.step-item[data-step-id="requirement-design"]').trigger('click')
    await nextTick()

    await wrapper.vm.fetchRun()
    await flushPromises()

    expect(wrapper.find('.step-item.selected').attributes('data-step-id')).toBe('requirement-design')
    expect(wrapper.find('.step-session-panel-stub').attributes('data-session-id')).toBe('101')
  })

  it('preserves workflow result context in the new two-pane layout', async () => {
    getWorkflowRun.mockResolvedValue({
      success: true,
      data: createRun({
        status: 'COMPLETED',
        context: {
          approved: true,
          comments: 'Looks good.'
        }
      })
    })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('审查通过')
    expect(wrapper.text()).toContain('Looks good.')
  })

  it('preserves workflow error context in the new two-pane layout', async () => {
    getWorkflowRun.mockResolvedValue({
      success: true,
      data: createRun({
        status: 'FAILED',
        context: {
          error: 'Top level workflow failed'
        }
      })
    })

    const wrapper = mountDialog()
    await wrapper.find('.dialog-opened').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Top level workflow failed')
  })
})
