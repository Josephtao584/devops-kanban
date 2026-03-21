import type { FastifyPluginAsync } from 'fastify';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { AgentRepository } from '../repositories/agentRepository.js';
import { BaseRepository } from '../repositories/base.js';
import { ProjectRepository } from '../repositories/projectRepository.js';
import { ExecutionService } from '../services/executionService.js';
import { IterationService } from '../services/iterationService.js';
import { ProjectService } from '../services/projectService.js';
import { SessionService } from '../services/sessionService.js';
import { TaskService } from '../services/taskService.js';
import { TaskSourceService } from '../services/taskSourceService.js';
import { WorkflowService } from '../services/workflow/workflowService.js';
import { WorkflowTemplateService } from '../services/workflow/workflowTemplateService.js';
import { successResponse, errorResponse } from '../utils/response.js';

type ParamsWithId = { id: string };
type ParamsWithTaskId = { taskId: string };
type ParamsWithSessionId = { sessionId: string };
type QueryWithProjectId = { project_id?: string };
type GitBranchListQuery = { projectId?: string };
type GitBranchCreateQuery = { projectId?: string; name?: string; startPoint?: string };
type GitBranchDeleteQuery = { projectId?: string; force?: string };
type WorktreeDiffQuery = { source?: string; target?: string; projectId?: string };
type QueryWithTaskId = { task_id?: string };
type QueryWithTaskFilters = { project_id?: string; iteration_id?: string };
type SessionFiltersQuery = { taskId?: string; activeOnly?: string };
type StatusBody = { status?: string };
type ReorderRequestBody = { updates?: Array<{ id?: number; order?: number }> };
type ContinueSessionBody = { input?: string };
type WorkflowRunBody = { task_id?: string | number };
type TaskSourceImportBody = { items?: unknown[]; project_id?: number; iteration_id?: number | null };
type WebSocketPayload = {
  type?: string;
  destination?: string;
  session_id?: number;
  channel?: 'output' | 'status';
  input?: string;
  body?: string | { input?: string };
};

type SessionChannel = 'output' | 'status';
type SessionSubscriber = {
  readyState: number;
  send(message: string): void;
  on(event: 'message', handler: (message: Buffer | string) => void | Promise<void>): void;
  on(event: 'close', handler: () => void): void;
};
type SessionSubscriptions = Record<SessionChannel, SessionSubscriber[]>;
type SessionRouteOptions = { service?: SessionService };
type WorkflowTemplateRouteOptions = { service?: WorkflowTemplateService };
type StoredBaseRecord = Record<string, unknown> & { id: number; created_at: string; updated_at: string };
type GitBranch = {
  name: string;
  fullName: string;
  isCurrent: boolean;
  isRemote: boolean;
  aheadCount: number;
  behindCount: number;
};
type WorktreeDiffFile = {
  path: string;
  additions: number;
  deletions: number;
  changes: number;
  status: 'added' | 'modified' | 'deleted';
};
type WorktreeDiffResult = {
  files: WorktreeDiffFile[];
  diffs: Record<string, string>;
};

