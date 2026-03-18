import { useToast } from './ui/useToast'

/**
 * Unified API error handler composable.
 * Provides consistent error handling patterns across all stores and components.
 * Built on top of useToast for message display.
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onError - Custom error callback
 * @param {Boolean} options.showMessage - Whether to show error message automatically (default: true)
 * @param {String} options.defaultMessage - Default error message when error is unclear
 *
 * @returns {Object} Error handling utilities
 */
export function useApiErrorHandler(options = {}) {
  const {
    onError = null,
    showMessage = true,
    defaultMessage = '操作失败，请稍后重试'
  } = options

  const toast = useToast()

  /**
   * Handle API error
   * @param {Error} error - The error object
   * @param {String} customMessage - Optional custom message to display
   * @returns {String} The error message
   */
  function handleError(error, customMessage = null) {
    const message = error?.message || error?.toString() || defaultMessage
    const displayMessage = customMessage || message

    // Show error message
    if (showMessage) {
      toast.error(displayMessage)
    }

    // Call custom error callback if provided
    if (onError) {
      onError(error, displayMessage)
    }

    // Log error for debugging
    console.error('[API Error]', error)

    return displayMessage
  }

  /**
   * Handle API response with error checking
   * @param {Object} response - API response object
   * @param {String} successMessage - Optional success message to show
   * @param {Function} onSuccess - Optional success callback
   * @param {Function} onError - Optional error callback (overrides default)
   * @returns {Boolean} True if response is successful
   */
  function handleResponse(response, { successMessage = null, onSuccess = null, onError = null } = {}) {
    if (!response) {
      const error = new Error('无响应')
      const errorMsg = onError ? onError(error) : handleError(error)
      console.error('Empty response:', errorMsg)
      return false
    }

    if (response.success) {
      if (successMessage) {
        toast.success(successMessage)
      }
      if (onSuccess) {
        onSuccess(response.data)
      }
      return true
    } else {
      const errorMsg = onError ? onError(new Error(response.message || response.error)) : handleError(new Error(response.message || response.error))
      return false
    }
  }

  /**
   * Wrap async function with error handling
   * @param {Function} asyncFn - Async function to wrap
   * @param {String} errorMessage - Error message to show on failure
   * @returns {Promise} Wrapped promise
   */
  async function withErrorHandling(asyncFn, errorMessage) {
    try {
      return await asyncFn()
    } catch (error) {
      handleError(error, errorMessage)
      throw error
    }
  }

  return {
    handleError,
    handleResponse,
    withErrorHandling,
    // Re-export toast methods for convenience
    success: toast.success,
    warning: toast.warning,
    info: toast.info,
    error: toast.error,
    notify: toast.notify
  }
}

/**
 * Simplified error handler for quick use in components/stores.
 * Wrapper around useToast with standardized API error handling.
 */
export function useApiError() {
  const toast = useToast()

  /**
   * API error handler that shows appropriate messages
   * @param {Error} error - The error object
   * @param {String} defaultMessage - Default message if error message is unclear
   */
  function apiError(error, defaultMessage = '操作失败') {
    return toast.apiError(error, defaultMessage)
  }

  return {
    apiError,
    success: toast.success,
    warning: toast.warning,
    info: toast.info,
    error: toast.error,
    handleResponse: toast.fromResponse
  }
}

export default useApiErrorHandler
