export function successResponse<T>(data: T | null = null, message = 'Success') {
  return { success: true as const, message, data, error: null };
}

export function errorResponse(message: string, error: unknown = null) {
  return { success: false as const, message, data: null, error };
}
