import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import StepSessionPanel from '../src/components/workflow/StepSessionPanel.vue'

const loadInitial = vi.fn()
const startPolling = vi.fn()
const stopPolling = vi.fn()
const eventsRef = ref([])
const isLoadingRef = ref(false)
const errorRef = ref(null)
const lastSeqRef = ref(0)
const isPollingRef = ref(false)

vi.mock('../src/composables/useSessionEvents.js', () => ({
  useSessionEvents: () => ({
    events: eventsRef,
    lastSeq: lastSeqRef,
    isLoading: isLoadingRef,
    isPolling: isPollingRef,
    error: errorRef,
    loadInitial: (...args) => loadInitial(...args),
    startPolling: (...args) => startPolling(...args),
    stopPolling: (...args) => stopPolling(...args)
  })
}))

const SessionEventRendererStub = defineComponent({
  name: 'SessionEventRenderer',
  props: {
    event: { type: Object, required: true }
  },
  setup(props) {
    return () => h('div', {
      class: 'session-event-renderer-stub',
      'data-kind': props.event.kind,
      'data-seq': String(props.event.seq)
    }, props.event.content)
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('StepSessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventsRef.value = [
      { id: 1, seq: 1, kind: 'message', role: 'assistant', content: 'hello', payload: {} },
      { id: 2, seq: 2, kind: 'stream_chunk', role: 'assistant', content: 'chunk', payload: { stream: 'stdout' } }
    ]
    lastSeqRef.value = 2
    isLoadingRef.value = false
    isPollingRef.value = false
    errorRef.value = null
  })

  afterEach(() => {
    stopPolling.mockClear()
  })

  it('loads session history and starts polling while the session is running', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        sessionStatus: 'RUNNING',
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(loadInitial).toHaveBeenCalledWith(102)
    expect(startPolling).toHaveBeenCalledTimes(1)
    expect(startPolling.mock.calls[0][0]).toBe(102)
    expect(typeof startPolling.mock.calls[0][1]).toBe('function')
    expect(wrapper.findAll('.session-event-renderer-stub')).toHaveLength(2)
  })

  it('stops polling and shows empty state when no session id is provided', async () => {
    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: null,
        sessionStatus: 'PENDING',
        stepName: '测试'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(loadInitial).not.toHaveBeenCalled()
    expect(startPolling).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('暂无会话记录')
  })
})
