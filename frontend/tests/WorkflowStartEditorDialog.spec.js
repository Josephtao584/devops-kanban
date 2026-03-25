import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import i18n from '../src/locales'
import WorkflowStartEditorDialog from '../src/components/workflow/WorkflowStartEditorDialog.vue'
import { getAgents } from '../src/api/agent'

vi.mock('../src/api/agent', () => ({
  getAgents: vi.fn()
}))

const ElDialogStub = defineComponent({
  name: 'ElDialogStub',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' }
  },
  emits: ['close'],
  setup(props, { slots, emit }) {
    return () => props.modelValue ? h('div', { class: 'el-dialog-stub' }, [
      h('div', { class: 'dialog-title-stub' }, props.title),
      slots.default?.(),
      slots.footer?.(),
      h('button', { class: 'dialog-close-stub', onClick: () => emit('close') }, 'close')
    ]) : null
  }
})

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  props: {
    disabled: { type: Boolean, default: false },
    type: { type: String, default: '' },
    text: { type: Boolean, default: false }
  },
  emits: ['click'],
  setup(props, { slots, emit, attrs }) {
    return () => h('button', {
      ...attrs,
      disabled: props.disabled,
      'data-type': props.type,
      'data-text': String(props.text),
      onClick: (event) => emit('click', event)
    }, slots.default?.())
  }
})

const ElTooltipStub = defineComponent({
  name: 'ElTooltipStub',
  props: {
    content: { type: String, default: '' },
    placement: { type: String, default: 'top' }
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: 'el-tooltip-stub',
      'data-tooltip-content': props.content,
      'data-placement': props.placement
    }, slots.default?.())
  }
})

const ElIconStub = defineComponent({
  name: 'ElIconStub',
  setup(_, { slots }) {
    return () => h('span', { class: 'el-icon-stub' }, slots.default?.())
  }
})

const ElInputStub = defineComponent({
  name: 'ElInputStub',
  props: {
    modelValue: { type: String, default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const onInput = (event) => emit('update:modelValue', event.target.value)
    return () => props.type === 'textarea'
      ? h('textarea', { value: props.modelValue, placeholder: props.placeholder, onInput })
      : h('input', { value: props.modelValue, placeholder: props.placeholder, onInput })
  }
})

const ElSelectStub = defineComponent({
  name: 'ElSelectStub',
  props: {
    modelValue: { type: [Number, String, null], default: null }
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
      onChange
    }, [
      h('option', { value: '' }, 'Unassigned'),
      slots.default?.()
    ])
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
    return () => h('option', { value: props.value, disabled: props.disabled }, props.label)
  }
})

const ElTagStub = defineComponent({
  name: 'ElTagStub',
  props: {
    type: { type: String, default: '' }
  },
  setup(props, { slots }) {
    return () => h('span', { class: 'el-tag-stub', 'data-type': props.type }, slots.default?.())
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mountDialog(props = {}) {
  return mount(WorkflowStartEditorDialog, {
    props: {
      modelValue: true,
      draftTemplate: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 1
          },
          {
            id: 'code-development',
            name: '代码开发',
            instructionPrompt: '根据上游摘要完成代码实现。',
            agentId: 2
          }
        ]
      },
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        'el-dialog': ElDialogStub,
        'el-button': ElButtonStub,
        'el-tooltip': ElTooltipStub,
        'el-icon': ElIconStub,
        'el-input': ElInputStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-tag': ElTagStub
      }
    }
  })
}

