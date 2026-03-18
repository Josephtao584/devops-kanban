/**
 * Task status constants
 */
export const TASK_STATUS = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE'
}

/**
 * Task priority constants
 */
export const TASK_PRIORITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
}

/**
 * Task category constants
 */
export const TASK_CATEGORY = {
  FEATURE: 'FEATURE',
  BUG_FIX: 'BUG_FIX',
  REFACTORING: 'REFACTORING',
  DOCUMENTATION: 'DOCUMENTATION',
  TESTING: 'TESTING',
  DESIGN: 'DESIGN'
}

/**
 * Task priority order for sorting (lower value = higher priority)
 */
export const TASK_PRIORITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
}

/**
 * Default task values
 */
export const TASK_DEFAULTS = {
  status: TASK_STATUS.TODO,
  priority: TASK_PRIORITY.MEDIUM
}

/**
 * Get priority class for styling
 * @param {string} priority - Task priority
 * @returns {string} CSS class name
 */
export function getPriorityClass(priority) {
  return `priority-${(priority || TASK_PRIORITY.MEDIUM).toLowerCase()}`
}

/**
 * Compare tasks by priority for sorting
 * @param {Object} a - First task
 * @param {Object} b - Second task
 * @returns {number} Sort order
 */
export function compareByPriority(a, b) {
  const orderA = TASK_PRIORITY_ORDER[a.priority] ?? TASK_PRIORITY_ORDER.MEDIUM
  const orderB = TASK_PRIORITY_ORDER[b.priority] ?? TASK_PRIORITY_ORDER.MEDIUM
  return orderA - orderB
}
