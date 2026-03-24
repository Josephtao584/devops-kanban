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

const getConfirmButton = (wrapper) => wrapper.find('button:last-of-type')
const getRetryButton = (wrapper) => wrapper.findAll('button').find((button) => button.text() === '重试')

const firstTemplate = {
  template_id: 'quick-fix-v1',
  name: '快速修复工作流',
  steps: [{ id: 'triage' }, { id: 'fix' }]
}

const secondTemplate = {
  template_id: 'review-only-v1',
  name: '审查工作流',
  steps: [{ id: 'review' }]
}

describe('WorkflowTemplateSelectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads templates and confirms the selected template id', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [
        firstTemplate,
        secondTemplate
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('快速修复工作流')
    expect(wrapper.text()).toContain('审查工作流')

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    await radios[1].setValue()
    await getConfirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        templateId: 'review-only-v1',
        autoCreateWorktree: true
      }
    ]])
  })

  it('preselects the first returned template on initial load and allows immediate confirm', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [
        firstTemplate,
        secondTemplate
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const radios = wrapper.findAll('input[type="radio"]')
    const confirmButton = getConfirmButton(wrapper)

    expect(radios).toHaveLength(2)
    expect(radios[0].element.checked).toBe(true)
    expect(radios[1].element.checked).toBe(false)
    expect(confirmButton.attributes('disabled')).toBeUndefined()

    await confirmButton.trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        templateId: 'quick-fix-v1',
        autoCreateWorktree: true
      }
    ]])
  })

  it('renders an empty state when no templates are available', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: []
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无可用的工作流模板')
    const confirmButton = getConfirmButton(wrapper)
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

    const retryButton = getRetryButton(wrapper)
    expect(retryButton).toBeTruthy()
    await retryButton.trigger('click')
    await flushPromises()

    expect(getWorkflowTemplates).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('快速修复工作流')
  })

  it('preselects the first returned template after retry success and allows immediate confirm', async () => {
    getWorkflowTemplates
      .mockResolvedValueOnce({ success: false, message: '模板接口失败' })
      .mockResolvedValueOnce({
        success: true,
        data: [
          secondTemplate,
          firstTemplate
        ]
      })

    const wrapper = mountDialog()
    await flushPromises()

    const retryButton = getRetryButton(wrapper)
    expect(retryButton).toBeTruthy()
    await retryButton.trigger('click')
    await flushPromises()

    const radios = wrapper.findAll('input[type="radio"]')
    const confirmButton = getConfirmButton(wrapper)

    expect(radios).toHaveLength(2)
    expect(radios[0].element.value).toBe('review-only-v1')
    expect(radios[0].element.checked).toBe(true)
    expect(radios[1].element.checked).toBe(false)
    expect(confirmButton.attributes('disabled')).toBeUndefined()

    await confirmButton.trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        templateId: 'review-only-v1',
        autoCreateWorktree: true
      }
    ]])
  })

  it('reapplies the first returned template from the latest response when closed and reopened', async () => {
    getWorkflowTemplates
      .mockResolvedValueOnce({
        success: true,
        data: [
          firstTemplate,
          secondTemplate
        ]
      })
      .mockResolvedValueOnce({
        success: true,
        data: [
          secondTemplate,
          firstTemplate
        ]
      })

    const wrapper = mountDialog()
    await flushPromises()

    let radios = wrapper.findAll('input[type="radio"]')
    expect(radios[0].element.checked).toBe(true)

    await radios[1].setValue()
    expect(radios[1].element.checked).toBe(true)

    await wrapper.setProps({ modelValue: false })
    await flushPromises()
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(getWorkflowTemplates).toHaveBeenCalledTimes(2)

    radios = wrapper.findAll('input[type="radio"]')
    const confirmButton = getConfirmButton(wrapper)

    expect(radios).toHaveLength(2)
    expect(radios[0].element.value).toBe('review-only-v1')
    expect(radios[0].element.checked).toBe(true)
    expect(radios[1].element.checked).toBe(false)
    expect(confirmButton.attributes('disabled')).toBeUndefined()

    await confirmButton.trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        templateId: 'review-only-v1',
        autoCreateWorktree: true
      }
    ]])
  })
})
