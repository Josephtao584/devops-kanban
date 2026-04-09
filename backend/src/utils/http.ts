import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

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
  if (error instanceof AppError) {
    return error.userMessage;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function logError(error: unknown, request: FastifyRequest) {
  if (error instanceof AppError) {
    const logFn = error.statusCode >= 500 ? request.log.error.bind(request.log) : request.log.warn.bind(request.log);
    logFn({
      code: error.code,
      statusCode: error.statusCode,
      url: request.url,
      method: request.method,
      internalMessage: error.internalMessage,
      ...error.context,
    });
  } else {
    request.log.error({ url: request.url, method: request.method, err: error });
  }
}
