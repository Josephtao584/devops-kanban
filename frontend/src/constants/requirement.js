/**
 * Requirement status constants
 */
export const REQUIREMENT_STATUS = {
  NEW: 'NEW',             // 新建
  ANALYZING: 'ANALYZING', // 分析中
  CONVERTED: 'CONVERTED', // 已转换为任务
  ARCHIVED: 'ARCHIVED'    // 已归档
}

/**
 * Requirement priority constants
 */
export const REQUIREMENT_PRIORITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
}

/**
 * Requirement source constants
 */
export const REQUIREMENT_SOURCE = {
  PRODUCT: 'PRODUCT',     // 产品需求
  USER: 'USER',           // 用户反馈
  TECH: 'TECH',           // 技术需求
  BUSINESS: 'BUSINESS',   // 业务需求
  OTHER: 'OTHER'          // 其他
}

/**
 * Requirement priority order for sorting (lower value = higher priority)
 */
export const REQUIREMENT_PRIORITY_ORDER = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2
}

/**
 * Default requirement values
 */
export const REQUIREMENT_DEFAULTS = {
  status: REQUIREMENT_STATUS.NEW,
  priority: REQUIREMENT_PRIORITY.MEDIUM,
  source: REQUIREMENT_SOURCE.OTHER
}

/**
 * Get priority class for styling
 * @param {string} priority - Requirement priority
 * @returns {string} CSS class name
 */
export function getPriorityClass(priority) {
  return `priority-${(priority || REQUIREMENT_PRIORITY.MEDIUM).toLowerCase()}`
}

/**
 * Compare requirements by priority for sorting
 * @param {Object} a - First requirement
 * @param {Object} b - Second requirement
 * @returns {number} Sort order
 */
export function compareByPriority(a, b) {
  const orderA = REQUIREMENT_PRIORITY_ORDER[a.priority] ?? REQUIREMENT_PRIORITY_ORDER.MEDIUM
  const orderB = REQUIREMENT_PRIORITY_ORDER[b.priority] ?? REQUIREMENT_PRIORITY_ORDER.MEDIUM
  return orderA - orderB
}
