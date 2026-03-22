export function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

export function getStatusCode(error: unknown, fallback = 500) {
  if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  return fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
