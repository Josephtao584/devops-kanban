import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import api from '../src/api/index.js'
import * as sessionApi from '../src/api/session.js'

let getSessionEventsSpy

describe('session api helpers', () => {
  it('requests session event history with afterSeq and limit params', async () => {
    const seen = []
    const interceptor = api.interceptors.request.use((config) => {
      seen.push({
        url: config.url,
        method: config.method,
        params: config.params
      })
      return Promise.reject(new Error('stop request'))
    })

    try {
      await expect(sessionApi.getSessionEvents(7, { afterSeq: 12, limit: 50 })).rejects.toThrow('stop request')
    } finally {
      api.interceptors.request.eject(interceptor)
    }

    expect(seen).toEqual([
      {
        url: '/sessions/7/events',
        method: 'get',
        params: {
          after_seq: 12,
          limit: 50
        }
      }
    ])
  })
})

describe('useSessionEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getSessionEventsSpy = vi.spyOn(sessionApi, 'getSessionEvents')
  })

  afterEach(() => {
    getSessionEventsSpy?.mockRestore()
    vi.useRealTimers()
  })

  it('loads initial history and appends incremental events with last_seq', async () => {
    getSessionEventsSpy
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [{ id: 1, seq: 1, kind: 'message', role: 'assistant', content: 'hello', payload: {} }],
          last_seq: 1,
          has_more: false
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [{ id: 2, seq: 2, kind: 'status', role: 'system', content: 'RUNNING', payload: { from: 'PENDING', to: 'RUNNING' } }],
          last_seq: 2,
          has_more: false
        }
      })

    const { useSessionEvents } = await import('../src/composables/useSessionEvents.js')
    const sessionEvents = useSessionEvents({ pollIntervalMs: 1000 })

    await sessionEvents.loadInitial(7)
    sessionEvents.startPolling(7, () => false)
    await vi.advanceTimersByTimeAsync(1000)

    expect(getSessionEventsSpy).toHaveBeenNthCalledWith(1, 7, { afterSeq: 0 })
    expect(getSessionEventsSpy).toHaveBeenNthCalledWith(2, 7, { afterSeq: 1 })
    expect(sessionEvents.events.value.map((event) => event.seq)).toEqual([1, 2])
    expect(sessionEvents.lastSeq.value).toBe(2)
  })

  it('loads all initial pages until has_more becomes false', async () => {
    getSessionEventsSpy
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [{ id: 1, seq: 1, kind: 'message', role: 'assistant', content: 'hello', payload: {} }],
          last_seq: 1,
          has_more: true
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [{ id: 2, seq: 2, kind: 'message', role: 'assistant', content: 'world', payload: {} }],
          last_seq: 2,
          has_more: false
        }
      })

    const { useSessionEvents } = await import('../src/composables/useSessionEvents.js')
    const sessionEvents = useSessionEvents({ pollIntervalMs: 1000 })

    await sessionEvents.loadInitial(7)

    expect(getSessionEventsSpy).toHaveBeenNthCalledWith(1, 7, { afterSeq: 0 })
    expect(getSessionEventsSpy).toHaveBeenNthCalledWith(2, 7, { afterSeq: 1 })
    expect(sessionEvents.events.value.map((event) => event.seq)).toEqual([1, 2])
    expect(sessionEvents.lastSeq.value).toBe(2)
  })

  it('ignores stale loadInitial results when switching sessions quickly', async () => {
    let resolveFirst
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve
    })

    getSessionEventsSpy
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [{ id: 2, seq: 2, kind: 'message', role: 'assistant', content: 'new', payload: {} }],
          last_seq: 2,
          has_more: false
        }
      })

    const { useSessionEvents } = await import('../src/composables/useSessionEvents.js')
    const sessionEvents = useSessionEvents({ pollIntervalMs: 1000 })

    const firstLoad = sessionEvents.loadInitial(101)
    const secondLoad = sessionEvents.loadInitial(102)
    await secondLoad

    resolveFirst({
      success: true,
      data: {
        events: [{ id: 1, seq: 1, kind: 'message', role: 'assistant', content: 'old', payload: {} }],
        last_seq: 1,
        has_more: false
      }
    })
    await firstLoad

    expect(sessionEvents.events.value.map((event) => event.seq)).toEqual([2])
    expect(sessionEvents.lastSeq.value).toBe(2)
  })

  it('stops polling when the session becomes terminal', async () => {
    getSessionEventsSpy
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [],
          last_seq: 0,
          has_more: false
        }
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          events: [],
          last_seq: 0,
          has_more: false
        }
      })

    const { useSessionEvents } = await import('../src/composables/useSessionEvents.js')
    const sessionEvents = useSessionEvents({ pollIntervalMs: 1000 })
    let terminal = false

    await sessionEvents.loadInitial(7)
    sessionEvents.startPolling(7, () => terminal)
    await vi.advanceTimersByTimeAsync(1000)
    terminal = true
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(getSessionEventsSpy).toHaveBeenCalledTimes(2)
    expect(sessionEvents.isPolling.value).toBe(false)
  })
})
