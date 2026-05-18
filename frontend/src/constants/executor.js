/**
 * Executor type constants and display labels.
 * Keep this in sync with backend `ExecutorType` enum (backend/src/types/executors.ts).
 */
export const EXECUTOR_TYPES = {
  CLAUDE_CODE: 'CLAUDE_CODE',
  OPEN_CODE: 'OPEN_CODE'
}

export const EXECUTOR_LABEL = {
  [EXECUTOR_TYPES.CLAUDE_CODE]: 'Claude Code',
  [EXECUTOR_TYPES.OPEN_CODE]: 'OpenCode'
}

/**
 * Get the display label for an executor type. Falls back to the raw type
 * string when unknown so newly added types still surface something sensible
 * before the label map is updated.
 */
export function getExecutorLabel(executorType) {
  if (!executorType) return ''
  return EXECUTOR_LABEL[executorType] || executorType
}
