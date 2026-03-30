import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

import StepSessionPanel from '../src/components/workflow/StepSessionPanel.vue'

const loadInitial = vi.fn()
const startPolling = vi.fn()
const stopPolling = vi.fn()
const getSessionMock = vi.fn()
const continueSessionMock = vi.fn()
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

vi.mock('../src/api/session.js', () => ({
  getSession: (...args) => getSessionMock(...args),
  continueSession: (...args) => continueSessionMock(...args)
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
    getSessionMock.mockResolvedValue({ data: { status: 'RUNNING' } })
    continueSessionMock.mockResolvedValue({ success: true })
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

  it('shows the default header with the step title and no raw session numbering', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.panel-header').exists()).toBe(true)
    expect(wrapper.find('.panel-title').text()).toBe('代码开发')
    expect(wrapper.text()).not.toContain('Session #102')
  })

  it('shows the composer when the session can receive input', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.panel-input-shell').exists()).toBe(true)
    expect(wrapper.find('input').attributes('placeholder')).toContain('继续追问')
  })

  it('renders the plan summary when session messages include step markers', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 1, hasMore: false })
    eventsRef.value = [
      { id: 1, seq: 1, kind: 'message', role: 'assistant', content: '[STEP 1] 分析需求', payload: {} }
    ]

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.plan-summary').exists()).toBe(true)
    expect(wrapper.find('.current-step-hint').text()).toBe('分析需求')
  })

  it('shows the plan empty state when the session has no step markers', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 1, hasMore: false })
    eventsRef.value = [
      { id: 1, seq: 1, kind: 'message', role: 'assistant', content: '普通对话内容', payload: {} }
    ]

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.plan-summary').exists()).toBe(false)
    expect(wrapper.find('.plan-empty-text').text()).toBe('暂无计划')
  })

  it('updates the rendered plan summary when new step events arrive', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 1, hasMore: false })
    eventsRef.value = [
      { id: 1, seq: 1, kind: 'message', role: 'assistant', content: '[STEP 1] 第一步', payload: {} }
    ]

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.current-step-hint').text()).toBe('第一步')

    eventsRef.value = [
      ...eventsRef.value,
      { id: 2, seq: 2, kind: 'message', role: 'assistant', content: '[STEP 2] 第二步', payload: {} }
    ]

    await flushPromises()

    expect(wrapper.find('.current-step-hint').text()).toBe('第二步')
    await wrapper.find('.plan-toggle').trigger('click')
    expect(wrapper.findAll('.plan-step')).toHaveLength(2)
    expect(wrapper.find('.plan-step--running .step-title').text()).toBe('第二步')
  })

  it('shows a read-only hint when the session cannot receive input', async () => {
    getSessionMock.mockResolvedValue({ data: { status: 'PENDING' } })
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.panel-input-shell').exists()).toBe(false)
    expect(wrapper.find('.panel-readonly-hint').exists()).toBe(true)
  })

  it('renders the session history inside a chat-thread container', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码审查'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.step-session-panel').classes()).toContain('step-session-panel--chat')
    expect(wrapper.find('.panel-events').classes()).toContain('panel-events--chat')
  })

  it('keeps the chat-thread container when header is hidden', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 1, hasMore: false })
    eventsRef.value = [
      { id: 1, seq: 1, kind: 'message', role: 'assistant', content: 'hello', payload: {} }
    ]

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码审查',
        showHeader: false
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.panel-header').exists()).toBe(false)
    expect(wrapper.find('.step-session-panel').classes()).toContain('step-session-panel--no-header')
    expect(wrapper.find('.panel-events--chat').exists()).toBe(true)
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
    expect(wrapper.find('.panel-header').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂无会话记录')
  })

  it('hides the header when showHeader is false while keeping content state visible', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 0, hasMore: false })
    eventsRef.value = []

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发',
        showHeader: false
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.panel-header').exists()).toBe(false)
    expect(wrapper.find('.panel-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂无事件')
  })

  it('uses a softer system label for fallback tool names', async () => {
    const { default: Renderer } = await import('../src/components/session/SessionEventRenderer.vue')
    const wrapper = mount(Renderer, {
      props: {
        event: {
          id: 7,
          kind: 'tool_call',
          role: 'tool',
          content: 'call tool',
          payload: {}
        }
      }
    })

    expect(wrapper.text()).not.toContain('tool_call')
  })

  it('uses localized status copy instead of raw completed text', async () => {
    const { default: Renderer } = await import('../src/components/session/SessionEventRenderer.vue')
    const wrapper = mount(Renderer, {
      props: {
        event: {
          id: 8,
          kind: 'status',
          role: 'system',
          content: 'completed'
        }
      }
    })

    expect(wrapper.text()).not.toContain('completed')
  })

  it('keeps visual focus on the conversation stream', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.step-session-panel--chat').exists()).toBe(true)
    expect(wrapper.find('.panel-events--chat').exists()).toBe(true)
  })

  it('keeps metadata subordinate to the conversation title', async () => {
    loadInitial.mockResolvedValue({ events: [], lastSeq: 2, hasMore: false })

    const wrapper = mount(StepSessionPanel, {
      props: {
        sessionId: 102,
        stepName: '代码开发'
      },
      global: {
        stubs: {
          SessionEventRenderer: SessionEventRendererStub
        }
      }
    })

    await flushPromises()

    expect(wrapper.find('.panel-title').text()).toBe('代码开发')
  })
})
