import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import WorkflowTemplateConfig from '../src/views/WorkflowTemplateConfig.vue'
import i18n from '../src/locales'
import { storeMethods as workflowTemplateStoreMethods } from '../src/stores/workflowTemplateStore'
import { storeMethods as agentStoreMethods } from '../src/stores/agentStore'

const fetchTemplatesMock = workflowTemplateStoreMethods.fetchTemplates
const getWorkflowTemplateByIdMock = workflowTemplateStoreMethods.getWorkflowTemplateById
const updateTemplateMock = workflowTemplateStoreMethods.updateTemplate

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

vi.mock('../src/stores/workflowTemplateStore', () => {
  const storeMethods = {
    fetchTemplates: vi.fn(),
    getWorkflowTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),
    previewPrompt: vi.fn()
  }
  return {
    useWorkflowTemplateStore: vi.fn(() => ({
      loading: { value: false },
      error: { value: null },
      ...storeMethods
    })),
    storeMethods
  }
})

vi.mock('../src/stores/agentStore', () => {
  const agentsRef = ref([])
  const loadingRef = ref(false)
  const errorRef = ref(null)
  const fetchAgentsFn = vi.fn().mockImplementation(async () => ({ success: true, data: [] }))
  const storeMethods = {
    get agents() { return agentsRef.value },
    get loading() { return loadingRef.value },
    get error() { return errorRef.value },
    fetchAgents: fetchAgentsFn,
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    toggleAgentEnabled: vi.fn(),
    clearError: vi.fn(),
    _agentsRef: agentsRef,
    _setAgents(data) { agentsRef.value = data }
  }
  return { useAgentStore: vi.fn(() => storeMethods), storeMethods }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
  await nextTick()
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
    return () => h('div', { class: 'el-tooltip-stub' }, slots.default?.())
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
      ? h('textarea', { ...attrs, value: props.modelValue, placeholder: props.placeholder, onInput })
      : h('input', { ...attrs, value: props.modelValue, placeholder: props.placeholder, onInput })
  }
})

const ElInputNumberStub = defineComponent({
  name: 'ElInputNumberStub',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 20 }
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    const onInput = (event) => {
      const next = Number(event.target.value)
      emit('update:modelValue', Number.isFinite(next) ? next : 0)
    }
    return () => h('input', {
      ...attrs,
      type: 'number',
      class: ['el-input-number-stub', attrs.class],
      value: props.modelValue,
      min: props.min,
      max: props.max,
      onInput
    })
  }
})

const ElSelectStub = defineComponent({
  name: 'ElSelectStub',
  props: {
    modelValue: { type: [Number, String, null], default: null },
    clearable: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit, attrs }) {
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
      ...attrs,
      class: ['el-select-stub', attrs.class],
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
  props: { type: { type: String, default: '' } },
  setup(_, { slots }) {
    return () => h('span', { class: 'el-tag-stub' }, slots.default?.())
  }
})

const threeStepTemplate = {
  template_id: 'release-workflow-v1',
  name: '发布工作流',
  maxLoops: 0,
  steps: [
    { id: 'step-a', name: '步骤A', instructionPrompt: 'A prompt', agentId: 1, onFailureLoopTo: null },
    { id: 'step-b', name: '步骤B', instructionPrompt: 'B prompt', agentId: 1, onFailureLoopTo: null },
    { id: 'step-c', name: '步骤C', instructionPrompt: 'C prompt', agentId: 1, onFailureLoopTo: null }
  ],
  tags: []
}

const defaultTemplate = {
  template_id: 'workflow-v1',
  name: '通用复杂任务工作流',
  maxLoops: 0,
  steps: [
    { id: 'solution-design', name: '方案设计', instructionPrompt: '完成方案设计。', agentId: 1, onFailureLoopTo: null }
  ],
  tags: []
}

