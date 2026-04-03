import type { FastifyPluginAsync } from 'fastify';

import { AgentRepository } from '../repositories/agentRepository.js';
import { SkillRepository } from '../repositories/skillRepository.js';
import { McpServerRepository } from '../repositories/mcpServerRepository.js';
import type { CreateAgentBody, UpdateAgentBody, AgentExecutorType } from '../types/dto/agents.js';
import type { IdParams } from '../types/http/params.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getErrorMessage, getStatusCode } from '../utils/http.js';

type AgentRouteOptions = {
  repo?: Pick<AgentRepository, 'findAll' | 'findById' | 'create' | 'update' | 'delete'>;
  skillRepo?: Pick<SkillRepository, 'findAll'>;
  mcpServerRepo?: Pick<McpServerRepository, 'findAll'>;
};

function createValidationError(message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 400;
  return error;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
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

  validateDescription(body.description, 'description must be a string');

  if (typeof body.role !== 'string' || body.role.trim() === '') {
    throw createValidationError('role is required');
  }

  if (typeof body.enabled !== 'boolean') {
    throw createValidationError('enabled is required');
  }

  if (!isNumberArray(body.skills)) {
    throw createValidationError('skills must be an array of numbers');
  }

  if (body.mcpServers !== undefined && !isNumberArray(body.mcpServers)) {
    throw createValidationError('mcpServers must be an array of numbers');
  }

  // Default mcpServers to empty array if not provided
  if (body.mcpServers === undefined) {
    body.mcpServers = [];
  }
}

function validateUpdateAgentBody(body: unknown): asserts body is UpdateAgentBody {
  if (!isObjectRecord(body)) {
    throw createValidationError('Agent payload must be an object');
  }

  if ('name' in body && body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
    throw createValidationError('name cannot be blank');
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

  if ('skills' in body && body.skills !== undefined && !isNumberArray(body.skills)) {
    throw createValidationError('skills must be an array of numbers');
  }

  if ('mcpServers' in body && body.mcpServers !== undefined && !isNumberArray(body.mcpServers)) {
    throw createValidationError('mcpServers must be an array of numbers');
  }
}

async function validateExistingSkills(skillRepo: Pick<SkillRepository, 'findAll'>, skills: number[]) {
  const existingSkills = await skillRepo.findAll();
  const validSkillIds = new Set(existingSkills.map(skill => skill.id));
  const invalidSkills = skills.filter(skillId => !validSkillIds.has(skillId));
  if (invalidSkills.length > 0) {
    throw createValidationError(`Unknown skills: ${invalidSkills.join(', ')}`);
  }
}

async function validateExistingMcpServers(mcpServerRepo: Pick<McpServerRepository, 'findAll'>, mcpServers: number[]) {
  const existingServers = await mcpServerRepo.findAll();
  const validServerIds = new Set(existingServers.map(server => server.id));
  const invalidServers = mcpServers.filter(serverId => !validServerIds.has(serverId));
  if (invalidServers.length > 0) {
    throw createValidationError(`Unknown MCP servers: ${invalidServers.join(', ')}`);
  }
}

export const agentRoutes: FastifyPluginAsync<AgentRouteOptions> = async (fastify, { repo = new AgentRepository(), skillRepo = new SkillRepository(), mcpServerRepo = new McpServerRepository() } = {}) => {
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
      await validateExistingSkills(skillRepo, request.body.skills);
      if (request.body.mcpServers !== undefined && request.body.mcpServers.length > 0) {
        await validateExistingMcpServers(mcpServerRepo, request.body.mcpServers);
      }
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
      if (request.body.skills !== undefined) {
        await validateExistingSkills(skillRepo, request.body.skills);
      }
      if (request.body.mcpServers !== undefined) {
        await validateExistingMcpServers(mcpServerRepo, request.body.mcpServers);
      }
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
