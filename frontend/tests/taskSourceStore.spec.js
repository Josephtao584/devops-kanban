import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskSourceStore } from '../src/stores/taskSourceStore'
import * as taskSourceApi from '../src/api/taskSource'

vi.mock('../src/api/taskSource', async () => {
  const actual = await vi.importActual('../src/api/taskSource')
  return {
    ...actual,
    getAvailableTaskSourceTypes: vi.fn()
  }
})

describe('taskSourceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads available task source types from the backend', async () => {
    taskSourceApi.getAvailableTaskSourceTypes.mockResolvedValue({
      success: true,
      data: [
        { key: 'REQUIREMENT', name: '需求池', description: 'desc', config: {} },
        { key: 'TICKET', name: '工单系统', description: 'desc', config: {} }
      ]
    })

    const store = useTaskSourceStore()
    const result = await store.loadAvailableTypes()

    expect(taskSourceApi.getAvailableTaskSourceTypes).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      { key: 'REQUIREMENT', name: '需求池', description: 'desc', config: {} },
      { key: 'TICKET', name: '工单系统', description: 'desc', config: {} }
    ])
    expect(store.availableTypes).toEqual(result)
  })

  it('normalizes task source types returned as an object map', async () => {
    taskSourceApi.getAvailableTaskSourceTypes.mockResolvedValue({
      success: true,
      data: {
        REQUIREMENT: { name: '需求池', description: 'desc', config: {} },
        TICKET: { key: 'CUSTOM_TICKET', name: '工单系统', description: 'desc', config: {} }
      }
    })

    const store = useTaskSourceStore()
    const result = await store.loadAvailableTypes()

    expect(result).toEqual([
      { key: 'REQUIREMENT', name: '需求池', description: 'desc', config: {} },
      { key: 'CUSTOM_TICKET', name: '工单系统', description: 'desc', config: {} }
    ])
    expect(store.availableTypes).toEqual(result)
  })
})
