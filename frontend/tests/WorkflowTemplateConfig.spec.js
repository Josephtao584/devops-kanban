import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, inject, provide, ref, toRef } from 'vue'
import { ElMessage } from 'element-plus'
import WorkflowTemplateConfig from '../src/views/WorkflowTemplateConfig.vue'
import i18n from '../src/locales'
import { getWorkflowTemplate, updateWorkflowTemplate } from '../src/api/workflowTemplate'
import { getAgents } from '../src/api/agent'

vi.mock('../src/api/workflowTemplate', () => ({
  getWorkflowTemplate: vi.fn(),
  updateWorkflowTemplate: vi.fn()
}))

vi.mock('../src/api/agent', () => ({
  getAgents: vi.fn()
}))

const TABLE_DATA_KEY = Symbol('table-data')

const ElCardStub = defineComponent({
  name: 'ElCardStub',
  setup(_, { slots }) {
    return () => h('div', { class: 'el-card-stub' }, slots.default?.())
  }
})

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  props: {
    disabled: { type: Boolean, default: false }
  },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () => h('button', {
      disabled: props.disabled,
      onClick: () => emit('click')
    }, slots.default?.())
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
      ? h('textarea', {
        value: props.modelValue,
        placeholder: props.placeholder,
        onInput
      })
      : h('input', {
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

const ElTableStub = defineComponent({
  name: 'ElTableStub',
  props: {
    data: {
      type: Array,
      default: () => []
    }
  },
  setup(props, { slots }) {
    provide(TABLE_DATA_KEY, toRef(props, 'data'))
    return () => h('div', { class: 'el-table-stub' }, slots.default?.())
  }
})

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumnStub',
  props: {
    prop: { type: String, default: '' },
    label: { type: String, default: '' }
  },
  setup(props, { slots }) {
    const rows = inject(TABLE_DATA_KEY, ref([]))

    return () => h('div', { class: 'el-table-column-stub', 'data-label': props.label },
      (rows.value || []).map((row, index) => h('div', {
        class: 'el-table-cell-stub',
        'data-row-index': String(index)
      }, slots.default ? slots.default({ row }) : String(row?.[props.prop] ?? '')))
    )
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function mountView() {
  return mount(WorkflowTemplateConfig, {
    global: {
      plugins: [i18n],
      stubs: {
        'el-card': ElCardStub,
        'el-button': ElButtonStub,
        'el-input': ElInputStub,
        'el-select': ElSelectStub,
        'el-option': ElOptionStub,
        'el-tag': ElTagStub,
        'el-table': ElTableStub,
        'el-table-column': ElTableColumnStub
      }
    }
  })
}

describe('WorkflowTemplateConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
  })

  it('saves step bindings with agentId and without executor.type', async () => {
    getWorkflowTemplate.mockResolvedValue({
      success: true,
      data: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 1,
            executor: { type: 'CODEX' }
          }
        ]
      }
    })

    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Claude Dev', enabled: true },
        { id: 3, name: 'Codex Reviewer', enabled: true }
      ]
    })

    updateWorkflowTemplate.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    const wrapper = mountView()
    await flushPromises()

    const select = wrapper.find('select.el-select-stub')
    await select.setValue('3')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(updateWorkflowTemplate).toHaveBeenCalledTimes(1)
    const savedPayload = updateWorkflowTemplate.mock.calls[0][0]

    expect(savedPayload).toMatchObject({
      template_id: 'dev-workflow-v1',
      steps: [
        {
          id: 'requirement-design',
          agentId: 3
        }
      ]
    })
    expect(savedPayload.steps[0]).not.toHaveProperty('executor')
  })

  it('renders disabled and missing agent bindings clearly', async () => {
    getWorkflowTemplate.mockResolvedValue({
      success: true,
      data: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 2
          },
          {
            id: 'code-review',
            name: '代码审查',
            instructionPrompt: '执行审查。',
            agentId: 999
          }
        ]
      }
    })

    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 2, name: 'Disabled Agent', enabled: false },
        { id: 3, name: 'Enabled Agent', enabled: true }
      ]
    })

    const wrapper = mountView()
    await flushPromises()

    const disabledOption = wrapper.find('option[value="2"]')
    expect(disabledOption.exists()).toBe(true)
    expect(disabledOption.attributes()).toHaveProperty('disabled')
    expect(wrapper.text()).toContain('Disabled Agent (已禁用)')
    expect(wrapper.text()).toContain('缺失成员 (#999)')
  })

  it('treats wrapped template load failure as an error state', async () => {
    getWorkflowTemplate.mockResolvedValue({
      success: false,
      message: '模板加载失败'
    })

    getAgents.mockResolvedValue({
      success: true,
      data: []
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('模板加载失败')
    expect(wrapper.find('.el-table-stub').exists()).toBe(false)
  })

  it('treats wrapped agent load failure as an error toast and empty agent list', async () => {
    getWorkflowTemplate.mockResolvedValue({
      success: true,
      data: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 5
          }
        ]
      }
    })

    getAgents.mockResolvedValue({
      success: false,
      message: '成员接口失败'
    })

    const wrapper = mountView()
    await flushPromises()

    expect(ElMessage.error).toHaveBeenCalledWith('成员接口失败')
    expect(wrapper.text()).toContain('缺失成员 (#5)')
    expect(wrapper.findAll('option').length).toBe(1)
  })

  it('treats wrapped save failure as a save error and does not overwrite local state', async () => {
    getWorkflowTemplate.mockResolvedValue({
      success: true,
      data: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          {
            id: 'requirement-design',
            name: '需求设计',
            instructionPrompt: '先完成需求分析。',
            agentId: 1
          }
        ]
      }
    })

    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Claude Dev', enabled: true },
        { id: 3, name: 'Codex Reviewer', enabled: true }
      ]
    })

    updateWorkflowTemplate.mockResolvedValue({
      success: false,
      message: '保存失败'
    })

    const wrapper = mountView()
    await flushPromises()

    const select = wrapper.find('select.el-select-stub')
    await select.setValue('3')
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(updateWorkflowTemplate).toHaveBeenCalledTimes(1)
    expect(ElMessage.error).toHaveBeenCalledWith('保存失败')
    expect(select.element.value).toBe('3')
  })
})
