import { computed } from 'vue'

/**
 * Composable for unified status style mapping
 * Eliminates duplicate status class definitions across components
 */
export function useStatusStyle() {
  const statusMap = {
    'TODO': 'status-todo',
    'IN_PROGRESS': 'status-in-progress',
    'DONE': 'status-done',
    'BLOCKED': 'status-blocked',
    'REQUIREMENT': 'status-requirement'
  }

  const statusColors = {
    'TODO': { bg: 'var(--todo-soft)', color: 'var(--todo-strong)' },
    'IN_PROGRESS': { bg: 'var(--in-progress-soft)', color: 'var(--in-progress-strong)' },
    'DONE': { bg: 'var(--done-soft)', color: 'var(--done-strong)' },
    'BLOCKED': { bg: 'var(--el-color-danger-light-9)', color: 'var(--el-color-danger)' },
    'REQUIREMENT': { bg: 'var(--accent-color-soft)', color: 'var(--accent-color)' }
  }

  /**
   * Get CSS class for a status
   * @param {String} status - Status value
   * @returns {String} CSS class name
   */
  function getStatusClass(status) {
    return statusMap[status] || 'status-unknown'
  }

  /**
   * Get status color configuration
   * @param {String} status - Status value
   * @returns {Object} { bg, color } color config
   */
  function getStatusColor(status) {
    return statusColors[status] || { bg: 'var(--el-fill-color)', color: 'var(--el-text-color-placeholder)' }
  }

  /**
   * Get status border color for task cards
   * @param {String} status - Status value
   * @returns {String} CSS color value
   */
  function getStatusBorderColor(status) {
    const colorMap = {
      'TODO': 'var(--todo-strong)',
      'IN_PROGRESS': 'var(--in-progress-strong)',
      'DONE': 'var(--done-strong)',
      'BLOCKED': '#ef4444',
      'REQUIREMENT': 'var(--accent-color)'
    }
    return colorMap[status] || 'var(--accent-color)'
  }

  /**
   * Get status background gradient for task cards
   * @param {String} status - Status value
   * @returns {String} CSS gradient value
   */
  function getStatusBackground(status) {
    const gradientMap = {
      'TODO': 'linear-gradient(135deg, #ffffff 0%, var(--yellow-accent-mid) 100%)',
      'IN_PROGRESS': 'linear-gradient(135deg, #ffffff 0%, var(--teal-accent-mid) 100%)',
      'DONE': 'linear-gradient(135deg, #ffffff 0%, var(--teal-accent-strong) 100%)',
      'BLOCKED': 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
      'REQUIREMENT': 'linear-gradient(135deg, #ffffff 0%, var(--teal-accent-weak) 100%)'
    }
    return gradientMap[status] || 'linear-gradient(135deg, #ffffff 0%, var(--teal-accent-weak) 100%)'
  }

  return {
    statusMap,
    statusColors,
    getStatusClass,
    getStatusColor,
    getStatusBorderColor,
    getStatusBackground
  }
}

export default useStatusStyle
