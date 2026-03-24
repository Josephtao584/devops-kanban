import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { ElMessage } from 'element-plus'

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

const ElTableStub = defineComponent({
  name: 'ElTableStub',
  props: {
    data: { type: Array, default: () => [] }
  },
  setup(props, { slots }) {
    return () => h('div', { class: 'el-table-stub', 'data-row-count': String(props.data.length) }, slots.default?.())
  }
})

const ElTableColumnStub = defineComponent({
  name: 'ElTableColumnStub',
  props: {
    prop: { type: String, default: '' },
    label: { type: String, default: '' }
  },
  setup(_, { slots }) {
    return () => h('div', { class: 'el-table-column-stub' }, slots.default?.({ row: {} }))
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const clickButtonByText = async (wrapper, text, occurrence = 0) => {
  const matches = wrapper.findAll('button').filter((node) => node.text() === text)
  expect(matches.length).toBeGreaterThan(occurrence)
  await matches[occurrence].trigger('click')
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

describe('WorkflowStartEditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
  })

  it('renders workflow-style step flow instead of a table shell', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.find('.workflow-start-editor-flow').exists()).toBe(true)
    expect(wrapper.findAll('.workflow-start-editor-step')).toHaveLength(2)
    expect(wrapper.find('.workflow-start-editor-step-name').text()).toBe('需求设计')
    expect(wrapper.find('.el-table-stub').exists()).toBe(false)
  })

  it('renders compact summary cards with separate edit actions', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog({
      draftTemplate: {
        template_id: 'dev-workflow-v1',
        name: '默认研发工作流',
        steps: [
          { id: 'step-1', name: '需求设计', instructionPrompt: '先完成需求分析。', agentId: 1 },
          { id: 'step-2', name: '代码开发', instructionPrompt: '完成代码开发。', agentId: 2 },
          { id: 'step-3', name: '测试', instructionPrompt: '执行测试。', agentId: 1 },
          { id: 'step-4', name: '代码审查', instructionPrompt: '执行代码审查。', agentId: 2 }
        ]
      }
    })
    await flushPromises()

    expect(wrapper.findAll('.workflow-start-editor-step')).toHaveLength(4)
    expect(wrapper.find('.workflow-start-editor-step-summary').exists()).toBe(true)
    expect(wrapper.findAll('.workflow-start-editor-edit-role')).toHaveLength(4)
    expect(wrapper.findAll('.workflow-start-editor-edit-prompt')).toHaveLength(4)
    expect(wrapper.find('.workflow-start-editor-inline-editor').exists()).toBe(false)
    expect(wrapper.find('.workflow-start-editor-prompt-text').text()).toContain('先完成需求分析。')
  })

  it('opens a nested role dialog and updates the step summary after confirmation', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(1)
    expect(wrapper.findAll('.workflow-start-editor-inline-editor')).toHaveLength(0)

    await wrapper.findAll('.workflow-start-editor-edit-role')[0].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(2)
    expect(wrapper.findAll('.workflow-start-editor-inline-editor')).toHaveLength(1)
    expect(wrapper.find('.workflow-start-editor-inline-label').text()).toBe('需求设计')

    const select = wrapper.find('.el-select-stub')
    await select.setValue('2')
    await flushPromises()
    await clickButtonByText(wrapper, '确认')
    await flushPromises()

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(1)
    expect(wrapper.findAll('.workflow-start-editor-inline-editor')).toHaveLength(0)
    expect(wrapper.findAll('.workflow-start-editor-summary-value')[0].text()).toContain('开发工程师 - 小李')
  })

  it('opens a nested prompt dialog and includes the edited prompt in the confirm payload', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.findAll('.workflow-start-editor-edit-prompt')[0].trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(2)
    expect(wrapper.findAll('.workflow-start-editor-inline-editor')).toHaveLength(1)

    const textarea = wrapper.find('textarea')
    await textarea.setValue('更新后的提示词内容。')
    await flushPromises()
    await clickButtonByText(wrapper, '确认')
    await flushPromises()

    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(1)
    expect(wrapper.find('.workflow-start-editor-prompt-text').text()).toContain('更新后的提示词内容。')

    await clickButtonByText(wrapper, '确认并启动')

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
})
