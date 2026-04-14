import type { FastifyPluginAsync } from 'fastify';

import { WorkflowTemplateService } from '../services/workflow/workflowTemplateService.js';
import { AgentRepository } from '../repositories/agentRepository.js';
import { assembleWorkflowPrompt } from '../services/workflow/workflowPromptAssembler.js';
import type { WorkflowTemplateEntity } from '../types/entities.js';
import type { CreateWorkflowTemplateInput, UpdateWorkflowTemplateInput, ReorderWorkflowTemplatesInput, ExportFile, ImportPreview, ImportConfirmInput } from '../types/dto/workflowTemplates.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, logError } from '../utils/http.js';

type WorkflowTemplateRouteService = {
  getTemplates(): Promise<WorkflowTemplateEntity[]>;
  getTemplateById(templateId: string): Promise<WorkflowTemplateEntity | null>;
  createTemplate(template: Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>): Promise<WorkflowTemplateEntity>;
  updateTemplate(templateId: string, template: Partial<Omit<WorkflowTemplateEntity, 'id' | 'template_id' | 'created_at' | 'updated_at'>>): Promise<WorkflowTemplateEntity | null>;
  deleteTemplate(templateId: string): Promise<void>;
  reorderTemplates(updates: Array<{ id: number; order: number }>): Promise<WorkflowTemplateEntity[]>;
  exportTemplate(templateId: string): Promise<ExportFile>;
  exportTemplates(templateIds: string[]): Promise<ExportFile>;
  previewImport(exportData: ExportFile): Promise<ImportPreview>;
  confirmImport(input: ImportConfirmInput): Promise<{ imported: WorkflowTemplateEntity[]; skipped: string[] }>;
};

type WorkflowTemplateRouteOptions = { service?: WorkflowTemplateRouteService };

const workflowTemplateRoutes: FastifyPluginAsync<WorkflowTemplateRouteOptions> = async (fastify, { service = new WorkflowTemplateService() } = {}) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await service.getTemplates());
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get workflow templates'));
    }
  });

  fastify.post<{ Body: CreateWorkflowTemplateInput }>('/', async (request, reply) => {
    try {
      const template = await service.createTemplate(request.body as Omit<WorkflowTemplateEntity, 'id' | 'created_at' | 'updated_at'>);
      return successResponse(template, 'Workflow template created');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to create workflow template'));
    }
  });

  fastify.put<{ Body: ReorderWorkflowTemplatesInput }>('/reorder', async (request, reply) => {
    try {
      const { updates } = request.body;
      if (!Array.isArray(updates)) {
        reply.code(400);
        return errorResponse('Updates must be an array');
      }

      const results = await service.reorderTemplates(updates);
      return successResponse(results, 'Workflow templates reordered');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to reorder workflow templates'));
    }
  });

  fastify.put<{ Body: UpdateWorkflowTemplateInput }>('/', async (request, reply) => {
    try {
      const { template_id, ...updateData } = request.body;
      const template = await service.updateTemplate(template_id, updateData);
      return successResponse(template, 'Workflow template updated');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update workflow template'));
    }
  });

  // Export single template — registered before /:id to avoid param matching
  fastify.get<{ Params: { id: string } }>('/export/:id', async (request, reply) => {
    try {
      const templateId = request.params.id;
      const safeFilename = templateId.replace(/[^a-zA-Z0-9._-]/g, '_');
      const exportFile = await service.exportTemplate(templateId);
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${safeFilename}.json"`);
      return exportFile;
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to export workflow template'));
    }
  });

  // Batch export
  fastify.post<{ Body: { templateIds?: string[] } }>('/export', async (request, reply) => {
    try {
      const { templateIds } = request.body || {};
      if (!Array.isArray(templateIds) || templateIds.length === 0) {
        reply.code(400);
        return errorResponse('templateIds must be a non-empty array');
      }
      const exportFile = await service.exportTemplates(templateIds);
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="workflow-templates-${Date.now()}.json"`);
      return exportFile;
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to export workflow templates'));
    }
  });

  // Import preview (accepts JSON body parsed from uploaded file)
  fastify.post<{ Body: ExportFile }>('/import', async (request, reply) => {
    try {
      const exportData = request.body;
      if (!exportData || !Array.isArray(exportData.templates)) {
        reply.code(400);
        return errorResponse('Invalid import file: templates array is required');
      }
      const preview = await service.previewImport(exportData);
      return successResponse(preview);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to preview import'));
    }
  });

  // Confirm import
  fastify.post<{ Body: ImportConfirmInput }>('/import/confirm', async (request, reply) => {
    try {
      const input = request.body;
      if (!input || !Array.isArray(input.templates)) {
        reply.code(400);
        return errorResponse('Invalid import data: templates array is required');
      }
      const result = await service.confirmImport(input);
      return successResponse(result, 'Import completed');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to import workflow templates'));
    }
  });

  // Preview assembled prompt for a step
  fastify.post<{
    Body: {
      step: { name: string; instructionPrompt: string; agentId?: number };
      upstreamSteps?: Array<{ stepId: string; name: string }>;
      taskTitle?: string;
      taskDescription?: string;
    };
  }>('/preview-prompt', async (request, reply) => {
    try {
      const { step, upstreamSteps = [], taskTitle, taskDescription } = request.body || {};
      if (!step || typeof step.name !== 'string' || typeof step.instructionPrompt !== 'string') {
        reply.code(400);
        return errorResponse('step.name and step.instructionPrompt are required');
      }

      const agentRepo = new AgentRepository();
      let agent: { name: string; role: string; description?: string; skills: number[] } | undefined = undefined;
      if (typeof step.agentId === 'number') {
        const agentEntity = await agentRepo.findById(step.agentId);
        if (agentEntity) {
          const agentInfo: { name: string; role: string; skills: number[]; description?: string } = {
            name: agentEntity.name, role: agentEntity.role, skills: agentEntity.skills
          };
          if (typeof agentEntity.description === 'string' && agentEntity.description.trim()) {
            agentInfo.description = agentEntity.description;
          }
          agent = agentInfo;
        }
      }

      const inputData: Record<string, unknown> = {};
      for (const us of upstreamSteps) {
        inputData[us.stepId] = { summary: `{{上游步骤「${us.name}」的执行摘要}}` };
      }

      const prompt = assembleWorkflowPrompt({
        step,
        state: { taskTitle: taskTitle || '{{示例需求标题}}', taskDescription: taskDescription || '{{示例需求描述内容}}' },
        inputData,
        upstreamStepIds: upstreamSteps.map((s) => s.stepId),
        ...(agent ? { agent } : {}),
      });

      return successResponse({ prompt: prompt.replaceAll('\\n', '\n') });
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to preview prompt'));
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
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get workflow template'));
    }
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      await service.deleteTemplate(request.params.id);
      return successResponse(null, 'Workflow template deleted');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete workflow template'));
    }
  });
};

export { workflowTemplateRoutes };
