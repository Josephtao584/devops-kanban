import { ref } from 'vue'

/**
 * Composable for filtering initial prompt from messages
 */
export function useMessageFilter() {
  const initialPrompt = ref(null)
  const initialPromptFiltered = ref(false)

  /**
   * Set the initial prompt to filter
   */
  function setInitialPrompt(prompt) {
    initialPrompt.value = prompt
    initialPromptFiltered.value = false
  }

  /**
   * Check if content is the initial prompt (should be filtered out)
   */
  function isInitialPrompt(content) {
    if (!initialPrompt.value) return false
    if (initialPromptFiltered.value) return false

    const normalizedContent = content.trim()
    const normalizedPrompt = initialPrompt.value.trim()

    // Exact match or content starts with the full prompt
    if (normalizedContent === normalizedPrompt || normalizedContent.startsWith(normalizedPrompt)) {
      return true
    }

    // Check if content starts with the first line of prompt (for chunked messages)
    const promptFirstLine = initialPrompt.value.split('\n')[0]?.trim()
    if (promptFirstLine && normalizedContent.startsWith(promptFirstLine)) {
      return true
    }

    return false
  }

  /**
   * Check if content should be filtered
   */
  function shouldFilterContent(content) {
    if (!isInitialPrompt(content)) return false

    // Mark as filtered after detecting initial prompt
    initialPromptFiltered.value = true
    return true
  }

  /**
   * Get content with initial prompt removed (for partial filtering)
   */
  function getContentWithoutInitialPrompt(content) {
    if (!initialPrompt.value) return content
    if (!isInitialPrompt(content)) return content

    // Mark as filtered
    initialPromptFiltered.value = true

    const normalizedContent = content.trim()
    const normalizedPrompt = initialPrompt.value.trim()

    // Remove full prompt prefix
    if (normalizedContent.startsWith(normalizedPrompt)) {
      const rest = normalizedContent.slice(normalizedPrompt.length).trim()
      return rest
    }

    // Remove first line prefix (for chunked messages)
    const promptFirstLine = initialPrompt.value.split('\n')[0]?.trim()
    if (promptFirstLine && normalizedContent.startsWith(promptFirstLine)) {
      const rest = normalizedContent.slice(promptFirstLine.length).trim()
      return rest
    }

    return content
  }

  /**
   * Reset filter state
   */
  function resetFilter() {
    initialPrompt.value = null
    initialPromptFiltered.value = false
  }

  return {
    // State
    initialPrompt,
    initialPromptFiltered,
    // Actions
    setInitialPrompt,
    shouldFilterContent,
    getContentWithoutInitialPrompt,
    resetFilter
  }
}