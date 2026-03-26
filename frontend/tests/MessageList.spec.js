import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '../src/locales'
import MessageList from '../src/components/session/MessageList.vue'

const mountMessageList = (props) => mount(MessageList, {
  props,
  global: {
    plugins: [i18n]
  }
})

describe('MessageList', () => {
  it('renders tool_call events through SessionEventRenderer with the tool tone class', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 1,
          kind: 'tool_call',
          role: 'tool',
          content: 'calling tool',
          payload: { name: 'Edit' },
          timestamp: '2026-03-26T00:00:00.000Z'
        }
      ],
      hasSession: true,
      hasWorkflowNode: false
    })

    expect(wrapper.find('.message-kind-tool_call').exists()).toBe(true)
    expect(wrapper.find('.session-event-renderer').exists()).toBe(true)
    expect(wrapper.find('.tone-tool').exists()).toBe(true)
  })

  it('keeps plain message events in chat bubble layout', () => {
    const wrapper = mountMessageList({
      messages: [
        {
          id: 2,
          kind: 'message',
          role: 'assistant',
          content: 'Hello there',
          timestamp: '2026-03-26T00:00:00.000Z'
        }
      ],
      hasSession: true,
      hasWorkflowNode: false
    })

    expect(wrapper.find('.message-kind-message').exists()).toBe(true)
    expect(wrapper.find('.message-kind-message.message-assistant').exists()).toBe(true)
    expect(wrapper.find('.session-event-renderer').exists()).toBe(false)
    expect(wrapper.text()).toContain('Hello there')
  })
})
