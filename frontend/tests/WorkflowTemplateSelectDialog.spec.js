import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import i18n from '../src/locales'
import WorkflowTemplateSelectDialog from '../src/components/workflow/WorkflowTemplateSelectDialog.vue'
import { getWorkflowTemplates } from '../src/api/workflowTemplate.js'

vi.mock('../src/api/workflowTemplate.js', () => ({
  getWorkflowTemplates: vi.fn()
}))

const ElDialogStub = defineComponent({
  name: 'ElDialogStub',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { slots }) {
    return () => props.modelValue
      ? h('div', { class: 'el-dialog-stub', 'data-title': props.title }, [
          slots.default?.(),
          h('div', { class: 'el-dialog-footer-stub' }, slots.footer?.())
        ])
      : null
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
      'data-loading': props.loading ? 'true' : 'false',
      onClick: () => emit('click')
    }, slots.default?.())
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mountDialog(props = {}) {
  return mount(WorkflowTemplateSelectDialog, {
    props: {
      modelValue: true,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        'el-dialog': ElDialogStub,
        'el-button': ElButtonStub
      }
    }
  })
}

describe('WorkflowTemplateSelectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads templates and confirms the selected template id', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [
        {
          template_id: 'quick-fix-v1',
          name: '快速修复工作流',
          steps: [{ id: 'triage' }, { id: 'fix' }]
        },
        {
          template_id: 'review-only-v1',
          name: '审查工作流',
          steps: [{ id: 'review' }]
        }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('快速修复工作流')
    expect(wrapper.text()).toContain('审查工作流')

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    await radios[1].setValue()
    await wrapper.find('button:last-of-type').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[ 'review-only-v1' ]])
  })

  it('renders an empty state when no templates are available', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: []
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无可用的工作流模板')
    const confirmButton = wrapper.find('button:last-of-type')
    expect(confirmButton.attributes('disabled')).toBeDefined()
  })

  it('renders an error state and retries loading', async () => {
    getWorkflowTemplates
      .mockResolvedValueOnce({ success: false, message: '模板接口失败' })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            template_id: 'quick-fix-v1',
            name: '快速修复工作流',
            steps: []
          }
        ]
      })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('模板接口失败')

    const retryButton = wrapper.findAll('button').find((button) => button.text() === '重试')
    expect(retryButton).toBeTruthy()
    await retryButton.trigger('click')
    await flushPromises()

    expect(getWorkflowTemplates).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('快速修复工作流')
  })
})