describe('WorkflowStartEditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
  })

  it('renders workflow preview with a nested step details dialog trigger', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.find('.workflow-preview-section').exists()).toBe(true)
    expect(wrapper.findAll('.workflow-start-editor-step')).toHaveLength(2)
    expect(wrapper.find('.step-editor-card').exists()).toBe(false)
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(1)
    expect(wrapper.find('.workflow-start-editor-step-name').text()).toBe('需求设计')
  })

  it('hides step ids on cards and uses a neutral chip style for assigned agents', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const firstCard = wrapper.findAll('.workflow-start-editor-step')[0]
    expect(firstCard.find('.workflow-start-editor-step-id').exists()).toBe(false)
    expect(firstCard.find('.workflow-chip').classes()).toContain('workflow-chip--neutral')
    expect(firstCard.find('.workflow-chip').classes()).not.toContain('workflow-chip--success')
    expect(firstCard.text()).not.toContain('requirement-design')
  })

  it('renders icon-only card actions with tooltips and aria labels', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const firstCard = wrapper.findAll('.workflow-start-editor-step')[0]
    expect(firstCard.findAll('.el-tooltip-stub')).toHaveLength(4)
    expect(firstCard.find('[data-testid="insert-step-before-button"]').classes()).toContain('workflow-step-card__icon-button')
    expect(firstCard.find('[data-testid="insert-step-before-button"]').attributes('aria-label')).toBe('前插阶段')
    expect(firstCard.find('[data-testid="insert-step-after-button"]').attributes('aria-label')).toBe('后插阶段')
    expect(firstCard.find('[data-testid="delete-step-button"]').attributes('aria-label')).toBe('删除阶段')
    expect(firstCard.find('[data-testid="open-step-details-button"]').attributes('aria-label')).toBe('详情')
    expect(firstCard.text()).not.toContain('前插阶段')
    expect(firstCard.text()).not.toContain('后插阶段')
    expect(firstCard.text()).not.toContain('删除阶段')
    expect(firstCard.text()).not.toContain('详情')
  })

  it('keeps all card actions in one row by default', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const firstCard = wrapper.findAll('.workflow-start-editor-step')[0]
    expect(firstCard.findAll('.workflow-step-card__action-row')).toHaveLength(1)
    expect(firstCard.findAll('.workflow-step-card__action-row')[0].findAll('button')).toHaveLength(4)
  })

  it('switches the focused step when a preview card is clicked and opens its details dialog', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.findAll('.workflow-start-editor-step')[1].trigger('click')
    await flushPromises()
    await wrapper.findAll('[data-testid="open-step-details-button"]')[1].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(2)
    expect(wrapper.find('.step-editor-card__title').text()).toBe('代码开发')
  })

  it('updates agent selection in the nested step details dialog', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.findAll('[data-testid="open-step-details-button"]')[0].trigger('click')
    await flushPromises()

    const select = wrapper.find('.el-select-stub')
    await select.setValue('2')
    await flushPromises()

    expect(wrapper.find('.step-editor-card .el-tag-stub').exists()).toBe(false)
    expect(wrapper.findAll('.workflow-chip')[0].text()).toContain('开发工程师 - 小李')
  })

  it('updates prompt in the nested step details dialog and includes it in the confirm payload', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.findAll('[data-testid="open-step-details-button"]')[0].trigger('click')
    await flushPromises()

    const textarea = wrapper.find('textarea')
    await textarea.setValue('更新后的提示词内容。')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-start-button"]').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '更新后的提示词内容。',
            agentId: 1
          },
          {
            id: 'code-development',
            name: '代码开发',
            instructionPrompt: '根据上游摘要完成代码实现。',
            agentId: 2
          }
        ]
      }
    ]])
  })

  it('prevents confirming after adding a stage until the new stage is fully configured', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 3, name: '测试工程师 - 小张', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const addButton = wrapper.get('[data-testid="add-step-button"]')
    await addButton.trigger('click')
    await flushPromises()

    const confirmButton = wrapper.get('[data-testid="confirm-start-button"]')
    expect(confirmButton.attributes('disabled')).toBeDefined()
  })

  it('emits a valid snapshot with generated step id after adding and configuring a new stage', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 3, name: '测试工程师 - 小张', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.get('[data-testid="add-step-button"]').trigger('click')
    await flushPromises()

    await wrapper.findAll('[data-testid="open-step-details-button"]')[2].trigger('click')
    await flushPromises()

    const [nameInput] = wrapper.findAll('input')
    await nameInput.setValue('回归验证')
    await flushPromises()

    await wrapper.find('.el-select-stub').setValue('3')
    await flushPromises()

    await wrapper.find('textarea').setValue('执行回归验证并记录结果。')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-start-button"]').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 1
          },
          {
            id: 'code-development',
            name: '代码开发',
            instructionPrompt: '根据上游摘要完成代码实现。',
            agentId: 2
          },
          {
            id: 'step-3',
            name: '回归验证',
            instructionPrompt: '执行回归验证并记录结果。',
            agentId: 3
          }
        ]
      }
    ]])
  })

  it('inserts a new stage before the selected stage and focuses it', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 3, name: '测试工程师 - 小张', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const beforeButtons = wrapper.findAll('[data-testid="insert-step-before-button"]')
    expect(beforeButtons).toHaveLength(2)
    await beforeButtons[1].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.workflow-start-editor-step')).toHaveLength(3)
    expect(wrapper.findAll('.workflow-start-editor-step-name')[1].text()).toBe('新阶段')
    expect(wrapper.findAll('.workflow-start-editor-step')[1].classes()).toContain('is-selected')
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(2)
  })

  it('inserts a new stage after the selected stage and emits the correct order after configuration', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 3, name: '测试工程师 - 小张', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const afterButtons = wrapper.findAll('[data-testid="insert-step-after-button"]')
    expect(afterButtons).toHaveLength(2)
    await afterButtons[0].trigger('click')
    await flushPromises()

    const [nameInput] = wrapper.findAll('input')
    await nameInput.setValue('评审')
    await flushPromises()

    await wrapper.find('.el-select-stub').setValue('3')
    await flushPromises()

    await wrapper.find('textarea').setValue('完成代码评审。')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-start-button"]').trigger('click')

    expect(wrapper.emitted('confirm')?.[0]?.[0]?.steps.map((step) => step.name)).toEqual([
      '需求设计',
      '评审',
      '代码开发'
    ])
  })

  it('keeps one remaining stage undeletable in startup editing', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue()
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})

    const wrapper = mountDialog({
      draftTemplate: {
        template_id: 'single-step',
        name: '单步流程',
        steps: [
          { id: 'step-1', name: '需求设计', instructionPrompt: '先完成需求分析。', agentId: 1 }
        ]
      }
    })
    await flushPromises()

    const deleteButtons = wrapper.findAll('[data-testid="delete-step-button"]')
    expect(deleteButtons).toHaveLength(1)
    expect(deleteButtons[0].attributes('disabled')).toBeDefined()
    await deleteButtons[0].trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(wrapper.findAll('.workflow-start-editor-step')).toHaveLength(1)
  })

  it('renders missing and disabled agent states inline', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: false, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog({
      draftTemplate: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          { id: 'step-1', name: '需求设计', instructionPrompt: '先完成需求分析。', agentId: 1 },
          { id: 'step-2', name: '测试', instructionPrompt: '执行测试。', agentId: 999 }
        ]
      }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('架构师 - 老王 (已禁用)')
    expect(wrapper.text()).toContain('缺失成员 (#999)')
  })

  it('reports agent loading failures', async () => {
    getAgents.mockRejectedValue(new Error('agent service unavailable'))

    mountDialog()
    await flushPromises()

    expect(ElMessage.error).toHaveBeenCalledWith('agent service unavailable')
  })
})
