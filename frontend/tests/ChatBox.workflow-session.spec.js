import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'

const fetchActiveSession = vi.fn()
const createManagedSession = vi.fn()
const deleteManagedSession = vi.fn()
const startExistingSession = vi.fn()
const stopExistingSession = vi.fn()
const continueManagedSession = vi.fn()
const sendManagedInput = vi.fn()
const refreshManagedSession = vi.fn()
const connectWebSocket = vi.fn()
const disconnectWebSocket = vi.fn()
const wsSendInput = vi.fn()
const getSession = vi.fn()
const getSessionHistory = vi.fn()
const getSessionOutput = vi.fn()

const sessionRef = ref(null)
const isStartingRef = ref(false)
const isStoppingRef = ref(false)
const isConnectedRef = ref(false)
const isServiceConnectedRef = ref(false)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key, fallback) => fallback || key
  })
}))

vi.mock('../src/composables/useSessionManager', () => ({
  useSessionManager: () => ({
    session: sessionRef,
    isStarting: isStartingRef,
    isStopping: isStoppingRef,
    setSession: (value) => {
      sessionRef.value = value
    },
    loadActiveSession: (...args) => fetchActiveSession(...args),
    createSession: (...args) => createManagedSession(...args),
    deleteSession: (...args) => deleteManagedSession(...args),
    startSession: (...args) => startExistingSession(...args),
    stopSession: (...args) => stopExistingSession(...args),
    continueSession: (...args) => continueManagedSession(...args),
    sendInput: (...args) => sendManagedInput(...args),
    refreshSession: (...args) => refreshManagedSession(...args)
  })
}))

vi.mock('../src/composables/useWebSocketConnection', () => ({
  useWebSocketConnection: () => ({
    isConnected: isConnectedRef,
    connect: (...args) => connectWebSocket(...args),
    disconnect: (...args) => disconnectWebSocket(...args),
    sendInput: (...args) => wsSendInput(...args),
    isServiceConnected: isServiceConnectedRef
  })
}))

vi.mock('../src/api/session', () => ({
  getSession: (...args) => getSession(...args),
  getSessionHistory: (...args) => getSessionHistory(...args),
  getSessionOutput: (...args) => getSessionOutput(...args)
}))

const SessionHeaderStub = defineComponent({
  name: 'SessionHeader',
  props: {
    sessionId: [String, Number]
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: 'session-header-stub',
      'data-session-id': String(props.sessionId ?? '')
    }, slots.actions?.())
  }
})

const SessionControlsStub = defineComponent({
  name: 'SessionControls',
  setup() {
    return () => h('div', { class: 'session-controls-stub' })
  }
})

const MessageListStub = defineComponent({
  name: 'MessageList',
  props: {
    messages: { type: Array, default: () => [] }
  },
  setup(props) {
    return () => h('div', { class: 'message-list-stub', 'data-count': String(props.messages.length) })
  }
})

const MessageInputStub = defineComponent({
  name: 'MessageInput',
  setup() {
    return () => h('div', { class: 'message-input-stub' })
  }
})

const DevToolsStub = defineComponent({
  name: 'DevTools',
  props: {
    session: { type: Object, default: null }
  },
  setup(props) {
    return () => h('div', {
      class: 'dev-tools-stub',
      'data-session-id': String(props.session?.id ?? '')
    })
  }
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

const createWorkflowNode = (sessionId) => ({
  id: `step-${sessionId}`,
  name: `Step ${sessionId}`,
  sessionId,
  status: 'IN_PROGRESS',
  role: 'developer',
  agentType: 'Monitor',
  agentName: 'Dev Agent'
})

describe('ChatBox workflow session switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionRef.value = null
    isStartingRef.value = false
    isStoppingRef.value = false
    isConnectedRef.value = false
    isServiceConnectedRef.value = false

    fetchActiveSession.mockResolvedValue(null)
    getSessionHistory.mockResolvedValue({ success: true, data: [] })
    getSessionOutput.mockResolvedValue({ success: true, data: '' })
    getSession.mockImplementation(async (id) => ({
      success: true,
      data: {
        id,
        taskId: 1,
        status: 'STOPPED',
        output: '',
        messages: [],
        initialPrompt: '',
        claudeSessionId: `claude-${id}`
      }
    }))
  })

  it('loads workflow session when workflow node session changes', async () => {
    const ChatBox = (await import('../src/components/ChatBox.vue')).default
    const wrapper = mount(ChatBox, {
      props: {
        task: { id: 1, title: 'task title' },
        agentId: 2,
        workflowNode: createWorkflowNode(101)
      },
      global: {
        mocks: {
          $t: (key, fallback) => fallback || key
        },
        stubs: {
          DevTools: DevToolsStub,
          SessionHeader: SessionHeaderStub,
          SessionControls: SessionControlsStub,
          MessageList: MessageListStub,
          MessageInput: MessageInputStub,
          'el-icon': true
        }
      }
    })

    await flushPromises()

    expect(getSession).toHaveBeenCalledWith(101)
    expect(sessionRef.value?.id).toBe(101)
    expect(wrapper.find('.session-header-stub').attributes('data-session-id')).toBe('claude-101')

    await wrapper.setProps({ workflowNode: createWorkflowNode(102) })
    await flushPromises()

    expect(getSession).toHaveBeenCalledWith(102)
    expect(sessionRef.value?.id).toBe(102)
    expect(wrapper.find('.session-header-stub').attributes('data-session-id')).toBe('claude-102')
  })
})