function buildValidWorkflowTemplateFallback(): Parameters<WorkflowTemplateService['updateTemplate']>[0] {
  return {
    template_id: 'dev-workflow-v1',
    name: '默认研发工作流',
    steps: [
      {
        id: 'requirement-design',
        name: '需求设计',
        instructionPrompt: '先完成需求分析，整理实现思路、关键约束和交付方案。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'code-development',
        name: '代码开发',
        instructionPrompt: '根据上游步骤摘要完成代码实现，保持改动聚焦，并总结主要修改结果。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'testing',
        name: '测试',
        instructionPrompt: '根据上游步骤摘要执行必要验证，说明测试结果、发现的问题和结论。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
      {
        id: 'code-review',
        name: '代码审查',
        instructionPrompt: '根据上游步骤摘要完成代码审查，说明主要风险、问题和审查结论。',
        executor: { type: 'CLAUDE_CODE', commandOverride: null, args: [], env: {} },
      },
    ],
  };
}

const agentRepo = new AgentRepository();
const executionService = new ExecutionService();
const iterationService = new IterationService();
const projectRepo = new ProjectRepository();
const projectService = new ProjectService();
const roleRepo = new BaseRepository<StoredBaseRecord>('roles.json');
const memberRepo = new BaseRepository<StoredBaseRecord>('members.json');
const sessionService = new SessionService();
const taskService = new TaskService();
const taskSourceService = new TaskSourceService();
const workflowService = new WorkflowService();

const sessionSubscriptions = new Map<number, SessionSubscriptions>();

function getStatusCode(error: unknown, fallback = 500) {
  if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  return fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parseNumber(value: string) {
  return Number.parseInt(value, 10);
}

function broadcastToSession(sessionId: number, channel: SessionChannel, data: Record<string, unknown>) {
  const subscriptions = sessionSubscriptions.get(sessionId);
  if (!subscriptions) {
    return;
  }

  const subscribers = subscriptions[channel];
  const message = JSON.stringify({
    sessionId,
    channel,
    ...data,
  });

  const disconnected: SessionSubscriber[] = [];
  for (const subscriber of subscribers) {
    if (subscriber.readyState === 1) {
      subscriber.send(message);
    } else {
      disconnected.push(subscriber);
    }
  }

  for (const subscriber of disconnected) {
    const index = subscribers.indexOf(subscriber);
    if (index >= 0) {
      subscribers.splice(index, 1);
    }
  }
}

function getSessionSubscriptions(sessionId: number) {
  let subscriptions = sessionSubscriptions.get(sessionId);
  if (!subscriptions) {
    subscriptions = { output: [], status: [] };
    sessionSubscriptions.set(sessionId, subscriptions);
  }
  return subscriptions;
}

function handleTaskSourceError(reply: { code(statusCode: number): unknown }, error: unknown, fallbackMessage: string) {
  const statusCode = getStatusCode(error);
  reply.code(statusCode);
  return errorResponse(statusCode === 500 ? fallbackMessage : getErrorMessage(error, fallbackMessage));
}

async function getRepoPath(projectId: number) {
  const project = await projectRepo.findById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const localPath = typeof project.local_path === 'string' ? project.local_path : null;
  if (localPath && fs.existsSync(localPath)) {
    return localPath;
  }

  if (project.git_url) {
    const cloneDir = path.join('/tmp/claude-repos', String(project.id));
    if (fs.existsSync(cloneDir)) {
      return cloneDir;
    }
    throw new Error('Repository has not been cloned yet. Please create a worktree first.');
  }

  throw new Error('Project has neither local_path nor git_url');
}

function getReplyMessage(error: unknown) {
  return getErrorMessage(error, 'Unexpected error');
}

function escapeShellArg(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      const projects = await projectService.getAll();
      return successResponse(projects.map((project) => project));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get projects');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const project = await projectService.getWithStats(projectId);
      if (!project) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(project);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get project');
    }
  });

  fastify.post('/', async (request) => {
    try {
      const project = await projectService.create(request.body as Record<string, unknown>);
      return successResponse(project, 'Project created successfully');
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to create project');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const updated = await projectService.update(projectId, request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(updated, 'Project updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update project');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const deleted = await projectService.delete(projectId);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Project not found');
      }
      return successResponse(null, 'Project deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete project');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id/tasks', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      if (!(await projectService.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const tasks = await taskService.getByProject(projectId);
      return successResponse(tasks);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get project tasks');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id/tasks/grouped', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      if (!(await projectService.exists(projectId))) {
        reply.code(404);
        return errorResponse('Project not found');
      }

      const grouped = await taskService.getByProjectGrouped(projectId);
      return successResponse(grouped);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get grouped tasks');
    }
  });
};

const taskRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: QueryWithTaskFilters }>('/', async (request) => {
    try {
      const { project_id, iteration_id } = request.query;
      if (iteration_id !== undefined) {
        const iterId = iteration_id === 'null' ? null : parseNumber(iteration_id);
        const tasks = await taskService.getByProjectAndIteration(parseNumber(project_id ?? '0'), iterId);
        return successResponse(tasks);
      }
      if (project_id) {
        const tasks = await taskService.getByProject(parseNumber(project_id));
        return successResponse(tasks);
      }
      return successResponse(await taskService.getAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get tasks');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const task = await taskService.getById(parseNumber(request.params.id));
      if (!task) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(task);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get task');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const task = await taskService.create(request.body as Record<string, unknown>);
      return successResponse(task, 'Task created successfully');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      if (statusCode === 400) {
        reply.code(400);
        return errorResponse(getErrorMessage(error, 'Failed to create task'));
      }
      reply.code(500);
      return errorResponse('Failed to create task');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await taskService.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task');
    }
  });

  fastify.patch<{ Params: ParamsWithId; Body: StatusBody }>('/:id/status', async (request, reply) => {
    try {
      const { status } = request.body;
      if (!status) {
        reply.code(400);
        return errorResponse('Status is required');
      }

      const updated = await taskService.updateStatus(parseNumber(request.params.id), status);
      if (!updated) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(updated, 'Task status updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update task status');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await taskService.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task not found');
      }
      return successResponse(null, 'Task deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete task');
    }
  });

  fastify.post<{ Params: ParamsWithId }>('/:id/start', async (request, reply) => {
    try {
      const task = await taskService.startTask(parseNumber(request.params.id));
      return successResponse(task, 'Task started successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start task'));
    }
  });

  fastify.put<{ Body: ReorderRequestBody }>('/reorder', async (request, reply) => {
    try {
      const { updates } = request.body;
      if (!Array.isArray(updates)) {
        reply.code(400);
        return errorResponse('Updates must be an array');
      }

      const results = [];
      for (const update of updates) {
        if (update.id && update.order !== undefined) {
          const updated = await taskService.update(update.id, { order: update.order });
          if (updated) {
            results.push(updated);
          }
        }
      }

      return successResponse(results, 'Tasks reordered');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to reorder tasks');
    }
  });
};

