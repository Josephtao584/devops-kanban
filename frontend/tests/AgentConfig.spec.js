import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AgentConfig from '../src/views/AgentConfig.vue'
import i18n from '../src/locales'

const mockAgentStore = vi.hoisted(() => ({
  agents: [],
  loading: false,
  error: null,
  fetchAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  toggleAgentEnabled: vi.fn()
}))

const mockSkillStore = vi.hoisted(() => ({
  skills: [],
  fetchSkills: vi.fn()
}))

const mockMcpServerStore = vi.hoisted(() => ({
  mcpServers: [],
  fetchMcpServers: vi.fn()
}))

vi.mock('../src/stores/agentStore', () => ({
  useAgentStore: () => mockAgentStore
}))

vi.mock('../src/stores/skillStore', () => ({
  useSkillStore: () => mockSkillStore
}))

vi.mock('../src/stores/mcpServerStore', () => ({
  useMcpServerStore: () => mockMcpServerStore
}))


const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('AgentConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgentStore.loading = false
    mockAgentStore.error = null
    mockAgentStore.agents = [
      {
        id: 1,
        name: '架构师 - 老王',
        executorType: 'CLAUDE_CODE',
        role: 'BACKEND_DEV',
        description: 'desc',
        enabled: true,
        skills: [1]
      }
    ]
    mockAgentStore.fetchAgents.mockResolvedValue({ success: true, data: mockAgentStore.agents })
    mockAgentStore.updateAgent.mockResolvedValue({ success: true, data: mockAgentStore.agents[0] })
    mockSkillStore.skills = [
      { id: 1, identifier: 'brainstorming', name: '头脑风暴' },
      { id: 2, identifier: 'systematic-debugging', name: '系统调试' }
    ]
    mockSkillStore.fetchSkills.mockResolvedValue({ success: true, data: mockSkillStore.skills })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  async function openEditModal(wrapper) {
    await wrapper.find('.agent-list-item').trigger('click')
    await flushPromises()
    await wrapper.find('.header-actions .btn').trigger('click')
    await flushPromises()
  }

  function mountView() {
    return mount(AgentConfig, {
      global: {
        plugins: [i18n]
      }
    })
  }

  it('loads managed skills for agent editing', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(mockSkillStore.fetchSkills).toHaveBeenCalledTimes(1)
    await wrapper.find('.agent-list-item').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('头脑风暴')
  })

  it('shows existing skills selector instead of freeform input', async () => {
    const wrapper = mountView()
    await flushPromises()
    await openEditModal(wrapper)

    expect(wrapper.text()).toContain('选择已有技能')
    expect(wrapper.find('.skill-select').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('推荐技能')
  })

  it('adds only managed skills to agent payload', async () => {
    const wrapper = mountView()
    await flushPromises()
    await openEditModal(wrapper)

    const select = wrapper.find('.skill-select')
    await select.setValue(2) // select skill id 2 (systematic-debugging)
    await wrapper.find('.skills-editor .btn').trigger('click')
    await wrapper.get('[data-testid="agent-form"]').trigger('submit')
    await flushPromises()

    expect(mockAgentStore.updateAgent).toHaveBeenCalled()
    const payload = mockAgentStore.updateAgent.mock.calls[0][1]
    expect(payload.skills).toEqual([1, 2])
  })

  it('preserves unknown skills from existing agent data when editing', async () => {
    mockAgentStore.agents = [
      {
        id: 1,
        name: '架构师 - 老王',
        executorType: 'CLAUDE_CODE',
        role: 'BACKEND_DEV',
        description: 'desc',
        enabled: true,
        skills: [1, 999]
      }
    ]
    mockAgentStore.fetchAgents.mockResolvedValue({ success: true, data: mockAgentStore.agents })
    mockAgentStore.updateAgent.mockResolvedValue({ success: true, data: mockAgentStore.agents[0] })

    const wrapper = mountView()
    await flushPromises()
    await openEditModal(wrapper)

    expect(wrapper.text()).toContain('头脑风暴')
    // id 999 is not in skillStore, so it won't appear
    expect(wrapper.text()).not.toContain('999')

    await wrapper.get('[data-testid="agent-form"]').trigger('submit')
    await flushPromises()

    const payload = mockAgentStore.updateAgent.mock.calls[0][1]
    expect(payload.skills).toEqual([1, 999])
  })
})
