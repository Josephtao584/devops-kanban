import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import i18n from '../src/locales'
import WorkflowStartEditorDialog from '../src/components/workflow/WorkflowStartEditorDialog.vue'
import { getAgents } from '../src/api/agent'

vi.mock('vuedraggable', () => ({
  default: defineComponent({
    name: 'DraggableStub',
    props: {
      list: { type: Array, default: () => [] },
      itemKey: { type: String, default: 'id' }
    },
    emits: ['end', 'update:modelValue'],
    setup(props, { slots }) {
      return () => {
        const items = props.list || []
        return h('div', { class: 'draggable-stub' }, items.map((element, index) =>
          slots.item ? slots.item({ element, index }) : null
        ))
      }
    }
  })
}))

vi.mock('../src/api/agent', () => ({
  getAgents: vi.fn()
}))

vi.mock('../src/stores/skillStore', () => ({
  useSkillStore: vi.fn().mockReturnValue({
    skills: [],
    fetchSkills: vi.fn().mockResolvedValue(undefined)
  })
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

const ElCheckboxStub = defineComponent({
  name: 'ElCheckboxStub',
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: 'el-checkbox-stub' })
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

const ElSwitchStub = defineComponent({
  name: 'ElSwitchStub',
  props: {
    modelValue: { type: Boolean, default: false },
    activeText: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    return () => h('label', { class: 'el-switch-stub' }, [
      slots.default?.(),
      h('input', {
        type: 'checkbox',
        checked: props.modelValue,
        onChange: (e) => emit('update:modelValue', e.target.checked)
      })
    ])
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
  await nextTick()
}

function mountDialog(props = {}) {
  return mount(WorkflowStartEditorDialog, {
    props: {
      modelValue: true,
      draftTemplate: {
        template_id: 'workflow-v1',
        name: '通用复杂任务工作流',
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
        'el-tag': ElTagStub,
        'el-switch': ElSwitchStub,
        'el-checkbox': ElCheckboxStub
      }
    }
  })
}

const getStepCards = (wrapper) => wrapper.findAll('.workflow-start-editor-step')
const getConnectors = (wrapper) => wrapper.findAll('.workflow-connector--insert')
const getDeleteButtons = (wrapper) => wrapper.findAll('.workflow-step-card__delete')

describe('WorkflowStartEditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
  })

  it('renders workflow preview with step cards and connectors', async () => {
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
    expect(getStepCards(wrapper)).toHaveLength(2)
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(1)
    expect(wrapper.find('.workflow-start-editor-step-name').text()).toBe('需求设计')
    expect(getConnectors(wrapper).length).toBeGreaterThanOrEqual(3)
  })

  it('uses neutral chip style for assigned agents', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const firstCard = getStepCards(wrapper)[0]
    expect(firstCard.find('.workflow-chip').classes()).toContain('workflow-chip--neutral')
    expect(firstCard.text()).not.toContain('requirement-design')
  })

  it('renders delete buttons on cards with aria labels and connectors between cards', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const deleteButtons = getDeleteButtons(wrapper)
    expect(deleteButtons).toHaveLength(2)
    expect(deleteButtons[0].attributes('aria-label')).toBe('删除阶段')

    const connectors = getConnectors(wrapper)
    expect(connectors[0].attributes('aria-label')).toBe('前插阶段')
    expect(connectors[connectors.length - 1].attributes('aria-label')).toBe('后插阶段')
  })

  it('opens step details dialog when a step is selected via connector insert', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    await getStepCards(wrapper)[1].trigger('click')
    await flushPromises()

    expect(getStepCards(wrapper)[1].classes()).toContain('is-selected')
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

    const connectors = getConnectors(wrapper)
    await connectors[1].trigger('click')
    await flushPromises()

    const select = wrapper.find('.el-select-stub')
    await select.setValue('2')
    await flushPromises()

    expect(wrapper.findAll('.workflow-chip')[1].text()).toContain('开发工程师 - 小李')
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

    await getStepCards(wrapper)[0].trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-start-button"]').trigger('click')

    expect(wrapper.emitted('confirm')).toEqual([[
      {
        template_id: 'workflow-v1',
        name: '通用复杂任务工作流',
        tags: [],
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 1,
            requiresConfirmation: false
          },
          {
            id: 'code-development',
            name: '代码开发',
            instructionPrompt: '根据上游摘要完成代码实现。',
            agentId: 2,
            requiresConfirmation: false
          }
        ]
      },
      true
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

    // Use trailing connector to insert a new step (it also opens the details dialog)
    const connectors = getConnectors(wrapper)
    const trailingConnector = connectors[connectors.length - 1]
    await trailingConnector.trigger('click')
    await flushPromises()

    // The step details dialog should be open now — fill the form
    const inputs = wrapper.findAll('input')
    const nameInput = inputs[0]
    await nameInput.setValue('回归验证')
    await flushPromises()

    await wrapper.find('.el-select-stub').setValue('3')
    await flushPromises()

    await wrapper.find('textarea').setValue('执行回归验证并记录结果。')
    await flushPromises()

    // Close details dialog first
    const closeButtons = wrapper.findAll('button')
    const closeButton = closeButtons.find((btn) => btn.text() === '关闭')
    if (closeButton) {
      await closeButton.trigger('click')
      await flushPromises()
    }

    await wrapper.get('[data-testid="confirm-start-button"]').trigger('click')

    const emitted = wrapper.emitted('confirm')
    expect(emitted).toHaveLength(1)
    const payload = emitted[0][0]
    expect(emitted[0][1]).toBe(true) // autoCreateWorktree
    expect(payload.steps.map((step) => step.name)).toContain('回归验证')
    expect(payload.steps.find((step) => step.name === '回归验证').agentId).toBe(3)
    expect(payload.steps.find((step) => step.name === '回归验证').instructionPrompt).toBe('执行回归验证并记录结果。')
  })

  it('inserts a new stage before the second card via between connector', async () => {
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

    const connectors = getConnectors(wrapper)
    const betweenConnector = connectors[1]
    await betweenConnector.trigger('click')
    await flushPromises()

    expect(getStepCards(wrapper)).toHaveLength(3)
    expect(getStepCards(wrapper).map((card) => card.find('.workflow-start-editor-step-name').text())).toEqual([
      '需求设计',
      '新阶段',
      '代码开发'
    ])
    expect(getStepCards(wrapper)[1].classes()).toContain('is-selected')
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(2)
  })

  it('inserts a new stage after the first card via connector and emits correct order after configuration', async () => {
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

    const connectors = getConnectors(wrapper)
    const trailingConnector = connectors[connectors.length - 1]
    await trailingConnector.trigger('click')
    await flushPromises()

    const inputs = wrapper.findAll('input')
    const nameInput = inputs.find((input) => input.attributes('data-testid') !== 'template-name-input')
    await nameInput.setValue('评审')
    await flushPromises()

    await wrapper.find('.el-select-stub').setValue('3')
    await flushPromises()

    await wrapper.find('textarea').setValue('完成代码评审。')
    await flushPromises()

    await wrapper.get('[data-testid="confirm-start-button"]').trigger('click')

    expect(wrapper.emitted('confirm')?.[0]?.[0]?.steps.map((step) => step.name)).toEqual([
      '需求设计',
      '代码开发',
      '评审'
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

    const deleteButtons = getDeleteButtons(wrapper)
    expect(deleteButtons).toHaveLength(1)
    expect(deleteButtons[0].attributes('disabled')).toBeDefined()
    await deleteButtons[0].trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(getStepCards(wrapper)).toHaveLength(1)
  })

  it('renders missing and disabled agent states on cards', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: false, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog({
      draftTemplate: {
        template_id: 'workflow-v1',
        name: '通用复杂任务工作流',
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

  it('renders delete buttons always visible with light icon', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const deleteButtons = getDeleteButtons(wrapper)
    expect(deleteButtons).toHaveLength(2)
    for (const button of deleteButtons) {
      expect(button.exists()).toBe(true)
    }
  })

  it('renders the draggable track wrapping step cards', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const draggableStub = wrapper.find('.draggable-stub')
    expect(draggableStub.exists()).toBe(true)
    expect(getStepCards(wrapper)).toHaveLength(2)
  })
})
