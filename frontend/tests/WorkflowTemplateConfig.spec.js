import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, inject, nextTick, provide, ref, toRef } from 'vue'
import { ElMessage } from 'element-plus'
import WorkflowTemplateConfig from '../src/views/WorkflowTemplateConfig.vue'
import i18n from '../src/locales'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  getWorkflowTemplates,
  updateWorkflowTemplate
} from '../src/api/workflowTemplate'
import { getAgents } from '../src/api/agent'

vi.mock('../src/api/workflowTemplate', () => ({
  createWorkflowTemplate: vi.fn(),
  deleteWorkflowTemplate: vi.fn(),
  getWorkflowTemplateById: vi.fn(),
  getWorkflowTemplates: vi.fn(),
  updateWorkflowTemplate: vi.fn()
}))

vi.mock('../src/api/agent', () => ({
  getAgents: vi.fn()
}))

const TABLE_DATA_KEY = Symbol('table-data')

const defaultTemplate = {
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
      id: 'testing',
      name: '测试',
      instructionPrompt: '执行测试。',
      agentId: null
    }
  ]
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
  ]
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
    type: { type: String, default: '' }
  },
  emits: ['click'],
  setup(props, { slots, attrs, emit }) {
    return () => h('button', {
      ...attrs,
      class: ['el-button-stub', attrs.class],
      disabled: props.disabled,
      'data-type': props.type,
      onClick: () => emit('click')
    }, slots.default?.())
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
    expect(getWorkflowTemplateById).toHaveBeenCalledWith('dev-workflow-v1')
    expect(wrapper.text()).toContain('默认研发工作流')
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

  it('creates a custom template from the selected template and selects it', async () => {
    createWorkflowTemplate.mockImplementation(async (payload) => ({
      success: true,
      data: payload
    }))

    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      if (templateId === 'bugfix-flow-v1') {
        return {
          success: true,
          data: {
            template_id: 'bugfix-flow-v1',
            name: 'Bugfix Flow',
            steps: defaultTemplate.steps.map((step) => ({ ...step }))
          }
        }
      }

      const template = templateId === defaultTemplate.template_id ? defaultTemplate : customTemplate
      return {
        success: true,
        data: JSON.parse(JSON.stringify(template))
      }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="create-template-id-input"]').setValue('bugfix-flow-v1')
    await wrapper.get('[data-testid="create-template-name-input"]').setValue('Bugfix Flow')
    await wrapper.get('[data-testid="create-template-button"]').trigger('click')
    await flushPromises()

    expect(createWorkflowTemplate).toHaveBeenCalledTimes(1)
    expect(createWorkflowTemplate).toHaveBeenCalledWith({
      template_id: 'bugfix-flow-v1',
      name: 'Bugfix Flow',
      steps: [
        {
          id: 'requirement-design',
          name: '需求设计',
          instructionPrompt: '先完成需求分析。',
          agentId: 1
        },
        {
          id: 'testing',
          name: '测试',
          instructionPrompt: '执行测试。',
          agentId: null
        }
      ]
    })
    expect(getWorkflowTemplateById).toHaveBeenLastCalledWith('bugfix-flow-v1')
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('bugfix-flow-v1')
    expect(wrapper.get('[data-testid="template-name-input"]').element.value).toBe('Bugfix Flow')
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

    const select = wrapper.find('select.el-select-stub')
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

    const disabledOption = wrapper.find('option[value="2"]')
    expect(disabledOption.exists()).toBe(true)
    expect(disabledOption.attributes()).toHaveProperty('disabled')
    expect(wrapper.text()).toContain('Disabled Agent (已禁用)')
    expect(wrapper.text()).toContain('缺失成员 (#999)')
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
      if (templateId === 'dev-workflow-v1') {
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

  it('keeps create success when follow-up detail reload fails', async () => {
    createWorkflowTemplate.mockResolvedValue({
      success: true,
      data: {
        template_id: 'bugfix-flow-v1',
        name: 'Bugfix Flow',
        steps: defaultTemplate.steps.map((step) => ({ ...step }))
      }
    })

    getWorkflowTemplateById.mockImplementation(async (templateId) => {
      if (templateId === 'bugfix-flow-v1') {
        throw new Error('detail reload failed')
      }

      const template = templateId === defaultTemplate.template_id ? defaultTemplate : customTemplate
      return {
        success: true,
        data: JSON.parse(JSON.stringify(template))
      }
    })

    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="create-template-id-input"]').setValue('bugfix-flow-v1')
    await wrapper.get('[data-testid="create-template-name-input"]').setValue('Bugfix Flow')
    await wrapper.get('[data-testid="create-template-button"]').trigger('click')
    await flushPromises()

    expect(createWorkflowTemplate).toHaveBeenCalledTimes(1)
    expect(ElMessage.success).toHaveBeenCalledWith('工作流模板已创建')
    expect(ElMessage.error).toHaveBeenCalledWith('detail reload failed')
    expect(wrapper.text()).toContain('Bugfix Flow')
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('bugfix-flow-v1')
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
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('dev-workflow-v1')
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
    expect(getWorkflowTemplateById).toHaveBeenLastCalledWith('dev-workflow-v1')
    expect(wrapper.get('[data-testid="template-id"]').text()).toContain('dev-workflow-v1')
    expect(wrapper.find('[data-testid="template-item-release-workflow-v1"]').exists()).toBe(false)
  })
})
