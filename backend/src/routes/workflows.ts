import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { StartWorkflowBody, ResumeWorkflowBody } from '../types/dto/workflows.js';
import { WorkflowService } from '../services/workflow/workflowService.js';
import type { IdParams } from '../types/http/params.js';
import type { TaskIdQuery } from '../types/http/query.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getErrorMessage, getStatusCode, parseNumber, logError } from '../utils/http.js';
import { withRetry } from '../db/retry.js';

const defaultWorkflowService = new WorkflowService();

type WorkflowRouteOptions = { service?: WorkflowService };

const loopBodySchema = z.object({
  fromStepId: z.string().min(1, 'fromStepId is required'),
  override: z.boolean().optional(),
});

const workflowRoutes: FastifyPluginAsync<WorkflowRouteOptions> = async (
  fastify,
  { service = defaultWorkflowService } = {},
) => {
  fastify.post<{ Body: StartWorkflowBody }>('/run', async (request, reply) => {
    try {
      const { task_id, workflow_template_id } = request.body || {};
      if (!task_id) {
        reply.code(400);
        return errorResponse('task_id is required');
      }

      const run = await service.startWorkflow(parseNumber(String(task_id)), {
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
      const run = await service.getWorkflowRun(parseNumber(request.params.id));
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
      return successResponse(await service.getAllRunsByTask(taskId));
    } catch (error) {
      logError(error, request);
      reply.code(500);
      return errorResponse('Failed to get workflow runs');
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id/steps', async (request, reply) => {
    try {
      const run = await service.getWorkflowRun(parseNumber(request.params.id));
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
      const run = await service.cancelWorkflow(parseNumber(request.params.id));
      return successResponse(run, 'Workflow cancelled');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to cancel workflow'));
    }
  });

  fastify.post<{ Params: IdParams }>('/runs/:id/retry', async (request, reply) => {
    try {
      const run = await service.retryWorkflow(parseNumber(request.params.id));
      return successResponse(run, 'Workflow retry started');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to retry workflow'));
    }
  });

  fastify.post<{ Params: { runId: string }; Body: { fromStepId: string; override?: boolean } }>(
    '/runs/:runId/loop',
    async (request, reply) => {
      const runId = parseNumber(request.params.runId);
      if (!Number.isFinite(runId) || runId <= 0) {
        reply.code(400);
        return errorResponse('Invalid runId');
      }

      const parsed = loopBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return errorResponse(`Invalid loop request: ${parsed.error.message}`);
      }

      try {
        const newRun = await service.createLoopRun(
          runId,
          parsed.data.fromStepId,
          undefined,
          parsed.data.override === true,
        );
        return successResponse(
          { newRunId: newRun.id, iteration: newRun.iteration, run: newRun },
          'Loop run created',
        );
      } catch (error) {
        logError(error, request);
        reply.code(getStatusCode(error));
        return errorResponse(getErrorMessage(error, 'Failed to create loop run'));
      }
    },
  );

  fastify.post<{ Params: IdParams; Body: ResumeWorkflowBody }>('/runs/:id/resume', async (request, reply) => {
    try {
      const run = await withRetry(async () => {
        const body = request.body || {};
        const approved = body.approved ?? true;
        const resumeData: { approved: boolean; comment?: string; ask_user_answer?: string } = { approved };
        if (body.comment !== undefined) {
          resumeData.comment = body.comment;
        }
        if (body.ask_user_answer !== undefined) {
          const trimmed = String(body.ask_user_answer).trim();
          if (!trimmed) {
            throw Object.assign(new Error('ask_user_answer must not be empty'), { statusCode: 400 });
          }
          resumeData.ask_user_answer = trimmed;
        }
        return service.resumeWorkflow(
          parseNumber(request.params.id),
          resumeData
        );
      });
      return successResponse(run, 'Workflow resumed');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to resume workflow'));
    }
  });

  fastify.get<{ Params: IdParams }>('/runs/:id/suspend-info', async (request, reply) => {
    try {
      const run = await service.getWorkflowRun(parseNumber(request.params.id));
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