const sessionRoutes: FastifyPluginAsync<SessionRouteOptions> = async (fastify, { service = sessionService } = {}) => {
  fastify.get<{ Querystring: SessionFiltersQuery }>('/sessions', async (request) => {
    try {
      const { taskId, activeOnly } = request.query;
      const filters: { taskId?: number; activeOnly?: boolean } = {};
      if (taskId) {
        filters.taskId = parseNumber(taskId);
      }
      if (activeOnly) {
        filters.activeOnly = activeOnly === 'true';
      }

      return successResponse(await service.getAll(filters));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get sessions');
    }
  });

  fastify.get<{ Params: ParamsWithTaskId }>('/sessions/task/:taskId/active', async (request) => {
    try {
      return successResponse(await service.getActiveByTask(parseNumber(request.params.taskId)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get active session');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/sessions/:id', async (request, reply) => {
    try {
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      return successResponse(session);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get session');
    }
  });

  fastify.post('/sessions', async (request, reply) => {
    try {
      const session = await service.create((request.body as Record<string, unknown> & { task_id: number; initial_prompt?: string | null }) || { task_id: 0 });
      return successResponse(session, 'Session created');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      reply.code(statusCode);
      return errorResponse(statusCode === 404 ? getErrorMessage(error, 'Session create failed') : 'Failed to create session');
    }
  });

  fastify.post<{ Params: ParamsWithId }>('/sessions/:id/start', async (request, reply) => {
    try {
      const session = await service.start(parseNumber(request.params.id), broadcastToSession);
      return successResponse(session, 'Session started');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start session'));
    }
  });

  fastify.post<{ Params: ParamsWithId }>('/sessions/:id/stop', async (request, reply) => {
    try {
      const session = await service.stop(parseNumber(request.params.id), broadcastToSession);
      return successResponse(session, 'Session stopped');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to stop session'));
    }
  });

  fastify.post<{ Params: ParamsWithId; Body: ContinueSessionBody }>('/sessions/:id/continue', async (request, reply) => {
    try {
      const session = await service.continue(parseNumber(request.params.id), request.body.input || '', broadcastToSession);
      return successResponse(session, 'Session continued');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to continue session'));
    }
  });

  fastify.post<{ Params: ParamsWithId; Body: ContinueSessionBody }>('/sessions/:id/input', async (request, reply) => {
    try {
      await service.sendInput(parseNumber(request.params.id), request.body.input || '');
      return successResponse(null, 'Input sent');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to send input'));
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/sessions/:id/output', async (request, reply) => {
    try {
      const session = await service.getById(parseNumber(request.params.id));
      if (!session) {
        reply.code(404);
        return errorResponse('Session not found');
      }
      return successResponse((session as { output?: string }).output || '');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get session output');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/sessions/:id', async (request, reply) => {
    try {
      await service.delete(parseNumber(request.params.id), broadcastToSession);
      return successResponse(null, 'Session deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to delete session'));
    }
  });

  fastify.get('/ws', { websocket: true }, (connection) => {
    const ws = connection.socket as SessionSubscriber;

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message.toString()) as WebSocketPayload;
        const { type, destination, session_id, channel, input, body } = payload;

        if (destination?.startsWith('/topic/session/')) {
          const parts = destination.split('/');
          if (parts.length >= 5) {
            const sessionId = parseNumber(parts[3] ?? '');
            const sessionChannel = parts[4];
            if (sessionChannel && (sessionChannel === 'output' || sessionChannel === 'status')) {
              getSessionSubscriptions(sessionId)[sessionChannel].push(ws);
              ws.send(JSON.stringify({ type: 'SUBSCRIBED', destination }));
            }
          }
        }

        if (destination?.startsWith('/app/session/')) {
          const parts = destination.split('/');
          if (parts.length >= 4) {
            const sessionId = parseNumber(parts[2] ?? '');
            const inputText = typeof body === 'string' ? ((JSON.parse(body) as { input?: string }).input) : body?.input;
            if (inputText) {
              await service.sendInput(sessionId, inputText);
              broadcastToSession(sessionId, 'output', {
                type: 'chunk',
                content: inputText,
                stream: 'stdin',
                timestamp: new Date().toISOString(),
              });
            }
          }
        }

        if (type === 'subscribe' && session_id) {
          const sessionChannel = channel || 'output';
          getSessionSubscriptions(session_id)[sessionChannel].push(ws);
          ws.send(JSON.stringify({ type: 'subscribed', session_id, channel: sessionChannel }));
        }

        if (type === 'input' && session_id && input) {
          await service.sendInput(session_id, input);
        }
      } catch {
        // Ignore invalid JSON payloads.
      }
    });

    ws.on('close', () => {
      for (const [sessionId, channels] of sessionSubscriptions.entries()) {
        for (const sessionChannel of Object.keys(channels) as SessionChannel[]) {
          const subscribers = channels[sessionChannel];
          const index = subscribers.indexOf(ws);
          if (index >= 0) {
            subscribers.splice(index, 1);
          }
        }
        if (channels.output.length === 0 && channels.status.length === 0) {
          sessionSubscriptions.delete(sessionId);
        }
      }
    });
  });
};

const taskSourceRoutes: FastifyPluginAsync = async (fastify) => {
  const getService = () => fastify.taskSourceService || taskSourceService;

  fastify.get<{ Querystring: QueryWithProjectId }>('/', async (request, reply) => {
    try {
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id query parameter is required');
      }

      const sources = await getService().getByProject(parseNumber(project_id));
      return successResponse(sources);
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to get task sources');
    }
  });

  fastify.get('/types/available', async (request, reply) => {
    try {
      return successResponse(await getService().getAvailableSourceTypes());
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to get available source types');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const source = await getService().getById(request.params.id);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source);
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to get task source');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const source = await getService().create(request.body as Record<string, unknown>);
      return successResponse(source, 'Task source created successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to create task source');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const source = await getService().update(request.params.id, request.body as Record<string, unknown>);
      if (!source) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(source, 'Task source updated successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to update task source');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await getService().delete(request.params.id);
      if (!deleted) {
        reply.code(404);
        return errorResponse('Task source not found');
      }
      return successResponse(null, 'Task source deleted successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to delete task source');
    }
  });

  fastify.post<{ Params: ParamsWithId }>('/:id/sync', async (request, reply) => {
    try {
      const tasks = await getService().sync(request.params.id);
      return successResponse(tasks, 'Task source synced successfully');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to sync task source');
    }
  });

  fastify.post<{ Params: ParamsWithId }>('/:id/sync/preview', async (request, reply) => {
    try {
      return successResponse(await getService().previewSync(request.params.id));
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, `Failed to preview sync: ${getErrorMessage(error, 'Unknown error')}`);
    }
  });

  fastify.post<{ Params: ParamsWithId; Body: TaskSourceImportBody }>('/:id/sync/import', async (request, reply) => {
    try {
      const { items, project_id, iteration_id } = request.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        reply.code(400);
        return errorResponse('items array is required');
      }
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }

      const result = await getService().importIssues(request.params.id, items, project_id, iteration_id);
      return successResponse(result, 'Import completed');
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, `Failed to import: ${getErrorMessage(error, 'Unknown error')}`);
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id/test', async (request, reply) => {
    try {
      const connected = await getService().testConnection(request.params.id);
      return successResponse({ connected });
    } catch (error) {
      request.log.error(error);
      return handleTaskSourceError(reply, error, 'Failed to test task source connection');
    }
  });
};

const executionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await executionService.getAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const execution = await executionService.getById(parseNumber(request.params.id));
      if (!execution) {
        reply.code(404);
        return errorResponse('Execution not found');
      }
      return successResponse(execution);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get execution');
    }
  });

  fastify.get<{ Params: ParamsWithSessionId }>('/session/:sessionId', async (request) => {
    try {
      return successResponse(await executionService.getBySession(parseNumber(request.params.sessionId)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  fastify.get<{ Params: ParamsWithTaskId }>('/task/:taskId', async (request) => {
    try {
      return successResponse(await executionService.getByTask(parseNumber(request.params.taskId)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get executions');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const execution = await executionService.create((request.body as Record<string, unknown> & { session_id: number; task_id?: number }) || { session_id: 0 });
      return successResponse(execution, 'Execution created');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      if (statusCode === 404) {
        reply.code(404);
        return errorResponse(getErrorMessage(error, 'Session not found'));
      }
      reply.code(500);
      return errorResponse('Failed to create execution');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await executionService.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Execution not found');
      }
      return successResponse(updated, 'Execution updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update execution');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await executionService.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Execution not found');
      }
      return successResponse(null, 'Execution deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete execution');
    }
  });
};

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await agentRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get agents');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const agent = await agentRepo.findById(parseNumber(request.params.id));
      if (!agent) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(agent);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get agent');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const agent = await agentRepo.create(request.body as Record<string, unknown>);
      return successResponse(agent, 'Agent created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create agent');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await agentRepo.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(updated, 'Agent updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update agent');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await agentRepo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Agent not found');
      }
      return successResponse(null, 'Agent deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete agent');
    }
  });
};

const roleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await roleRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get roles');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const role = await roleRepo.findById(parseNumber(request.params.id));
      if (!role) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(role);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get role');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const role = await roleRepo.create(request.body as Record<string, unknown>);
      return successResponse(role, 'Role created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create role');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await roleRepo.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(updated, 'Role updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update role');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await roleRepo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Role not found');
      }
      return successResponse(null, 'Role deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete role');
    }
  });
};

const memberRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    try {
      return successResponse(await memberRepo.findAll());
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get members');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const member = await memberRepo.findById(parseNumber(request.params.id));
      if (!member) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(member);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get member');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const member = await memberRepo.create(request.body as Record<string, unknown>);
      return successResponse(member, 'Member created');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to create member');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await memberRepo.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(updated, 'Member updated');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update member');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await memberRepo.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Member not found');
      }
      return successResponse(null, 'Member deleted');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete member');
    }
  });
};

