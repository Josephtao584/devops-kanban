import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowRunPolling } from '../src/composables/kanban/useWorkflowRunPolling'

describe('useWorkflowRunPolling', () => {
  let fetchFn, isTerminal

  beforeEach(() => {
    vi.useFakeTimers()
    fetchFn = vi.fn().mockResolvedValue(undefined)
    isTerminal = vi.fn().mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fetchFn immediately on startPolling', async () => {
    const { startPolling, stopPolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    await startPolling()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    stopPolling()
  })

  it('sets isPolling to true when started', async () => {
    const { startPolling, isPolling, stopPolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    await startPolling()
    expect(isPolling.value).toBe(true)
    stopPolling()
  })

  it('stopPolling clears interval and sets isPolling false', async () => {
    const { startPolling, stopPolling, isPolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    await startPolling()
    expect(isPolling.value).toBe(true)

    stopPolling()
    expect(isPolling.value).toBe(false)

    vi.advanceTimersByTime(3000)
    expect(fetchFn).toHaveBeenCalledTimes(1) // only initial call
  })

  it('togglePolling(false) stops active polling', async () => {
    const { startPolling, togglePolling, isPolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    await startPolling()
    expect(isPolling.value).toBe(true)

    togglePolling(false)
    expect(isPolling.value).toBe(false)
  })

  it('does not start when pollingEnabled is false', async () => {
    const { startPolling, togglePolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    togglePolling(false)

    await startPolling()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('calls fetchFn again on interval tick', async () => {
    const { startPolling, stopPolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    await startPolling()
    expect(fetchFn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchFn).toHaveBeenCalledTimes(2)

    stopPolling()
  })

  it('stops when isTerminal returns true after fetch', async () => {
    const { startPolling, stopPolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    await startPolling()

    // Mark as terminal
    isTerminal.mockReturnValue(true)
    vi.advanceTimersByTime(1000)
    await vi.advanceTimersByTimeAsync(0)

    // After terminal detected, no more calls
    const callsAfterTerminal = fetchFn.mock.calls.length
    vi.advanceTimersByTime(3000)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchFn).toHaveBeenCalledTimes(callsAfterTerminal)
    stopPolling()
  })

  it('togglePolling(true) allows subsequent startPolling', async () => {
    const { startPolling, togglePolling } = useWorkflowRunPolling({ fetchFn, isTerminal, interval: 1000 })
    togglePolling(false)
    await startPolling()
    expect(fetchFn).not.toHaveBeenCalled()

    togglePolling(true)
    await startPolling()
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
