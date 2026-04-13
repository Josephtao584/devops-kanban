import type { FastifyPluginAsync } from 'fastify';

import type { StartWorkflowBody, ResumeWorkflowBody } from '../types/dto/workflows.js';
import { WorkflowService } from '../services/workflow/workflowService.js';
import type { IdParams } from '../types/http/params.js';
import type { TaskIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber, logError } from '../utils/http.js';

const workflowService = new WorkflowService();

const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: StartWorkflowBody }>('/run', async (request, reply) => {
    try {
      const { task_id, workflow_template_id } = request.body || {};
      if (!task_id) {
        reply.code(400);
        return errorResponse('task_id is required');
      }

      const run = await workflowService.startWorkflow(parseNumber(String(task_id)), {
        workflowTemplateId: workflow_template_id
      });
      return successResponse(run, 'Workflow started');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start workflow'));
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse(run);
    } catch (error) {
      logError(error, request);
      reply.code(500);
      return errorResponse('Failed to get workflow run');
    }
  });

  fastify.get<{ Querystring: TaskIdQuery }>('/runs', async (request, reply) => {
    try {
      const taskId = parseNumber(request.query.task_id ?? '0');
      if (!taskId) {
        reply.code(400);
        return errorResponse('task_id query parameter is required');
      }
      return successResponse(await workflowService.getAllRunsByTask(taskId));
    } catch (error) {
      logError(error, request);
      reply.code(500);
      return errorResponse('Failed to get workflow runs');
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id/steps', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse((run as { steps?: unknown }).steps);
    } catch (error) {
      logError(error, request);
      reply.code(500);
      return errorResponse('Failed to get workflow steps');
    }
  });

  fastify.post<{ Params: IdParams }>('/runs/:id/cancel', async (request, reply) => {
    try {
      const run = await workflowService.cancelWorkflow(parseNumber(request.params.id));
      return successResponse(run, 'Workflow cancelled');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to cancel workflow'));
    }
  });

  fastify.post<{ Params: IdParams }>('/runs/:id/retry', async (request, reply) => {
    try {
      const run = await workflowService.retryWorkflow(parseNumber(request.params.id));
      return successResponse(run, 'Workflow retry started');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to retry workflow'));
    }
  });

  fastify.post<{ Params: IdParams; Body: ResumeWorkflowBody }>('/runs/:id/resume', async (request, reply) => {
    try {
      const body = request.body || {};
      const approved = body.approved ?? true;
      const resumeData: { approved: boolean; comment?: string; ask_user_answer?: string } = { approved };
      if (body.comment !== undefined) {
        resumeData.comment = body.comment;
      }
      if (body.ask_user_answer !== undefined) {
        const trimmed = String(body.ask_user_answer).trim();
        if (!trimmed) {
          reply.code(400);
          return errorResponse('ask_user_answer must not be empty');
        }
        resumeData.ask_user_answer = trimmed;
      }
      const run = await workflowService.resumeWorkflow(
        parseNumber(request.params.id),
        resumeData
      );
      return successResponse(run, 'Workflow resumed');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to resume workflow'));
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id/suspend-info', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }

      if (run.status !== 'SUSPENDED') {
        return successResponse(null);
      }

      // Find suspended step from steps
      const suspendedStep = run.steps.find((s: { status: string }) => s.status === 'SUSPENDED');

      return successResponse({
        step_id: suspendedStep?.step_id || null,
        step_name: suspendedStep?.name || null,
        reason: suspendedStep?.suspend_reason || null,
        summary: suspendedStep?.summary || null,
      });
    } catch (error) {
      logError(error, request);
      reply.code(500);
      return errorResponse('Failed to get suspend info');
    }
  });
};

export { workflowRoutes };
