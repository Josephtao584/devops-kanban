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

const longFeatureTemplate = {
  template_id: 'feature-v1',
  name: '新功能工作流',
  steps: [
    { id: 'step-1' },
    { id: 'step-2' },
    { id: 'step-3' },
    { id: 'step-4' },
    { id: 'step-5' },
    { id: 'step-6' },
    { id: 'step-7' },
    { id: 'step-8' }
  ]
}

const longRefactorTemplate = {
  template_id: 'refactoring-v1',
  name: '重构工作流',
  steps: [
    { id: 'step-a' },
    { id: 'step-b' },
    { id: 'step-c' },
    { id: 'step-d' },
    { id: 'step-e' },
    { id: 'step-f' },
    { id: 'step-g' }
  ]
}

describe('WorkflowTemplateSelectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads templates and confirms the selected template id', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [firstTemplate, secondTemplate]
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
      data: [firstTemplate, secondTemplate]
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

  it('preselects the recommended template when it exists in the returned list', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [firstTemplate, secondTemplate]
    })

    const wrapper = mountDialog({ recommendedTemplateId: 'review-only-v1' })
    await flushPromises()

    const radios = wrapper.findAll('input[type="radio"]')
    const confirmButton = getConfirmButton(wrapper)

    expect(radios).toHaveLength(2)
    expect(radios[0].element.checked).toBe(false)
    expect(radios[1].element.checked).toBe(true)
    expect(wrapper.text()).toContain('已根据任务类型推荐模板')
    expect(wrapper.text()).toContain('审查工作流')
    expect(confirmButton.attributes('disabled')).toBeUndefined()
  })

  it('renders long template step counts including 7 and 8 steps', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [longFeatureTemplate, longRefactorTemplate]
    })

    const wrapper = mountDialog({ recommendedTemplateId: 'feature-v1' })
    await flushPromises()

    expect(wrapper.text()).toContain('新功能工作流')
    expect(wrapper.text()).toContain('重构工作流')
    expect(wrapper.text()).toContain('8 个步骤')
    expect(wrapper.text()).toContain('7 个步骤')

    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios).toHaveLength(2)
    expect(radios[0].element.checked).toBe(true)
    expect(radios[1].element.checked).toBe(false)
  })

  it('supports confirming an 8-step recommended template directly', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [secondTemplate, longFeatureTemplate]
    })

    const wrapper = mountDialog({ recommendedTemplateId: 'feature-v1' })
    await flushPromises()

    await getConfirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        templateId: 'feature-v1',
        autoCreateWorktree: true
      }
    ]])
  })

  it('supports confirming a 7-step template after selection', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [longFeatureTemplate, longRefactorTemplate]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const radios = wrapper.findAll('input[type="radio"]')
    await radios[1].setValue()
    await getConfirmButton(wrapper).trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        templateId: 'refactoring-v1',
        autoCreateWorktree: true
      }
    ]])
  })

  it('renders mixed short and long template metadata together', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [secondTemplate, firstTemplate, longRefactorTemplate, longFeatureTemplate]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('1 个步骤')
    expect(wrapper.text()).toContain('2 个步骤')
    expect(wrapper.text()).toContain('7 个步骤')
    expect(wrapper.text()).toContain('8 个步骤')
  })

  it('renders an empty state when no templates are available', async () => {
    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: []
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无可用的工作流模板')
    expect(getConfirmButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('renders an error state and retries loading', async () => {
    getWorkflowTemplates
      .mockResolvedValueOnce({ success: false, message: '模板接口失败' })
      .mockResolvedValueOnce({
        success: true,
        data: [longFeatureTemplate]
      })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.text()).toContain('模板接口失败')

    const retryButton = getRetryButton(wrapper)
    expect(retryButton).toBeTruthy()
    await retryButton.trigger('click')
    await flushPromises()

    expect(getWorkflowTemplates).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('新功能工作流')
    expect(wrapper.text()).toContain('8 个步骤')
  })
})
