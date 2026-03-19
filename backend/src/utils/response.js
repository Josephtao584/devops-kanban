export function successResponse(data = null, message = 'Success') {
  return { success: true, message, data, error: null };
}

export function errorResponse(message, error = null) {
  return { success: false, message, data: null, error };
}
