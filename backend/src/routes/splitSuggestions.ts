import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { splitSuggestionService } from '../services/splitSuggestionService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { withRetry } from '../db/retry.js';

const suggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  template_id: z.string().nullable(),
  linked_project_id: z.number().nullable(),
  target_repo_url: z.string().nullable(),
  depends_on_indices: z.array(z.number()),
  enabled: z.boolean(),
  create_worktree: z.boolean().default(true),
  auto_start: z.boolean().default(true),
});

const splitSuggestionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { taskId: string } }>('/tasks/:taskId/split-suggestions', async (request, reply) => {
    try {
      const taskId = Number(request.params.taskId);
      const list = await splitSuggestionService.getByTask(taskId);
      return successResponse(list);
    } catch (error) {
      return reply.code(500).send(errorResponse('Failed to get split suggestions'));
    }
  });

  fastify.patch<{ Params: { id: string }; Body: { suggestions: unknown[] } }>('/split-suggestions/:id', async (request, reply) => {
    const parsed = z.array(suggestionSchema).safeParse(request.body?.suggestions);
    if (!parsed.success) {
      return reply.code(400).send(errorResponse(`invalid suggestions: ${parsed.error.message}`));
    }
    try {
      const id = Number(request.params.id);
      const updated = await withRetry(() => splitSuggestionService.updateSuggestions(id, parsed.data));
      return successResponse(updated);
    } catch (error) {
      return reply.code(400).send(errorResponse((error as Error).message));
    }
  });

  fastify.post<{ Params: { id: string } }>('/split-suggestions/:id/confirm', async (request, reply) => {
    try {
      const id = Number(request.params.id);
      const result = await withRetry(() => splitSuggestionService.confirm(id));
      return successResponse(result);
    } catch (error) {
      return reply.code(400).send(errorResponse((error as Error).message));
    }
  });

  fastify.post<{ Params: { id: string } }>('/split-suggestions/:id/dismiss', async (request, reply) => {
    try {
      const id = Number(request.params.id);
      const result = await withRetry(() => splitSuggestionService.dismiss(id));
      return successResponse(result);
    } catch (error) {
      return reply.code(400).send(errorResponse((error as Error).message));
    }
  });
};

export default splitSuggestionsRoutes;
