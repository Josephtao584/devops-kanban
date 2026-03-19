import { ElMessage } from 'element-plus'

/**
 * Toast notification composable wrapping Element Plus ElMessage
 */
export function useToast() {
  /**
   * Show success message
   * @param {string} message - Success message
   */
  function success(message) {
    ElMessage.success(message)
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  function error(message) {
    ElMessage.error(message)
  }

  /**
   * Show warning message
   * @param {string} message - Warning message
   */
  function warning(message) {
    ElMessage.warning(message)
  }

  /**
   * Show info message
   * @param {string} message - Info message
   */
  function info(message) {
    ElMessage.info(message)
  }

  /**
   * Handle API error and show error message
   * @param {Error|Object} error - Error object or API response
   * @param {string} defaultMessage - Default message if error message is unclear
   * @returns {string} Error message
   */
  function apiError(error, defaultMessage = '操作失败') {
    let message = defaultMessage

    if (error) {
      // Handle axios error format
      if (error.response?.data?.message) {
        message = error.response.data.message
      } else if (error.response?.data?.error) {
        message = error.response.data.error
      } else if (error.message) {
        message = error.message
      } else if (typeof error === 'string') {
        message = error
      }
    }

    ElMessage.error(message)
    return message
  }

  /**
   * Show notification
   * @param {string} message - Message
   * @param {string} type - Message type: success, error, warning, info
   */
  function notify(message, type = 'info') {
    ElMessage({
      message,
      type
    })
  }

  /**
   * Handle API response with success/error handling
   * @param {Object} response - API response
   * @param {string} successMessage - Success message to show
   * @returns {boolean} True if response was successful
   */
  function fromResponse(response, successMessage) {
    if (response?.success) {
      if (successMessage) {
        ElMessage.success(successMessage)
      }
      return true
    } else {
      const message = response?.message || response?.error || '操作失败'
      ElMessage.error(message)
      return false
    }
  }

  return {
    success,
    error,
    warning,
    info,
    notify,
    apiError,
    fromResponse
  }
}

export default useToast
