import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAgentStore } from '../src/stores/agentStore'

const mockAgentApi = vi.hoisted(() => ({
  getAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn()
}))

vi.mock('../src/api/agent', () => ({ ...mockAgentApi }))

describe('agentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchAgents', () => {
    it('loads agents from API', async () => {
      mockAgentApi.getAgents.mockResolvedValue({
        success: true,
        data: [
          { id: 1, name: 'Claude', executorType: 'claude-code', enabled: true },
          { id: 2, name: 'Codex', executorType: 'codex', enabled: false }
        ]
      })

      const store = useAgentStore()
      await store.fetchAgents()

      expect(mockAgentApi.getAgents).toHaveBeenCalledTimes(1)
      expect(store.agents).toHaveLength(2)
    })
  })

  describe('createAgent', () => {
    it('creates agent via API', async () => {
      mockAgentApi.createAgent.mockResolvedValue({
        success: true,
        data: { id: 3, name: 'New Agent', executorType: 'claude-code' }
      })

      const store = useAgentStore()
      await store.createAgent({ name: 'New Agent', executorType: 'claude-code' })

      expect(mockAgentApi.createAgent).toHaveBeenCalledWith({ name: 'New Agent', executorType: 'claude-code' })
      expect(store.agents).toHaveLength(1)
    })
  })

  describe('updateAgent', () => {
    it('updates agent via API', async () => {
      mockAgentApi.getAgents.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Agent', executorType: 'claude-code', enabled: true, skills: '[]' }]
      })
      mockAgentApi.updateAgent.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Updated Agent', executorType: 'claude-code', enabled: true }
      })

      const store = useAgentStore()
      await store.fetchAgents()
      await store.updateAgent(1, { name: 'Updated Agent' })

      expect(mockAgentApi.updateAgent).toHaveBeenCalledWith(1, { name: 'Updated Agent' })
    })
  })

  describe('deleteAgent', () => {
    it('deletes agent via API', async () => {
      mockAgentApi.getAgents.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Agent' }]
      })
      mockAgentApi.deleteAgent.mockResolvedValue({ success: true })

      const store = useAgentStore()
      await store.fetchAgents()
      await store.deleteAgent(1)

      expect(mockAgentApi.deleteAgent).toHaveBeenCalledWith(1)
      expect(store.agents).toHaveLength(0)
    })
  })

  describe('toggleAgentEnabled', () => {
    it('toggles agent enabled state', async () => {
      mockAgentApi.getAgents.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Agent', enabled: true, skills: '[]' }]
      })
      mockAgentApi.updateAgent.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Agent', enabled: false, skills: [] }
      })

      const store = useAgentStore()
      await store.fetchAgents()
      await store.toggleAgentEnabled(1)

      expect(mockAgentApi.updateAgent).toHaveBeenCalledWith(1, expect.objectContaining({ enabled: false }))
    })

    it('handles skills as array', async () => {
      mockAgentApi.getAgents.mockResolvedValue({
        success: true,
        data: [{ id: 1, name: 'Agent', enabled: false, skills: ['skill-a'] }]
      })
      mockAgentApi.updateAgent.mockResolvedValue({
        success: true,
        data: { id: 1, name: 'Agent', enabled: true }
      })

      const store = useAgentStore()
      await store.fetchAgents()
      await store.toggleAgentEnabled(1)

      expect(mockAgentApi.updateAgent).toHaveBeenCalledWith(1, expect.objectContaining({
        enabled: true,
        skills: ['skill-a']
      }))
    })
  })

  describe('clearError', () => {
    it('resets error state', () => {
      const store = useAgentStore()
      store.error = 'Test error'
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})
