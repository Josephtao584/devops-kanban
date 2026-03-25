import type { FastifyPluginAsync } from 'fastify';

import { WorkflowTemplateService } from '../services/workflow/workflowTemplateService.js';
import type { WorkflowTemplateEntity } from '../types/entities.js';
import type { CreateWorkflowTemplateInput, UpdateWorkflowTemplateInput } from '../types/dto/workflowTemplates.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode } from '../utils/http.js';

type WorkflowTemplateRouteService = {
  getTemplates(): Promise<WorkflowTemplateEntity[]>;
  getTemplateById(templateId: string): Promise<WorkflowTemplateEntity | null>;
  createTemplate(template: Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowTemplateEntity>;
  updateTemplate(templateId: string, template: Partial<Omit<WorkflowTemplateEntity, 'id' | 'template_id' | 'created_at' | 'updated_at'>>): Promise<WorkflowTemplateEntity | null>;
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
      const template = await service.createTemplate(request.body as Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>);
      return successResponse(template, 'Workflow template created');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create workflow template'));
    }
  });

  fastify.put<{ Body: UpdateWorkflowTemplateInput }>('/', async (request, reply) => {
    try {
      const { template_id, ...updateData } = request.body;
      const template = await service.updateTemplate(template_id, updateData);
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
