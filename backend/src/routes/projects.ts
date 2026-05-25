import type { FastifyPluginAsync } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ProjectService } from '../services/projectService.js';
import { TaskService } from '../services/taskService.js';
import type { CreateProjectInput, UpdateProjectInput } from '../types/dto/projects.js';
import type { IdParams } from '../types/http/params.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getStatusCode, getErrorMessage, logError } from '../utils/http.js';
import { getFileTree } from '../utils/fileTree.js';
import { readFileContent, writeFileContent } from '../utils/fileEdit.js';

const projectService = new ProjectService();
const taskService = new TaskService();

// Mime lookup for raw asset streaming. Limited to types we actually need to
// inline in the knowledge-repo viewer (images + a few text formats). Anything
// not in this map gets application/octet-stream.
const RAW_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

// Strip dot-prefixed directories (.git, .claude, .worktree, .vscode, ...) from
// a knowledge-repo file tree. We only filter directories — dot-files at any
// level (.gitignore, .env.example, README dot-files) are still useful to
// browse, so they stay. The original tree is returned by reference; we mutate
// children in place since this is the only consumer.
function stripDotDirsInPlace(node: { type: 'file' | 'directory'; name: string; children?: any[] } | null | undefined): void {
  if (!node || node.type !== 'directory' || !Array.isArray(node.children)) return;
  node.children = node.children.filter((child) => !(child.type === 'directory' && typeof child.name === 'string' && child.name.startsWith('.')));
  for (const child of node.children) {
    stripDotDirsInPlace(child);
  }
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      const projects = await projectService.getAll();
      return successResponse(projects.map((project) => project));
    } catch (error) {
      logError(error, request);
      return errorResponse('Failed to get projects');
    }
  });

  // GET /knowledge-stats - aggregate file/dir/markdown counts across every
  // project that has a readable local_path. Powers the global KPI in the
  // Agent Knowledge Bus header. Projects without a local_path or with an
  // unreadable path are silently skipped so a single broken project doesn't
  // null out the whole dashboard.
  fastify.get('/knowledge-stats', async (request) => {
    try {
      const projects = await projectService.getAll();
      let totalFiles = 0;
      let totalDirs = 0;
      let markdownCount = 0;
      let projectCount = 0;

      const isMarkdown = (p: string) => {
        const lower = p.toLowerCase();
        return lower.endsWith('.md') || lower.endsWith('.markdown');
      };

      const walk = (node: any) => {
        if (!node) return;
        if (node.type === 'file') {
          totalFiles += 1;
          if (typeof node.path === 'string' && isMarkdown(node.path)) markdownCount += 1;
          return;
        }
        if (node.type === 'directory') totalDirs += 1;
        if (Array.isArray(node.children)) node.children.forEach(walk);
      };

      for (const project of projects) {
        const localPath = (project as any).local_path;
        if (!localPath || !fs.existsSync(localPath)) continue;
        try {
          const tree = getFileTree(localPath, localPath);
          projectCount += 1;
          if (Array.isArray(tree.children)) tree.children.forEach(walk);
        } catch {
          // skip projects whose tree fails to build
        }
      }

      return successResponse({ totalFiles, totalDirs, markdownCount, projectCount });
    } catch (error) {
      logError(error, request);
      return errorResponse('Failed to compute knowledge stats');
    }
  });

  fastify.get<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getWithStats(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(project);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get project'));
    }
  });

  fastify.post('/', async (request) => {
    try {
      const project = await projectService.create(request.body as CreateProjectInput);
      return successResponse(project, 'Project created successfully');
    } catch (error) {
      logError(error, request);
      return errorResponse('Failed to create project');
    }
  });

  fastify.put<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const updated = await projectService.update(projectId, request.body as UpdateProjectInput);
      if (!updated) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(updated, 'Project updated successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update project'));
    }
  });

  fastify.delete<{ Params: IdParams }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const deleted = await projectService.delete(projectId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(null, 'Project deleted successfully');
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete project'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id/tasks', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      if (!(await projectService.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const tasks = await taskService.getByProject(projectId);
      return successResponse(tasks);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get project tasks'));
    }
  });

  fastify.get<{ Params: IdParams }>('/:id/tasks/grouped', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      if (!(await projectService.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const grouped = await taskService.getByProjectGrouped(projectId);
      return successResponse(grouped);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get grouped tasks'));
    }
  });

  // GET /:id/files - Read project's local_path file tree (read-only).
  // Used for browsing knowledge repos in the workspace; the project must
  // have local_path configured and the path must exist on disk.
  fastify.get<{ Params: IdParams }>('/:id/files', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getById(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      if (!project.local_path) {
        reply.code(400);
        return errorResponse('Project has no local_path configured');
      }
      if (!fs.existsSync(project.local_path)) {
        reply.code(400);
        return errorResponse('Project local_path does not exist on disk');
      }

      const tree = getFileTree(project.local_path, project.local_path);
      stripDotDirsInPlace(tree);
      return successResponse(tree);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get project files'));
    }
  });

  // GET /:id/files/* - Read a single file from the project's local_path
  // (read-only). Path traversal is rejected by readFileContent.
  fastify.get<{ Params: IdParams & { '*': string } }>('/:id/files/*', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getById(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      if (!project.local_path) {
        reply.code(400);
        return errorResponse('Project has no local_path configured');
      }
      if (!fs.existsSync(project.local_path)) {
        reply.code(400);
        return errorResponse('Project local_path does not exist on disk');
      }

      const filePath = (request.params as any)['*'];
      const result = readFileContent(project.local_path, filePath);
      return successResponse(result);
    } catch (error: any) {
      logError(error, request);
      if (error.statusCode === 404) {
        reply.code(404);
      } else {
        reply.code(getStatusCode(error));
      }
      return errorResponse(getErrorMessage(error, 'Failed to read project file'));
    }
  });

  // PUT /:id/files/* - Overwrite a file inside project.local_path. Body must
  // be { content: string }. Path traversal and large files are rejected by the
  // shared writeFileContent / validateFilePath helpers.
  fastify.put<{ Params: IdParams & { '*': string }; Body: { content?: unknown } }>('/:id/files/*', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getById(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      if (!project.local_path) {
        reply.code(400);
        return errorResponse('Project has no local_path configured');
      }
      if (!fs.existsSync(project.local_path)) {
        reply.code(400);
        return errorResponse('Project local_path does not exist on disk');
      }

      const filePath = (request.params as any)['*'];
      const body = request.body || {};
      if (typeof body.content !== 'string') {
        reply.code(400);
        return errorResponse('Request body must include a string `content` field');
      }

      writeFileContent(project.local_path, filePath, body.content);
      return successResponse({ path: filePath, size: body.content.length }, 'File saved');
    } catch (error: any) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to write project file'));
    }
  });

  // GET /:id/raw/* - Stream a file from project.local_path as binary so that
  // <img> tags inside knowledge-repo Markdown can resolve relative image
  // paths. Path traversal is rejected the same way as /files/*.
  fastify.get<{ Params: IdParams & { '*': string } }>('/:id/raw/*', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getById(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      if (!project.local_path) {
        reply.code(400);
        return errorResponse('Project has no local_path configured');
      }
      if (!fs.existsSync(project.local_path)) {
        reply.code(400);
        return errorResponse('Project local_path does not exist on disk');
      }

      const relPath = (request.params as any)['*'] as string;
      const normalized = path.normalize(relPath);
      if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
        reply.code(400);
        return errorResponse('Invalid file path');
      }
      const fullPath = path.resolve(project.local_path, normalized);
      const root = path.resolve(project.local_path);
      if (!fullPath.startsWith(root)) {
        reply.code(400);
        return errorResponse('Path traversal detected');
      }
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        reply.code(404);
        return errorResponse('File not found');
      }

      const ext = path.extname(fullPath).toLowerCase();
      const mime = RAW_MIME_BY_EXT[ext] || 'application/octet-stream';
      reply.header('Content-Type', mime);
      reply.header('Cache-Control', 'private, max-age=300');
      return reply.send(fs.createReadStream(fullPath));
    } catch (error: any) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to read raw file'));
    }
  });
};
