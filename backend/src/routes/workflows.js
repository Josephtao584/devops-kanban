/**
 * Workflow Routes
 */
import { WorkflowService } from '../services/WorkflowService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const service = new WorkflowService();

async function workflowRoutes(fastify) {
  // Trigger workflow for a task
  fastify.post('/run', async (request, reply) => {
    try {
      const { task_id } = request.body || {};
      if (!task_id) {
        reply.code(400);
        return errorResponse('task_id is required');
      }

      const taskId = parseInt(task_id, 10);
      const run = await service.startWorkflow(taskId);
      return successResponse(run, 'Workflow started');
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return errorResponse(error.message);
    }
  });

  // Get workflow run by ID
  fastify.get('/runs/:id', async (request, reply) => {
    try {
      const runId = parseInt(request.params.id, 10);
      const run = await service.getWorkflowRun(runId);
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse(run);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow run');
    }
  });

  // Get workflow runs by task ID
  fastify.get('/runs', async (request, reply) => {
    try {
      const taskId = parseInt(request.query.task_id, 10);
      if (!taskId) {
        reply.code(400);
        return errorResponse('task_id query parameter is required');
      }

      const runs = await service.getAllRunsByTask(taskId);
      return successResponse(runs);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow runs');
    }
  });

  // Get steps for a workflow run
  fastify.get('/runs/:id/steps', async (request, reply) => {
    try {
      const runId = parseInt(request.params.id, 10);
      const run = await service.getWorkflowRun(runId);
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse(run.steps);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow steps');
    }
  });

  // Cancel a workflow run
  fastify.post('/runs/:id/cancel', async (request, reply) => {
    try {
      const runId = parseInt(request.params.id, 10);
      const run = await service.cancelWorkflow(runId);
      return successResponse(run, 'Workflow cancelled');
    } catch (error) {
      request.log.error(error);
      reply.code(error.statusCode || 500);
      return errorResponse(error.message);
    }
  });
}

export default workflowRoutes;
