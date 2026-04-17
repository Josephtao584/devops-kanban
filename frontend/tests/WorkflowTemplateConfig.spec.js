import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import WorkflowTemplateConfig from '../src/views/WorkflowTemplateConfig.vue'
import i18n from '../src/locales'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  getWorkflowTemplates,
  updateWorkflowTemplate,
  reorderWorkflowTemplates
} from '../src/api/workflowTemplate'
import { getAgents } from '../src/api/agent'

vi.mock('vuedraggable', () => ({
  default: defineComponent({
    name: 'DraggableStub',
    props: {
      list: { type: Array, default: () => [] },
      modelValue: { type: Array, default: () => [] },
      itemKey: { type: String, default: 'id' }
    },
    emits: ['end', 'update:modelValue'],
    setup(props, { slots }) {
      return () => {
        const items = props.list?.length ? props.list : (props.modelValue || [])
        return h('div', { class: 'draggable-stub' }, items.map((element, index) =>
          slots.item ? slots.item({ element, index }) : null
        ))
      }
    }
  })
}))

vi.mock('../src/api/workflowTemplate', () => ({
  createWorkflowTemplate: vi.fn(),
  deleteWorkflowTemplate: vi.fn(),
  getWorkflowTemplateById: vi.fn(),
  getWorkflowTemplates: vi.fn(),
  updateWorkflowTemplate: vi.fn(),
  reorderWorkflowTemplates: vi.fn()
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

const defaultTemplate = {
  template_id: 'workflow-v1',
  name: '通用复杂任务工作流',
  steps: [
    {
      id: 'solution-design',
      name: '方案设计',
      instructionPrompt: '完成方案设计。',
      agentId: 1
    },
    {
      id: 'qa-validation',
      name: '测试验证',
      instructionPrompt: '执行测试验证。',
      agentId: null
    }
  ],
  tags: []
}

const customTemplate = {
  template_id: 'release-workflow-v1',
  name: '发布工作流',
  steps: [
    {
      id: 'requirement-design',
      name: '需求设计',
      instructionPrompt: '梳理发布范围。',
      agentId: 2
    },
    {
      id: 'testing',
      name: '测试',
      instructionPrompt: '验证发布候选版本。',
      agentId: 999
    }
  ],
  tags: []
}

const ElCardStub = defineComponent({
  name: 'ElCardStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, slots.default?.())
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
  setup(props, { slots, attrs, emit }) {
    return () => h('button', {
      ...attrs,
      class: ['el-button-stub', attrs.class],
      disabled: props.disabled,
      'data-type': props.type,
      'data-text': String(props.text),
      onClick: (event) => emit('click', event)
    }, slots.default?.())
  }
})

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
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    const onInput = (event) => emit('update:modelValue', event.target.value)

    return () => props.type === 'textarea'
      ? h('textarea', {
        ...attrs,
        value: props.modelValue,
        placeholder: props.placeholder,
        onInput
      })
      : h('input', {
        ...attrs,
        value: props.modelValue,
        placeholder: props.placeholder,
        onInput
      })
  }
})

