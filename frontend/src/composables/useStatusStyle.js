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
    'TODO': { bg: 'var(--el-color-info-light-9)', color: 'var(--el-color-info)' },
    'IN_PROGRESS': { bg: 'var(--el-color-warning-light-9)', color: 'var(--el-color-warning)' },
    'DONE': { bg: 'var(--el-color-success-light-9)', color: 'var(--el-color-success)' },
    'BLOCKED': { bg: 'var(--el-color-danger-light-9)', color: 'var(--el-color-danger)' },
    'REQUIREMENT': { bg: 'var(--el-color-primary-light-9)', color: 'var(--el-color-primary)' }
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
      'TODO': '#6b7280',
      'IN_PROGRESS': '#3b82f6',
      'DONE': '#10b981',
      'BLOCKED': '#ef4444',
      'REQUIREMENT': 'var(--el-color-primary)'
    }
    return colorMap[status] || '#94a3b8'
  }

  /**
   * Get status background gradient for task cards
   * @param {String} status - Status value
   * @returns {String} CSS gradient value
   */
  function getStatusBackground(status) {
    const gradientMap = {
      'TODO': 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
      'IN_PROGRESS': 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
      'DONE': 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)',
      'BLOCKED': 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
      'REQUIREMENT': 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
    }
    return gradientMap[status] || 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
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
