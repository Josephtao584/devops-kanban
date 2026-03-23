import type { FastifyPluginAsync } from 'fastify';

import { WorkflowTemplateService } from '../services/workflow/workflowTemplateService.js';
import type { UpdateWorkflowTemplateInput } from '../types/dto/workflowTemplates.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode } from '../utils/http.js';

type WorkflowTemplateRouteOptions = { service?: WorkflowTemplateService };

const workflowTemplateRoutes: FastifyPluginAsync<WorkflowTemplateRouteOptions> = async (fastify, { service = new WorkflowTemplateService() } = {}) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await service.getTemplates());
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get workflow templates'));
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const template = await service.getTemplateById(request.params.id);
      if (!template) {
        reply.code(404);
        return errorResponse(`Workflow template not found: ${request.params.id}`);
      }
      return successResponse(template);
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get workflow template'));
    }
  });

  fastify.put<{ Body: UpdateWorkflowTemplateInput }>('/', async (request, reply) => {
    try {
      const template = await service.updateTemplate(request.body);
      return successResponse(template, 'Workflow template updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update workflow template'));
    }
  });
};

export { workflowTemplateRoutes };