function mockTemplateApis(extraTemplate = threeStepTemplate) {
  fetchTemplatesMock.mockResolvedValue({
    success: true,
    data: [defaultTemplate, extraTemplate]
  })

  getWorkflowTemplateByIdMock.mockImplementation(async (templateId) => {
    const template = templateId === defaultTemplate.template_id ? defaultTemplate : extraTemplate
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
        'el-input-number': ElInputNumberStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-tag': ElTagStub,
        'el-checkbox': defineComponent({
          name: 'ElCheckboxStub',
          props: { modelValue: { type: Boolean, default: false } },
          emits: ['update:modelValue', 'change'],
          setup(_, { attrs }) {
            return () => h('input', { type: 'checkbox', class: 'el-checkbox-stub', ...attrs })
          }
        }),
        'el-switch': defineComponent({
          name: 'ElSwitchStub',
          props: { modelValue: { type: Boolean, default: false } },
          emits: ['update:modelValue'],
          setup(props, { emit }) {
            return () => h('span', {
              class: 'el-switch-stub',
              'data-checked': String(props.modelValue),
              onClick: () => emit('update:modelValue', !props.modelValue)
            })
          }
        }),
        'el-form-item': defineComponent({
          name: 'ElFormItemStub',
          props: { label: { type: String, default: '' } },
          setup(props, { slots }) {
            return () => h('div', { class: 'el-form-item-stub', 'data-label': props.label }, [
              h('label', { class: 'el-form-item-label-stub' }, props.label),
              slots.default?.()
            ])
          }
        }),
        'WorkflowTemplateImportDialog': defineComponent({
          name: 'WorkflowTemplateImportDialogStub',
          setup() { return () => h('div') }
        })
      }
    }
  })
}

const selectExtraTemplate = async (wrapper, id = 'release-workflow-v1') => {
  await wrapper.get(`[data-testid="template-item-${id}"]`).trigger('click')
  await flushPromises()
}

describe('WorkflowTemplateConfig loop fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => {})
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue()

    mockTemplateApis()
    const agentsData = [{ id: 1, name: 'Claude Dev', enabled: true }]
    agentStoreMethods.fetchAgents.mockImplementation(async () => {
      agentStoreMethods._setAgents(agentsData)
      return { success: true, data: agentsData }
    })
  })

  it('renders maxLoops input bound to template state', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectExtraTemplate(wrapper)

    const maxLoopsInput = wrapper.find('[data-test="template-max-loops"]')
    expect(maxLoopsInput.exists()).toBe(true)
    expect(Number(maxLoopsInput.element.value)).toBe(0)

    await maxLoopsInput.setValue('3')
    await flushPromises()
    expect(wrapper.vm.template.maxLoops).toBe(3)
  })

  it('onFailureLoopTo dropdown lists only earlier steps for the selected step', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectExtraTemplate(wrapper)

    // Select the third step (index 2)
    const stepCards = wrapper.findAll('.workflow-step-card')
    await stepCards[2].trigger('click')
    await flushPromises()

    const loopSelect = wrapper.find('[data-test="step-on-failure-loop-to"]')
    expect(loopSelect.exists()).toBe(true)

    // Only step-a and step-b should be options (excludes empty option from select stub)
    const optionValues = loopSelect.findAll('option')
      .map((opt) => opt.element.value)
      .filter((value) => value !== '')
    expect(optionValues).toEqual(['step-a', 'step-b'])
  })

  it('warns when onFailureLoopTo is set but maxLoops is 0 on save', async () => {
    updateTemplateMock.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    const wrapper = mountView()
    await flushPromises()
    await selectExtraTemplate(wrapper)

    // Select step 3 (index 2) and set onFailureLoopTo to step-a
    const stepCards = wrapper.findAll('.workflow-step-card')
    await stepCards[2].trigger('click')
    await flushPromises()

    const loopSelect = wrapper.find('[data-test="step-on-failure-loop-to"]')
    await loopSelect.setValue('step-a')
    await flushPromises()

    // maxLoops remains 0; click save → warning confirm dialog should appear
    await wrapper.get('[data-testid="save-template-button"]').trigger('click')
    await flushPromises()

    expect(ElMessageBox.confirm).toHaveBeenCalled()
    const lastCall = ElMessageBox.confirm.mock.calls[ElMessageBox.confirm.mock.calls.length - 1]
    expect(String(lastCall[0])).toContain('最大循环次数')
  })
})
