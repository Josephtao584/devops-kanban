import { describe, it, expect } from 'vitest'
import { ref, computed } from 'vue'

// Test the filtering logic
describe('Thinking Toggle Filter', () => {
  it('should show all messages when showThinking is true', () => {
    const showThinking = ref(true)
    const messages = ref([
      { id: 1, role: 'user', content: 'Hello', contentType: 'text' },
      { id: 2, role: 'assistant', content: 'Thinking...', contentType: 'thinking' },
      { id: 3, role: 'assistant', content: 'Hi there!', contentType: 'text' }
    ])

    const filteredMessages = computed(() => {
      if (showThinking.value) {
        return messages.value
      }
      return messages.value.filter(msg => msg.contentType !== 'thinking')
    })

    expect(filteredMessages.value.length).toBe(3)
  })

  it('should hide thinking messages when showThinking is false', () => {
    const showThinking = ref(false)
    const messages = ref([
      { id: 1, role: 'user', content: 'Hello', contentType: 'text' },
      { id: 2, role: 'assistant', content: 'Thinking...', contentType: 'thinking' },
      { id: 3, role: 'assistant', content: 'Hi there!', contentType: 'text' }
    ])

    const filteredMessages = computed(() => {
      if (showThinking.value) {
        return messages.value
      }
      return messages.value.filter(msg => msg.contentType !== 'thinking')
    })

    expect(filteredMessages.value.length).toBe(2)
    expect(filteredMessages.value.find(m => m.contentType === 'thinking')).toBeUndefined()
  })

  it('should handle messages without contentType', () => {
    const showThinking = ref(false)
    const messages = ref([
      { id: 1, role: 'user', content: 'Hello' },
      { id: 2, role: 'assistant', content: 'Hi there!' }
    ])

    const filteredMessages = computed(() => {
      if (showThinking.value) {
        return messages.value
      }
      return messages.value.filter(msg => msg.contentType !== 'thinking')
    })

    expect(filteredMessages.value.length).toBe(2)
  })

  it('should toggle visibility when showThinking changes', () => {
    const showThinking = ref(true)
    const messages = ref([
      { id: 1, role: 'user', content: 'Hello', contentType: 'text' },
      { id: 2, role: 'assistant', content: 'Thinking...', contentType: 'thinking' },
      { id: 3, role: 'assistant', content: 'Hi there!', contentType: 'text' }
    ])

    const filteredMessages = computed(() => {
      if (showThinking.value) {
        return messages.value
      }
      return messages.value.filter(msg => msg.contentType !== 'thinking')
    })

    // Initially showing all
    expect(filteredMessages.value.length).toBe(3)

    // Toggle off
    showThinking.value = false
    expect(filteredMessages.value.length).toBe(2)

    // Toggle back on
    showThinking.value = true
    expect(filteredMessages.value.length).toBe(3)
  })
})