const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: WorkflowRunBody }>('/run', async (request, reply) => {
    try {
      const { task_id } = request.body || {};
      if (!task_id) {
        reply.code(400);
        return errorResponse('task_id is required');
      }

      const run = await workflowService.startWorkflow(parseNumber(String(task_id)));
      return successResponse(run, 'Workflow started');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to start workflow'));
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/runs/:id', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
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

  fastify.get<{ Querystring: QueryWithTaskId }>('/runs', async (request, reply) => {
    try {
      const taskId = parseNumber(request.query.task_id ?? '0');
      if (!taskId) {
        reply.code(400);
        return errorResponse('task_id query parameter is required');
      }
      return successResponse(await workflowService.getAllRunsByTask(taskId));
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow runs');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/runs/:id/steps', async (request, reply) => {
    try {
      const run = await workflowService.getWorkflowRun(parseNumber(request.params.id));
      if (!run) {
        reply.code(404);
        return errorResponse('Workflow run not found');
      }
      return successResponse((run as { steps?: unknown }).steps);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get workflow steps');
    }
  });

  fastify.post<{ Params: ParamsWithId }>('/runs/:id/cancel', async (request, reply) => {
    try {
      const run = await workflowService.cancelWorkflow(parseNumber(request.params.id));
      return successResponse(run, 'Workflow cancelled');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to cancel workflow'));
    }
  });
};

const workflowTemplateRoutes: FastifyPluginAsync<WorkflowTemplateRouteOptions> = async (fastify, { service = new WorkflowTemplateService() } = {}) => {
  fastify.get('/', async (request, reply) => {
    try {
      return successResponse(await service.getTemplate());
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get workflow template'));
    }
  });

  fastify.put('/', async (request, reply) => {
    try {
      const template = await service.updateTemplate((request.body as Parameters<WorkflowTemplateService['updateTemplate']>[0]) || buildValidWorkflowTemplateFallback());
      return successResponse(template, 'Workflow template updated');
    } catch (error) {
      request.log.error(error);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to update workflow template'));
    }
  });
};

const iterationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: QueryWithProjectId }>('/', async (request, reply) => {
    try {
      const { project_id } = request.query;
      if (!project_id) {
        reply.code(400);
        return errorResponse('project_id is required');
      }
      return successResponse(await iterationService.getByProject(parseNumber(project_id)));
    } catch (error) {
      request.log.error(error);
      return errorResponse('Failed to get iterations');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const iteration = await iterationService.getByIdWithStats(parseNumber(request.params.id));
      if (!iteration) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(iteration);
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get iteration');
    }
  });

  fastify.get<{ Params: ParamsWithId }>('/:id/tasks', async (request, reply) => {
    try {
      const iterationId = parseNumber(request.params.id);
      if (!(await iterationService.exists(iterationId))) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(await iterationService.getTasks(iterationId));
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to get iteration tasks');
    }
  });

  fastify.post('/', async (request, reply) => {
    try {
      const iteration = await iterationService.create(request.body as Record<string, unknown>);
      return successResponse(iteration, 'Iteration created successfully');
    } catch (error) {
      request.log.error(error);
      const statusCode = getStatusCode(error);
      if (statusCode === 400) {
        reply.code(400);
        return errorResponse(getErrorMessage(error, 'Failed to create iteration'));
      }
      reply.code(500);
      return errorResponse('Failed to create iteration');
    }
  });

  fastify.put<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const updated = await iterationService.update(parseNumber(request.params.id), request.body as Record<string, unknown>);
      if (!updated) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(updated, 'Iteration updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update iteration');
    }
  });

  fastify.patch<{ Params: ParamsWithId; Body: StatusBody }>('/:id/status', async (request, reply) => {
    try {
      const { status } = request.body;
      if (!status) {
        reply.code(400);
        return errorResponse('Status is required');
      }
      const updated = await iterationService.updateStatus(parseNumber(request.params.id), status);
      if (!updated) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(updated, 'Iteration status updated successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to update iteration status');
    }
  });

  fastify.delete<{ Params: ParamsWithId }>('/:id', async (request, reply) => {
    try {
      const deleted = await iterationService.delete(parseNumber(request.params.id));
      if (!deleted) {
        reply.code(404);
        return errorResponse('Iteration not found');
      }
      return successResponse(null, 'Iteration deleted successfully');
    } catch (error) {
      request.log.error(error);
      reply.code(500);
      return errorResponse('Failed to delete iteration');
    }
  });
};

export {
  agentRoutes,
  executionRoutes,
  iterationRoutes,
  memberRoutes,
  projectRoutes,
  roleRoutes,
  sessionRoutes,
  taskRoutes,
  taskSourceRoutes,
  workflowRoutes,
  workflowTemplateRoutes,
};
