import { WorkflowTemplateService } from '../services/workflow/workflowTemplateService.js';
import { successResponse, errorResponse } from '../utils/response.js';

async function workflowTemplateRoutes(fastify, { service = new WorkflowTemplateService() } = {}) {
  fastify.get('/', async (request, reply) => {
    try {
      const template = await service.getTemplate();
      return successResponse(template);
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return errorResponse(error.message || 'Failed to get workflow template');
    }
  });

  fastify.put('/', async (request, reply) => {
    try {
      const template = await service.updateTemplate(request.body || {});
      return successResponse(template, 'Workflow template updated');
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return errorResponse(error.message || 'Failed to update workflow template');
    }
  });
}

export default workflowTemplateRoutes;
