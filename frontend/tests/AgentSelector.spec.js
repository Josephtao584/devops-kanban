import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const mockGetAgents = vi.hoisted(() => vi.fn())
vi.mock('../src/api/agent', () => ({
  getAgents: mockGetAgents
}))

const mockElMessage = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('element-plus', () => ({
  ElMessage: mockElMessage,
  ElDialog: { name: 'ElDialog', template: '<div><slot /></div>' },
  ElButton: { name: 'ElButton', template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>', props: ['type', 'disabled'] },
  ElIcon: { name: 'ElIcon', template: '<span><slot /></span>', props: ['size'] },
  ElEmpty: { name: 'ElEmpty', template: '<div><slot name="description" /></div>', props: ['description'] }
}))

import AgentSelector from '../src/components/AgentSelector.vue'
import i18n from '../src/locales'

function mountComponent(props = {}) {
  return mount(AgentSelector, {
    props: {
      modelValue: true,
      projectId: 1,
      task: { id: 5, title: 'Test task' },
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        'el-dialog': {
          template: '<div class="el-dialog" v-if="modelValue"><slot /><slot name="footer" /></div>',
          props: ['modelValue'],
          emits: ['update:modelValue']
        },
        'el-button': {
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          props: ['type', 'disabled'],
          emits: ['click']
        },
        'el-icon': {
          template: '<span class="el-icon"><slot /></span>',
          props: ['size', 'color']
        },
        'el-empty': {
          template: '<div class="el-empty"><slot name="description" /><p>{{ description }}</p></div>',
          props: ['description']
        },
        Loading: { template: '<span class="loading-icon" />' },
        Check: { template: '<span class="check-icon" />' },
        Monitor: { template: '<span class="monitor-icon" />' },
        User: { template: '<span class="user-icon" />' }
      }
    }
  })
}

describe('AgentSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads agents when dialog is opened', async () => {
    mockGetAgents.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Agent A', executorType: 'CLAUDE_CODE' }]
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()

    expect(mockGetAgents).toHaveBeenCalled()
  })

  it('shows loading state while fetching', async () => {
    mockGetAgents.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
      success: true,
      data: []
    }), 100)))

    const wrapper = mountComponent()
    await nextTick()

    expect(wrapper.find('.loading-container').exists()).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 150))
    await nextTick()
  })

  it('shows empty state when no agents', async () => {
    mockGetAgents.mockResolvedValue({ success: true, data: [] })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    expect(wrapper.find('.empty-state').exists() || wrapper.find('.el-empty').exists()).toBe(true)
  })

  it('auto-selects when only one agent', async () => {
    mockGetAgents.mockResolvedValue({
      success: true,
      data: [{ id: 3, name: 'Only Agent', executorType: 'CLAUDE_CODE' }]
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    expect(wrapper.vm.selectedAgentId).toBe(3)
  })

  it('does not auto-select with multiple agents', async () => {
    mockGetAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Agent A', executorType: 'CLAUDE_CODE' },
        { id: 2, name: 'Agent B', executorType: 'DEFAULT' }
      ]
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    expect(wrapper.vm.selectedAgentId).toBeNull()
  })

  it('emits select when confirmSelect is called', async () => {
    mockGetAgents.mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Agent A', executorType: 'CLAUDE_CODE' },
        { id: 2, name: 'Agent B', executorType: 'DEFAULT' }
      ]
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    wrapper.vm.selectedAgentId = 2
    await nextTick()

    wrapper.vm.confirmSelect()
    await nextTick()

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0][0]).toMatchObject({
      agentId: 2,
      task: { id: 5, title: 'Test task' }
    })
    expect(wrapper.emitted('select')[0][0].agent.name).toBe('Agent B')
  })

  it('confirmSelect does nothing without selection', async () => {
    mockGetAgents.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Agent A', executorType: 'CLAUDE_CODE' }]
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    wrapper.vm.selectedAgentId = null
    wrapper.vm.confirmSelect()

    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('handleClose resets state', async () => {
    mockGetAgents.mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Agent A', executorType: 'CLAUDE_CODE' }]
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    wrapper.vm.handleClose()
    await nextTick()

    expect(wrapper.vm.selectedAgentId).toBeNull()
    expect(wrapper.vm.starting).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })

  it('handles API error gracefully', async () => {
    mockGetAgents.mockResolvedValue({
      success: false,
      message: 'Server error'
    })

    const wrapper = mountComponent()
    await nextTick()
    await nextTick()
    await nextTick()

    expect(wrapper.vm.agents).toEqual([])
  })

  it('skips loading when projectId is null', async () => {
    mockGetAgents.mockResolvedValue({ success: true, data: [] })

    const wrapper = mountComponent({ projectId: null })
    await nextTick()
    await nextTick()

    expect(mockGetAgents).not.toHaveBeenCalled()
  })
})
