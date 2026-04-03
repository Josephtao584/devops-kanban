import type { FastifyPluginAsync } from 'fastify';
import { McpServerService } from '../services/mcpServerService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getErrorMessage, getStatusCode } from '../utils/http.js';
import type { IdParams } from '../types/http/params.js';

const VALID_SERVER_TYPES = ['stdio', 'http'];

type McpServerRouteOptions = {
  mcpServerService?: McpServerService;
};

export const mcpServerRoutes: FastifyPluginAsync<McpServerRouteOptions> = async (
  fastify,
  { mcpServerService = new McpServerService() } = {}
) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await mcpServerService.listMcpServers());
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get MCP servers'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const server = await mcpServerService.getMcpServer(parseNumber(request.params.id));
      if (!server) {
        reply.code(404);
        return errorResponse('MCP server not found');
      }
      return successResponse(server);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get MCP server'));
    }
  });

  fastify.post<{ Body: { name?: string; description?: string; server_type?: string; config?: unknown } }>('/', async (request, reply) => {
    try {
      const { name, description, server_type, config } = request.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        reply.code(400);
        return errorResponse('name is required');
      }

      if (!server_type || !VALID_SERVER_TYPES.includes(server_type)) {
        reply.code(400);
        return errorResponse('server_type must be "stdio" or "http"');
      }

      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        reply.code(400);
        return errorResponse('config is required and must be an object');
      }

      const server = await mcpServerService.createMcpServer({
        name: name.trim(),
        ...(description ? { description } : {}),
        server_type: server_type as 'stdio' | 'http',
        config: config as Record<string, unknown>,
      });
      return successResponse(server, 'MCP server created');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create MCP server'));
    }
  });

  fastify.put<{ Params: IdParams; Body: { name?: string; description?: string; server_type?: string; config?: unknown } }>('/:id', async (request, reply) => {
    try {
      const { name, description, server_type, config } = request.body;

      if (server_type !== undefined && !VALID_SERVER_TYPES.includes(server_type)) {
        reply.code(400);
        return errorResponse('server_type must be "stdio" or "http"');
      }

      if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
        reply.code(400);
        return errorResponse('name cannot be blank');
      }

      const updates: { name?: string; description?: string; server_type?: 'stdio' | 'http'; config?: Record<string, unknown> } = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description;
      if (server_type !== undefined) updates.server_type = server_type as 'stdio' | 'http';
      if (config !== undefined) updates.config = config as Record<string, unknown>;

      const updated = await mcpServerService.updateMcpServer(parseNumber(request.params.id), updates);
      if (!updated) {
        reply.code(404);
        return errorResponse('MCP server not found');
      }
      return successResponse(updated, 'MCP server updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update MCP server'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const deleted = await mcpServerService.deleteMcpServer(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('MCP server not found');
      }
      return successResponse(null, 'MCP server deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete MCP server'));
    }
  });
};
