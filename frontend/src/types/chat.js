/**
 * Message role constants for chat-style interface
 */
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system'
}

/**
 * Content type constants for streaming messages
 */
export const ContentType = {
  TEXT: 'text',
  THINKING: 'thinking',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  PERMISSION_DENIED: 'permission_denied'
}

/**
 * Create a new message object
 * @param {string} role - Message role (user, assistant, system)
 * @param {string} content - Message content
 * @param {string} contentType - Content type (text, thinking, tool_use, tool_result, permission_denied)
 * @param {Object} options - Additional options for tool messages
 * @returns {Object} Message object
 */
export function createMessage(role, content, contentType = 'text', options = {}) {
  const message = {
    id: options.id || Date.now() + Math.random(),
    role,
    content,
    contentType,
    timestamp: options.timestamp || Date.now()
  }

  // Message tree structure (Claude CLI JSONL format)
  if (options.uuid) {
    message.uuid = options.uuid
  }
  if (options.parentUuid) {
    message.parentUuid = options.parentUuid
  }

  // Tool use fields
  if (contentType === ContentType.TOOL_USE) {
    message.toolCallId = options.toolCallId
    message.toolName = options.toolName
    message.toolInput = options.toolInput
  }

  // Tool result fields
  if (contentType === ContentType.TOOL_RESULT) {
    message.toolUseId = options.toolUseId
    message.toolIsError = options.toolIsError || false
  }

  // Permission denied fields
  if (contentType === ContentType.PERMISSION_DENIED) {
    message.resource = options.resource
    message.reason = options.reason
  }

  return message
}