const ElSelectStub = defineComponent({
  name: 'ElSelectStub',
  props: {
    modelValue: {
      type: [Number, String, null],
      default: null
    }
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
    return () => h('option', {
      value: props.value,
      disabled: props.disabled
    }, props.label)
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
  await nextTick()
  await nextTick()
}

const createDeferred = () => {
  let resolve
  let reject

  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function mockTemplateApis() {
  getWorkflowTemplates.mockResolvedValue({
    success: true,
    data: [defaultTemplate, customTemplate]
  })

  getWorkflowTemplateById.mockImplementation(async (templateId) => {
    const template = templateId === defaultTemplate.template_id ? defaultTemplate : customTemplate
    return {
      success: true,
      data: JSON.parse(JSON.stringify(template))
    }
  })
}

function mountView() {
  return mount(WorkflowTemplateConfig, {
    global: {
      plugins: [i18n],
      stubs: {
        'el-card': ElCardStub,
        'el-button': ElButtonStub,
        'el-dialog': ElDialogStub,
        'el-tooltip': ElTooltipStub,
        'el-icon': ElIconStub,
        'el-input': ElInputStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-tag': ElTagStub,
        'el-checkbox': defineComponent({
          name: 'ElCheckboxStub',
          props: {
            modelValue: { type: Boolean, default: false }
          },
          emits: ['update:modelValue', 'change'],
          setup(_, { attrs }) {
            return () => h('input', {
              type: 'checkbox',
              class: 'el-checkbox-stub',
              onClick: (e) => e.stopPropagation(),
              ...attrs
            })
          }
        }),
        'el-switch': defineComponent({
          name: 'ElSwitchStub',
          props: {
            modelValue: { type: Boolean, default: false },
            activeText: { type: String, default: '' }
          },
          emits: ['update:modelValue'],
          setup(props, { slots, emit }) {
            return () => h('label', { class: 'el-switch-stub' }, [
              slots.default?.(),
              h('span', {
                class: 'switch-value',
                'data-checked': String(props.modelValue),
                onClick: () => emit('update:modelValue', !props.modelValue)
              })
            ])
          }
        }),
        'WorkflowTemplateImportDialog': defineComponent({
          name: 'WorkflowTemplateImportDialogStub',
          props: {
            modelValue: { type: Boolean, default: false },
            agents: { type: Array, default: () => [] }
          },
          emits: ['update:modelValue', 'imported'],
          setup() {
            return () => h('div', { class: 'workflow-template-import-dialog-stub' })
          }
        })
      }
    }
  })
}

const selectReleaseTemplate = async (wrapper) => {
  await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
  await flushPromises()
}

const getStepCards = (wrapper) => wrapper.findAll('.workflow-step-card')
const getSelectedStepCard = (wrapper) => wrapper.find('.workflow-step-card.is-selected')
const getConnectors = (wrapper) => wrapper.findAll('.workflow-connector--insert')
const getDeleteStepButtons = (wrapper) => wrapper.findAll('.workflow-step-card__delete')
const getInlineStepNameInput = (wrapper) => wrapper.findAll('input').find((input) => input.attributes('data-testid') !== 'template-name-input' && input.attributes('type') !== 'checkbox')

const focusInlineEditor = async (wrapper, index = 0) => {
  await getStepCards(wrapper)[index].trigger('click')
  await flushPromises()
}

const fillInlineEditor = async (wrapper, {
  name,
  agentId,
  instructionPrompt
} = {}) => {
  if (typeof name === 'string') {
    const nameInput = getInlineStepNameInput(wrapper)
    await nameInput.setValue(name)
    await flushPromises()
  }

  if (typeof agentId !== 'undefined') {
    await wrapper.find('.step-editor-card .el-select-stub, .step-editor-section .el-select-stub').setValue(String(agentId))
    await flushPromises()
  }

  if (typeof instructionPrompt === 'string') {
    await wrapper.find('textarea').setValue(instructionPrompt)
    await flushPromises()
  }
}

const getSelectedCardName = (wrapper) => getSelectedStepCard(wrapper).find('.workflow-step-card__name').text()

const createTemplateWithSteps = (steps) => ({
  template_id: 'release-workflow-v1',
  name: '发布工作流',
  steps
})

const namedStep = (id, name, instructionPrompt, agentId) => ({ id, name, instructionPrompt, agentId })

describe('WorkflowTemplateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue()

    mockTemplateApis()
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Claude Dev', enabled: true },
        { id: 2, name: 'Disabled Agent', enabled: false },
        { id: 3, name: 'Codex Reviewer', enabled: true }
      ]
    })
  })

  it('lists templates, loads selected detail, and keeps the default template non-deletable', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(getWorkflowTemplates).toHaveBeenCalledTimes(1)
    expect(getWorkflowTemplateById).toHaveBeenCalledWith('workflow-v1')
    expect(wrapper.text()).toContain('通用复杂任务工作流')
    expect(wrapper.text()).toContain('发布工作流')

    const deleteButton = wrapper.get('[data-testid="delete-template-button"]')
    expect(deleteButton.attributes()).toHaveProperty('disabled')

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    expect(getWorkflowTemplateById).toHaveBeenLastCalledWith('release-workflow-v1')
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('release-workflow-v1')
    expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('发布工作流')
    expect(wrapper.get('[data-testid="delete-template-button"]').attributes('disabled')).toBeUndefined()
  })

  it('creates a local draft from the selected template without calling the create API', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="create-template-id-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-template-name-input"]').exists()).toBe(false)

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="create-template-button"]').trigger('click')
    await flushPromises()

    const draftId = wrapper.get('[data-testid="template-id"]').text()

    expect(createWorkflowTemplate).not.toHaveBeenCalled()
    expect(draftId).toContain('draft-')
    expect(wrapper.find(`[data-testid="template-item-${draftId}"]`).exists()).toBe(true)
    expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('新建模版')
    expect(getStepCards(wrapper)).toHaveLength(customTemplate.steps.length)
    expect(wrapper.find('.step-editor-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Disabled Agent (已禁用)')
    expect(wrapper.find('[data-testid="template-item-release-workflow-v1"]').exists()).toBe(true)
  })

  it('creates the template only when saving a new draft', async () => {
    createWorkflowTemplate.mockResolvedValue({
      success: true,
      data: {
        template_id: 'template-3',
        name: '新建模版',
        steps: customTemplate.steps.map((step) => ({ ...step }))
      }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="create-template-button"]').trigger('click')
    await flushPromises()
    const draftId = wrapper.get('[data-testid="template-id"]').text()

    await wrapper.get('[data-testid="save-template-button"]').trigger('click')
    await flushPromises()

    expect(createWorkflowTemplate).toHaveBeenCalledTimes(1)
    expect(createWorkflowTemplate.mock.calls[0][0].template_id).toMatch(/^template-\d+$/)
    expect(wrapper.find(`[data-testid="template-item-${draftId}"]`).exists()).toBe(false)
    expect(wrapper.find('[data-testid="template-item-template-3"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('template-3')
  })

  it('keeps the draft selected when saving a new draft fails', async () => {
    createWorkflowTemplate.mockRejectedValue(new Error('save failed'))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="create-template-button"]').trigger('click')
    await flushPromises()
    const draftId = wrapper.get('[data-testid="template-id"]').text()

    await wrapper.get('[data-testid="save-template-button"]').trigger('click')
    await flushPromises()

    expect(ElMessage.error).toHaveBeenCalledWith('save failed')
    expect(wrapper.find(`[data-testid="template-item-${draftId}"]`).exists()).toBe(true)
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain(draftId)
    expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('新建模版')
    expect(wrapper.find('[data-testid="template-item-template-3"]').exists()).toBe(false)
  })

  it('deletes a local draft without calling the delete API', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="create-template-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('draft-')

    await wrapper.get('[data-testid="delete-template-button"]').trigger('click')
    await flushPromises()

    expect(deleteWorkflowTemplate).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('workflow-v1')
  })

  it('saves step bindings with agentId and without executor.type', async () => {
    updateWorkflowTemplate.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await focusInlineEditor(wrapper, 0)

    const select = wrapper.get('.step-editor-card select.el-select-stub')
    await select.setValue('3')
    await wrapper.get('[data-testid="template-name-input"]').setValue('发布工作流-已更新')
    await wrapper.get('[data-testid="save-template-button"]').trigger('click')
    await flushPromises()

    expect(updateWorkflowTemplate).toHaveBeenCalledTimes(1)
    const savedPayload = updateWorkflowTemplate.mock.calls[0][0]

    expect(savedPayload.template_id).toBe('release-workflow-v1')
    expect(savedPayload.name).toBe('发布工作流-已更新')
    expect(savedPayload.steps[0]).toMatchObject({
      id: 'requirement-design',
      agentId: 3
    })
    expect(savedPayload.steps[0]).not.toHaveProperty('executor')
    expect(savedPayload.steps).toHaveLength(2)
  })

  it('renders disabled and missing agent bindings clearly for the selected template', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await focusInlineEditor(wrapper, 0)

    const disabledOption = wrapper.find('option[value="2"]')
    expect(disabledOption.exists()).toBe(true)
    expect(disabledOption.attributes()).toHaveProperty('disabled')
    expect(wrapper.text()).toContain('Disabled Agent (已禁用)')
    expect(wrapper.text()).toContain('缺失成员 (#999)')
  })

  it('does not render an empty binding state row when the selected step has no warning tag', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()

    await focusInlineEditor(wrapper, 1)
    await wrapper.find('.step-editor-card select.el-select-stub, .step-editor-section select.el-select-stub').setValue('3')
    await flushPromises()

    const bindingStateRow = wrapper.find('.binding-state-row')
    expect(bindingStateRow.exists()).toBe(false)
  })

  it('does not report missing agents when agent loading fails', async () => {
    getAgents.mockRejectedValueOnce(new Error('agent service unavailable'))

    const wrapper = mountView()
    await flushPromises()

    expect(ElMessage.error).toHaveBeenCalledWith('agent service unavailable')
    expect(wrapper.text()).not.toContain('缺失成员 (#1)')
    expect(wrapper.text()).not.toContain('缺失成员 (#999)')
  })

  it('ignores stale template detail responses when switching templates quickly', async () => {
    const bugfixTemplate = {
      template_id: 'bugfix-flow-v1',
      name: 'Bugfix Flow',
      steps: [
        {
          id: 'requirement-design',
          name: '需求设计',
          instructionPrompt: '分析缺陷范围。',
          agentId: 1
        }
      ]
    }

    getWorkflowTemplates.mockResolvedValue({
      success: true,
      data: [defaultTemplate, customTemplate, bugfixTemplate]
    })

    const releaseDetail = createDeferred()
    const bugfixDetail = createDeferred()

    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      if (templateId === 'workflow-v1') {
        return {
          success: true,
          data: JSON.parse(JSON.stringify(defaultTemplate))
        }
      }

      if (templateId === 'release-workflow-v1') {
        return releaseDetail.promise
      }

      if (templateId === 'bugfix-flow-v1') {
        return bugfixDetail.promise
      }

      return {
        success: true,
        data: JSON.parse(JSON.stringify(customTemplate))
      }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await wrapper.get('[data-testid="template-item-bugfix-flow-v1"]').trigger('click')

    bugfixDetail.resolve({
      success: true,
      data: JSON.parse(JSON.stringify(bugfixTemplate))
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('bugfix-flow-v1')

    releaseDetail.resolve({
      success: true,
      data: JSON.parse(JSON.stringify(customTemplate))
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('bugfix-flow-v1')
    expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('Bugfix Flow')
  })

  it('keeps delete success when follow-up reload fails', async () => {
    deleteWorkflowTemplate.mockResolvedValue({
      success: true,
      data: null
    })

    getWorkflowTemplates
      .mockResolvedValueOnce({
        success: true,
        data: [defaultTemplate, customTemplate]
      })
      .mockRejectedValueOnce(new Error('refresh failed'))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="delete-template-button"]').trigger('click')
    await flushPromises()

    expect(deleteWorkflowTemplate).toHaveBeenCalledWith('release-workflow-v1')
    expect(ElMessage.success).toHaveBeenCalledWith('工作流模板已删除')
    expect(ElMessage.error).toHaveBeenCalledWith('refresh failed')
    expect(wrapper.find('[data-testid="template-item-release-workflow-v1"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('workflow-v1')
  })

  it('keeps template-page-specific actions while rendering card-level workflow editor controls', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    expect(wrapper.get('[data-testid="template-name-input"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="save-template-button"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="delete-template-button"]').exists()).toBe(true)
    expect(wrapper.find('.step-editor-section').exists()).toBe(true)
    expect(getStepCards(wrapper)).toHaveLength(2)

    const connectors = getConnectors(wrapper)
    expect(connectors.length).toBeGreaterThanOrEqual(3)

    const firstCard = getStepCards(wrapper)[0]
    expect(firstCard.find('.workflow-step-card__delete').exists()).toBe(true)
    expect(firstCard.find('.workflow-step-card__delete').attributes('aria-label')).toBe('删除阶段')
  })

  it('keeps editing inline below the cards when card actions are present', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    expect(wrapper.find('.step-editor-section').exists()).toBe(true)
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(0)
    expect(wrapper.find('.step-editor-card').exists()).toBe(true)

    await focusInlineEditor(wrapper, 1)

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(0)
  })

  it('updates card content from the inline editor and preserves template-level save flow', async () => {
    updateWorkflowTemplate.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)
    await focusInlineEditor(wrapper, 0)

    await fillInlineEditor(wrapper, {
      name: '发布评审',
      agentId: 3,
      instructionPrompt: '完成发布评审并同步结论。'
    })

    expect(getStepCards(wrapper)[0].find('.workflow-step-card__name').text()).toBe('发布评审')
    expect(getStepCards(wrapper)[0].find('.workflow-chip').text()).toContain('Codex Reviewer')
    expect(wrapper.find('.step-editor-section').exists()).toBe(true)
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(0)

    await wrapper.get('[data-testid="save-template-button"]').trigger('click')
    await flushPromises()

    expect(updateWorkflowTemplate).toHaveBeenCalledTimes(1)
    expect(updateWorkflowTemplate.mock.calls[0][0].steps[0]).toMatchObject({
      id: 'requirement-design',
      name: '发布评审',
      instructionPrompt: '完成发布评审并同步结论。',
      agentId: 3
    })
  })

  it('inserts a new step before a card via connector and selects the inserted step', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const connectors = getConnectors(wrapper)
    const betweenConnector = connectors[1]
    await betweenConnector.trigger('click')
    await flushPromises()

    expect(getStepCards(wrapper)).toHaveLength(3)
    expect(getSelectedCardName(wrapper)).toBe('新阶段')
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(0)
    expect(getStepCards(wrapper).map((card) => card.find('.workflow-step-card__name').text())).toEqual([
      '需求设计',
      '新阶段',
      '测试'
    ])
  })

  it('inserts a new step after a card via trailing connector and keeps template-page validation rules intact', async () => {
    updateWorkflowTemplate.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const connectors = getConnectors(wrapper)
    const trailingConnector = connectors[connectors.length - 1]
    await trailingConnector.trigger('click')
    await flushPromises()

    expect(getStepCards(wrapper)).toHaveLength(3)
    expect(getSelectedCardName(wrapper)).toBe('新阶段')

    await fillInlineEditor(wrapper, {
      name: '回归验证',
      agentId: 3,
      instructionPrompt: '执行回归验证。'
    })

    await wrapper.get('[data-testid="save-template-button"]').trigger('click')
    await flushPromises()

    expect(updateWorkflowTemplate).toHaveBeenCalledTimes(1)
    expect(updateWorkflowTemplate.mock.calls[0][0].steps.map((step) => step.name)).toEqual([
      '需求设计',
      '测试',
      '回归验证'
    ])
  })

  it('deletes the selected middle step via card delete button and keeps the previous step selected with the min-step rule of one', async () => {
    const templateWithTwoSteps = createTemplateWithSteps([
      namedStep('requirement-design', '需求设计', '先完成需求分析。', 1),
      namedStep('implementation', '实现', '完成代码实现。', 3)
    ])
    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      const template = templateId === defaultTemplate.template_id ? defaultTemplate : templateWithTwoSteps
      return {
        success: true,
        data: JSON.parse(JSON.stringify(template))
      }
    })

    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)
    await getStepCards(wrapper)[1].trigger('click')
    await flushPromises()

    const deleteButtons = getDeleteStepButtons(wrapper)
    await deleteButtons[1].trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1)
    expect(getStepCards(wrapper)).toHaveLength(1)
    expect(getSelectedCardName(wrapper)).toBe('需求设计')
    expect(getDeleteStepButtons(wrapper).every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.text()).toContain('模版至少保留 1 个阶段')
  })

  it('blocks deleting steps when only one step remains and keeps the selected step unchanged', async () => {
    const templateWithOneStep = createTemplateWithSteps([
      namedStep('requirement-design', '需求设计', '先完成需求分析。', 1)
    ])
    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      const template = templateId === defaultTemplate.template_id ? defaultTemplate : templateWithOneStep
      return {
        success: true,
        data: JSON.parse(JSON.stringify(template))
      }
    })

    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)
    await flushPromises()

    const deleteButtons = getDeleteStepButtons(wrapper)
    expect(deleteButtons).toHaveLength(1)
    expect(deleteButtons[0].attributes('disabled')).toBeDefined()

    await deleteButtons[0].trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(getStepCards(wrapper)).toHaveLength(1)
    expect(getSelectedCardName(wrapper)).toBe('需求设计')
  })

  it('deletes a custom template and returns to the default template', async () => {
    deleteWorkflowTemplate.mockResolvedValue({
      success: true,
      data: null
    })

    getWorkflowTemplates
      .mockResolvedValueOnce({
        success: true,
        data: [defaultTemplate, customTemplate]
      })
      .mockResolvedValueOnce({
        success: true,
        data: [defaultTemplate]
      })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="delete-template-button"]').trigger('click')
    await flushPromises()

    expect(deleteWorkflowTemplate).toHaveBeenCalledWith('release-workflow-v1')
    expect(getWorkflowTemplateById).toHaveBeenLastCalledWith('workflow-v1')
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('workflow-v1')
    expect(wrapper.find('[data-testid="template-item-release-workflow-v1"]').exists()).toBe(false)
  })

  it('renders delete buttons always visible with light icon style', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const deleteButtons = getDeleteStepButtons(wrapper)
    expect(deleteButtons).toHaveLength(2)

    for (const button of deleteButtons) {
      expect(button.exists()).toBe(true)
      expect(button.attributes('disabled')).toBeUndefined()
    }
  })

  it('renders connectors between cards with insert-before and insert-after actions', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const connectors = getConnectors(wrapper)
    expect(connectors.length).toBeGreaterThanOrEqual(3)

    const leadingConnector = connectors[0]
    expect(leadingConnector.attributes('aria-label')).toBe('前插阶段')

    const trailingConnector = connectors[connectors.length - 1]
    expect(trailingConnector.attributes('aria-label')).toBe('后插阶段')
  })

  it('renders the draggable track wrapping step cards', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const draggableStub = wrapper.find('.draggable-stub')
    expect(draggableStub.exists()).toBe(true)
    expect(getStepCards(wrapper)).toHaveLength(2)
  })

  it('renders leading connector that inserts before the first card', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const connectors = getConnectors(wrapper)
    const leadingConnector = connectors[0]
    await leadingConnector.trigger('click')
    await flushPromises()

    expect(getStepCards(wrapper)).toHaveLength(3)
    expect(getStepCards(wrapper).map((card) => card.find('.workflow-step-card__name').text())).toEqual([
      '新阶段',
      '需求设计',
      '测试'
    ])
    expect(getSelectedCardName(wrapper)).toBe('新阶段')
  })

  it('renders trailing connector that inserts after the last card', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    const connectors = getConnectors(wrapper)
    const trailingConnector = connectors[connectors.length - 1]
    await trailingConnector.trigger('click')
    await flushPromises()

    expect(getStepCards(wrapper)).toHaveLength(3)
    expect(getStepCards(wrapper).map((card) => card.find('.workflow-step-card__name').text())).toEqual([
      '需求设计',
      '测试',
      '新阶段'
    ])
    expect(getSelectedCardName(wrapper)).toBe('新阶段')
  })

  it('reorders steps when drag end handler moves selected step', async () => {
    updateWorkflowTemplate.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    const templateWithThreeSteps = createTemplateWithSteps([
      namedStep('requirement-design', '需求设计', '先完成需求分析。', 1),
      namedStep('implementation', '实现', '完成代码实现。', 3),
      namedStep('testing', '测试', '执行测试。', 3)
    ])
    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      const template = templateId === defaultTemplate.template_id ? defaultTemplate : templateWithThreeSteps
      return {
        success: true,
        data: JSON.parse(JSON.stringify(template))
      }
    })

    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    expect(getStepCards(wrapper).map((card) => card.find('.workflow-step-card__name').text())).toEqual([
      '需求设计',
      '实现',
      '测试'
    ])

    await getStepCards(wrapper)[1].trigger('click')
    await flushPromises()
    expect(getSelectedCardName(wrapper)).toBe('实现')

    const steps = wrapper.vm.template.steps
    const [moved] = steps.splice(1, 1)
    steps.splice(0, 0, moved)
    wrapper.vm.onStepDragEnd({ oldIndex: 1, newIndex: 0 })
    await flushPromises()

    expect(getStepCards(wrapper).map((card) => card.find('.workflow-step-card__name').text())).toEqual([
      '实现',
      '需求设计',
      '测试'
    ])
    expect(getSelectedCardName(wrapper)).toBe('实现')
  })

  it('updates selectedStepIndex correctly when a step before the selected one is dragged forward', async () => {
    const templateWithThreeSteps = createTemplateWithSteps([
      namedStep('requirement-design', '需求设计', '先完成需求分析。', 1),
      namedStep('implementation', '实现', '完成代码实现。', 3),
      namedStep('testing', '测试', '执行测试。', 3)
    ])
    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      const template = templateId === defaultTemplate.template_id ? defaultTemplate : templateWithThreeSteps
      return {
        success: true,
        data: JSON.parse(JSON.stringify(template))
      }
    })

    const wrapper = mountView()
    await flushPromises()
    await selectReleaseTemplate(wrapper)

    await getStepCards(wrapper)[2].trigger('click')
    await flushPromises()
    expect(getSelectedCardName(wrapper)).toBe('测试')

    const steps = wrapper.vm.template.steps
    const [moved] = steps.splice(0, 1)
    steps.splice(2, 0, moved)
    wrapper.vm.onStepDragEnd({ oldIndex: 0, newIndex: 2 })
    await flushPromises()

    expect(getStepCards(wrapper).map((card) => card.find('.workflow-step-card__name').text())).toEqual([
      '实现',
      '测试',
      '需求设计'
    ])
    expect(getSelectedCardName(wrapper)).toBe('测试')
  })

  describe('copy template', () => {
    it('creates a draft from the copied template with copied name and steps', async () => {
      const wrapper = mountView()
      await flushPromises()

      const copyBtn = wrapper.find('[data-testid="copy-template-release-workflow-v1"]')
      expect(copyBtn.exists()).toBe(true)

      await copyBtn.trigger('click')
      await flushPromises()

      expect(createWorkflowTemplate).not.toHaveBeenCalled()

      const draftId = wrapper.get('[data-testid="template-id"]').text()
      expect(draftId).toContain('draft-')
      expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('发布工作流 (副本)')
      expect(getStepCards(wrapper)).toHaveLength(customTemplate.steps.length)
      expect(wrapper.find(`[data-testid="template-item-${draftId}"]`).exists()).toBe(true)
    })

    it('does not render a copy button on draft templates', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.get('[data-testid="create-template-button"]').trigger('click')
      await flushPromises()

      const draftId = wrapper.get('[data-testid="template-id"]').text()
      expect(wrapper.find(`[data-testid="copy-template-${draftId}"]`).exists()).toBe(false)
    })

    it('does not change the originally selected template when copying another template', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.get('[data-testid="template-item-release-workflow-v1"]').trigger('click')
      await flushPromises()

      const copyBtn = wrapper.find('[data-testid="copy-template-workflow-v1"]')
      await copyBtn.trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="template-id"]').text()).toContain('draft-')
      expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('通用复杂任务工作流 (副本)')
      expect(wrapper.find('[data-testid="template-item-release-workflow-v1"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="template-item-workflow-v1"]').exists()).toBe(true)
    })
  })

  describe('template list reorder', () => {
    it('calls reorderWorkflowTemplates when template is dragged to a new position', async () => {
      reorderWorkflowTemplates.mockResolvedValue({ success: true, data: [] })

      const wrapper = mountView()
      await flushPromises()

      const templateItems = wrapper.findAll('[data-testid^="template-item-"]')
      expect(templateItems).toHaveLength(2)

      // Simulate reorder: move customTemplate (index 1) to index 0
      const templates = wrapper.vm.templates
      const [moved] = templates.splice(1, 1)
      templates.splice(0, 0, moved)

      await wrapper.vm.onTemplateDragEnd({ oldIndex: 1, newIndex: 0 })
      await flushPromises()

      expect(reorderWorkflowTemplates).toHaveBeenCalledTimes(1)
      const calledWith = reorderWorkflowTemplates.mock.calls[0][0]
      expect(calledWith).toHaveLength(2)
      expect(calledWith[0].template_id).toBe('release-workflow-v1')
      expect(calledWith[1].template_id).toBe('workflow-v1')
    })

    it('skips API call when drag does not change position', async () => {
      const wrapper = mountView()
      await flushPromises()

      await wrapper.vm.onTemplateDragEnd({ oldIndex: 0, newIndex: 0 })
      await flushPromises()

      expect(reorderWorkflowTemplates).not.toHaveBeenCalled()
    })

    it('reloads template list when reorder API fails', async () => {
      reorderWorkflowTemplates.mockRejectedValue(new Error('Network error'))

      const wrapper = mountView()
      await flushPromises()

      const templates = wrapper.vm.templates
      const [moved] = templates.splice(1, 1)
      templates.splice(0, 0, moved)

      await wrapper.vm.onTemplateDragEnd({ oldIndex: 1, newIndex: 0 })
      await flushPromises()

      // Should have called getWorkflowTemplates again to reload
      expect(getWorkflowTemplates).toHaveBeenCalledTimes(2)
    })
  })
})
