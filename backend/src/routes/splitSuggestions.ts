import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { splitSuggestionService } from '../services/splitSuggestionService.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { withRetry } from '../db/retry.js';
import { sanitizeName } from '../utils/git.js';

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
  work_dir: z.string().nullable().default(null),
  child_task_id: z.number().nullable().default(null),
});

const projectRepo = new ProjectRepository();

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

  // Preview predicted worktree path for a suggestion (child task doesn't exist yet)
  fastify.post<{ Params: { id: string }; Body: { title: string; work_dir?: string | null } }>(
    '/split-suggestions/:id/preview-path',
    async (request, reply) => {
      try {
        const { splitSuggestionRepository } = await import('../repositories/splitSuggestionRepository.js');
        const record = await splitSuggestionRepository.findById(Number(request.params.id));
        if (!record) {
          reply.code(404);
          return errorResponse('Split suggestion not found');
        }
        const { taskRepository } = await import('../repositories/taskRepository.js');
        const parentTask = await taskRepository.findById(record.parent_task_id);
        if (!parentTask) {
          reply.code(404);
          return errorResponse('Parent task not found');
        }
        const project = await projectRepo.findById(parentTask.project_id);
        if (!project?.local_path) {
          reply.code(400);
          return errorResponse('Project has no local path configured');
        }
        const safeTitle = sanitizeName(request.body.title).substring(0, 50);
        const worktreePath = join(project.local_path, '.worktrees', `task-?-${safeTitle}`);
        const workDir = request.body.work_dir;
        const fullPath = workDir ? join(worktreePath, workDir) : worktreePath;
        const projectWorkPath = workDir ? join(project.local_path, workDir) : project.local_path;
        return successResponse({
          project_local_path: project.local_path,
          predicted_path: fullPath,
          project_work_path: projectWorkPath,
          project_work_path_exists: existsSync(projectWorkPath),
          project_exists: existsSync(project.local_path),
          worktree_base_exists: existsSync(join(project.local_path, '.worktrees')),
          predicted_path_exists: existsSync(fullPath),
        });
      } catch (error) {
        return reply.code(500).send(errorResponse('Failed to preview path'));
      }
    },
  );
};

export default splitSuggestionsRoutes;
