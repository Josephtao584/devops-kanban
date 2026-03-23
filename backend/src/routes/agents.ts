import type { FastifyPluginAsync } from 'fastify';

import { AgentRepository } from '../repositories/agentRepository.js';
import type { CreateAgentBody, UpdateAgentBody, AgentExecutorType } from '../types/dto/agents.js';
import type { IdParams } from '../types/http/params.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getErrorMessage, getStatusCode } from '../utils/http.js';

const SUPPORTED_EXECUTOR_TYPES: AgentExecutorType[] = ['CLAUDE_CODE', 'CODEX', 'OPENCODE'];

type AgentRouteOptions = {
  repo?: Pick<AgentRepository, 'findAll' | 'findById' | 'create' | 'update' | 'delete'>;
};

function createValidationError(message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isObjectRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

function validateExecutorType(value: unknown) {
  if (typeof value !== 'string' || !SUPPORTED_EXECUTOR_TYPES.includes(value as AgentExecutorType)) {
    throw createValidationError(`Unsupported executor type: ${String(value)}`);
  }
}

function validateCommandOverride(value: unknown) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw createValidationError('commandOverride cannot be blank');
  }
}

function validateArgs(value: unknown) {
  if (!isStringArray(value)) {
    throw createValidationError('args must be an array of strings');
  }
}

function validateEnv(value: unknown) {
  if (!isStringRecord(value)) {
    throw createValidationError('env values must be strings');
  }
}

function validateDescription(value: unknown, message: string) {
  if (value !== undefined && typeof value !== 'string') {
    throw createValidationError(message);
  }
}

function validateCreateAgentBody(body: unknown): asserts body is CreateAgentBody {
  if (!isObjectRecord(body)) {
    throw createValidationError('Agent payload must be an object');
  }

  if (typeof body.name !== 'string' || body.name.trim() === '') {
    throw createValidationError('name is required');
  }

  if (body.executorType === undefined) {
    throw createValidationError('executorType is required');
  }
  validateExecutorType(body.executorType);

  validateDescription(body.description, 'description must be a string');

  if (typeof body.role !== 'string' || body.role.trim() === '') {
    throw createValidationError('role is required');
  }

  if (typeof body.enabled !== 'boolean') {
    throw createValidationError('enabled is required');
  }

  if (!isStringArray(body.skills)) {
    throw createValidationError('skills must be an array of strings');
  }

  if (body.args === undefined) {
    throw createValidationError('args is required');
  }
  validateArgs(body.args);

  if (body.env === undefined) {
    throw createValidationError('env is required');
  }
  validateEnv(body.env);

  validateCommandOverride(body.commandOverride);
}

function validateUpdateAgentBody(body: unknown): asserts body is UpdateAgentBody {
  if (!isObjectRecord(body)) {
    throw createValidationError('Agent payload must be an object');
  }

  if ('name' in body && body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
    throw createValidationError('name cannot be blank');
  }

  if ('executorType' in body && body.executorType !== undefined) {
    validateExecutorType(body.executorType);
  }

  if ('description' in body) {
    validateDescription(body.description, 'description must be a string');
  }

  if ('role' in body && body.role !== undefined && (typeof body.role !== 'string' || body.role.trim() === '')) {
    throw createValidationError('role cannot be blank');
  }

  if ('enabled' in body && body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    throw createValidationError('enabled must be a boolean');
  }

  if ('skills' in body && body.skills !== undefined && !isStringArray(body.skills)) {
    throw createValidationError('skills must be an array of strings');
  }

  if ('commandOverride' in body) {
    validateCommandOverride(body.commandOverride);
  }

  if ('args' in body && body.args !== undefined) {
    validateArgs(body.args);
  }

  if ('env' in body && body.env !== undefined) {
    validateEnv(body.env);
  }
}

export const agentRoutes: FastifyPluginAsync<AgentRouteOptions> = async (fastify, { repo = new AgentRepository() } = {}) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await repo.findAll());
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get agents'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const agent = await repo.findById(parseNumber(request.params.id));
      if (!agent) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(agent);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get agent'));
    }
  });

  fastify.post<{ Body: CreateAgentBody }>('/', async (request, reply) => {
    try {
      validateCreateAgentBody(request.body);
      const agent = await repo.create(request.body);
      return successResponse(agent, 'Agent created');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create agent'));
    }
  });

  fastify.put<{ Params: IdParams; Body: UpdateAgentBody }>('/:id', async (request, reply) => {
    try {
      validateUpdateAgentBody(request.body);
      const updated = await repo.update(parseNumber(request.params.id), request.body);
      if (!updated) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(updated, 'Agent updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update agent'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await repo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(null, 'Agent deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete agent'));
    }
  });
};
