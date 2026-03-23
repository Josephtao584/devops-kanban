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

  function createResponseError(response, fallbackMessage = defaultMessage) {
    return new Error(response?.message || response?.error || fallbackMessage)
  }

  /**
   * Handle API error
   * @param {Error} error - The error object
   * @param {String} customMessage - Optional custom message to display
   * @returns {String} The error message
   */
  function handleError(error, customMessage = null) {
    const message = error?.message || error?.toString() || defaultMessage
    const displayMessage = customMessage || message

    if (showMessage) {
      toast.error(displayMessage)
    }

    if (onError) {
      onError(error, displayMessage)
    }

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
  function handleResponse(response, { successMessage = null, onSuccess = null, onError: customOnError = null } = {}) {
    if (!response) {
      const error = new Error('无响应')
      customOnError ? customOnError(error) : handleError(error)
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
    }

    const responseError = createResponseError(response)
    customOnError ? customOnError(responseError) : handleError(responseError)
    return false
  }

  /**
   * Return response.data or throw normalized error
   * @param {Object} response - API response object
   * @param {String} fallbackMessage - Fallback message when response is invalid
   * @returns {*} response.data
   */
  function unwrapResponse(response, fallbackMessage = defaultMessage) {
    if (response?.success) {
      return response.data
    }

    const error = createResponseError(response, fallbackMessage)
    if (showMessage) {
      handleError(error)
    } else {
      if (onError) {
        onError(error, error.message)
      }
      console.error('[API Error]', error)
    }
    throw error
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
    createResponseError,
    handleError,
    handleResponse,
    unwrapResponse,
    withErrorHandling,
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
