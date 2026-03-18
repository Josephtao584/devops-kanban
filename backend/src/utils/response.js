/**
 * Response formatting utilities
 */

/**
 * Create a success response
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @returns {object} Success response object
 */
function successResponse(data = null, message = 'Success') {
  return {
    success: true,
    message,
    data,
    error: null,
  };
}

/**
 * Create an error response
 * @param {string} message - Error message
 * @param {any} error - Error details
 * @returns {object} Error response object
 */
function errorResponse(message, error = null) {
  return {
    success: false,
    message,
    data: null,
    error,
  };
}

module.exports = {
  successResponse,
  errorResponse,
};
