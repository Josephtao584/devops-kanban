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
    disabled: { type: Boolean, default: false },
    type: { type: String, default: '' }
  },
  emits: ['click'],
  setup(props, { slots, emit, attrs }) {
    return () => h('button', {
      ...attrs,
      disabled: props.disabled,
      'data-type': props.type,
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

  it('renders workflow preview and focused step editor instead of nested edit dialogs', async () => {
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
    expect(wrapper.find('.step-editor-section').exists()).toBe(true)
    expect(wrapper.find('.step-editor-card').exists()).toBe(true)
    expect(wrapper.findAll('.el-dialog-stub')).toHaveLength(1)
    expect(wrapper.find('.workflow-start-editor-step-name').text()).toBe('需求设计')
  })

  it('switches the focused step when a preview card is clicked', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    expect(wrapper.find('.step-editor-card__title').text()).toBe('需求设计')
    await wrapper.findAll('.workflow-start-editor-step')[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('.step-editor-card__title').text()).toBe('代码开发')
  })

  it('updates agent selection directly in the focused step editor', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const select = wrapper.find('.el-select-stub')
    await select.setValue('2')
    await flushPromises()

    expect(wrapper.find('.workflow-chip').text()).toContain('开发工程师 - 小李')
  })

  it('updates prompt directly in the focused step editor and includes it in the confirm payload', async () => {
    getAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: '架构师 - 老王', enabled: true, executorType: 'CLAUDE_CODE' },
        { id: 2, name: '开发工程师 - 小李', enabled: true, executorType: 'CLAUDE_CODE' }
      ]
    })

    const wrapper = mountDialog()
    await flushPromises()

    const textarea = wrapper.find('textarea')
    await textarea.setValue('更新后的提示词内容。')
    await flushPromises()

    expect(wrapper.find('.workflow-start-editor-prompt-text').text()).toContain('更新后的提示词内容。')

    await wrapper.find('button[data-type="primary"]').trigger('click')

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
