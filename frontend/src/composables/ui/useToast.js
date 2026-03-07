import { ElMessage, ElNotification } from 'element-plus'
import { useI18n } from 'vue-i18n'

/**
 * Toast type constants
 */
export const TOAST_TYPES = {
  SUCCESS: 'success',
  WARNING: 'warning',
  INFO: 'info',
  ERROR: 'error'
}

/**
 * Composable for displaying toast messages
 * Provides a consistent interface for showing notifications
 */
export function useToast() {
  const { t } = useI18n()

  /**
   * Show a success toast
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  function success(message, options = {}) {
    ElMessage({
      message,
      type: TOAST_TYPES.SUCCESS,
      duration: 3000,
      ...options
    })
  }

  /**
   * Show a warning toast
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  function warning(message, options = {}) {
    ElMessage({
      message,
      type: TOAST_TYPES.WARNING,
      duration: 4000,
      ...options
    })
  }

  /**
   * Show an info toast
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  function info(message, options = {}) {
    ElMessage({
      message,
      type: TOAST_TYPES.INFO,
      duration: 3000,
      ...options
    })
  }

  /**
   * Show an error toast
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  function error(message, options = {}) {
    ElMessage({
      message,
      type: TOAST_TYPES.ERROR,
      duration: 5000,
      ...options
    })
  }

  /**
   * Show a toast with auto-detected type based on API response
   * @param {Object} response - API response object
   * @param {string} successMessage - Message to show on success
   * @param {string} errorMessage - Message to show on error
   */
  function fromResponse(response, successMessage, errorMessage) {
    if (response?.success) {
      success(successMessage)
    } else {
      error(response?.message || errorMessage)
    }
  }

  /**
   * Show a notification (larger, stays longer)
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   * @param {Object} options - Additional options
   */
  function notify(title, message, type = TOAST_TYPES.INFO, options = {}) {
    ElNotification({
      title,
      message,
      type,
      duration: 4500,
      position: 'top-right',
      ...options
    })
  }

  /**
   * Show an API error with formatted message
   * @param {Error|Object} err - Error object
   * @param {string} fallbackMessage - Fallback message if error doesn't have one
   */
  function apiError(err, fallbackMessage = 'An error occurred') {
    const message = err?.response?.data?.message || err?.message || fallbackMessage
    error(message)
  }

  return {
    success,
    warning,
    info,
    error,
    fromResponse,
    notify,
    apiError,
    TOAST_TYPES
  }
}
