import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

type FastifyErrorWithStatus = Error & {
  statusCode?: number;
  status?: number;
  code?: string;
  validation?: unknown;
};

const STATUS_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '未授权访问',
  403: '禁止访问',
  404: '资源未找到',
  409: '资源冲突',
  500: '服务内部错误',
};

function getChineseMessage(statusCode: number): string {
  return STATUS_MESSAGES[statusCode] || '服务内部错误';
}

function getErrorCode(statusCode: number): string {
  return `HTTP_${statusCode}`;
}

export default async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyErrorWithStatus, request: FastifyRequest, reply: FastifyReply) => {
    // AppError — structured error with user/internal messages
    if (error instanceof AppError) {
      const logContext = {
        code: error.code,
        statusCode: error.statusCode,
        url: request.url,
        method: request.method,
        ...error.context,
      };
      if (error.statusCode >= 500) {
        request.log.error({ ...logContext, internalMessage: error.internalMessage });
      } else {
        request.log.warn({ ...logContext, internalMessage: error.internalMessage });
      }

      return reply.code(error.statusCode).send({
        success: false,
        message: error.userMessage,
        code: error.code,
        data: null,
        error: error.userMessage,
      });
    }

    // Fastify validation error
    if (error.validation) {
      request.log.warn({ url: request.url, method: request.method, validation: error.validation });
      return reply.code(400).send({
        success: false,
        message: '请求参数验证失败',
        code: 'VALIDATION_ERROR',
        errors: error.validation,
        data: null,
      });
    }

    // Fastify route not found error
    if (error.code === 'FWR_NOT_FOUND') {
      return reply.code(404).send({
        success: false,
        message: '资源未找到',
        code: 'NOT_FOUND',
        error: error.message,
        data: null,
      });
    }

    // Legacy errors (plain Error with statusCode)
    const statusCode = error.statusCode || error.status || 500;
    const isServerError = statusCode >= 500;

    if (isServerError) {
      request.log.error({ url: request.url, method: request.method, err: error });
    } else {
      request.log.warn({ url: request.url, method: request.method, err: error });
    }

    const userMessage = getChineseMessage(statusCode);
    const errorCode = getErrorCode(statusCode);

    return reply.code(statusCode).send({
      success: false,
      message: userMessage,
      code: errorCode,
      data: null,
      error: isServerError ? userMessage : error.message,
    });
  });

  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({
      success: false,
      message: '资源未找到',
      code: 'NOT_FOUND',
      error: `${request.method} ${request.url}`,
      data: null,
    });
  });
}
