import type { FastifyPluginAsync } from 'fastify';

import { WorkflowTemplateService } from '../services/workflow/workflowTemplateService.js';
import type { WorkflowTemplate } from '../services/workflow/workflowTemplateService.js';
import type { CreateWorkflowTemplateInput, UpdateWorkflowTemplateInput } from '../types/dto/workflowTemplates.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode } from '../utils/http.js';

type WorkflowTemplateRouteService = {
  getTemplates(): Promise<WorkflowTemplate[]>;
  getTemplateById(templateId: string): Promise<WorkflowTemplate | null>;
  createTemplate(template: CreateWorkflowTemplateInput): Promise<WorkflowTemplate>;
  updateTemplate(template: UpdateWorkflowTemplateInput): Promise<WorkflowTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
};

type WorkflowTemplateRouteOptions = { service?: WorkflowTemplateRouteService };

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

  fastify.post<{ Body: CreateWorkflowTemplateInput }>('/', async (request, reply) => {
    try {
      const template = await service.createTemplate(request.body);
      return successResponse(template, 'Workflow template created');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create workflow template'));
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

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await service.deleteTemplate(request.params.id);
      return successResponse(null, 'Workflow template deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete workflow template'));
    }
  });
};

export { workflowTemplateRoutes };
