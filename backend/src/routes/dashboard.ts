import type { FastifyPluginAsync } from 'fastify';
import { dashboardService } from '../services/DashboardService.js';
import {
  ALLOWED_WINDOW_DAYS,
  DEFAULT_WINDOW_DAYS,
  type WindowDays,
} from '../repositories/dashboardRepository.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getStatusCode, getErrorMessage, logError } from '../utils/http.js';

interface OverviewQuery { teamId?: string; projectId?: string; windowDays?: string }

function parseOptionalNumber(v?: string): number | null {
  if (v === undefined || v === '' || v === 'null') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseWindowDays(v?: string): WindowDays {
  if (v === undefined || v === '') return DEFAULT_WINDOW_DAYS;
  const n = Number.parseInt(v, 10);
  return (ALLOWED_WINDOW_DAYS as readonly number[]).includes(n) ? (n as WindowDays) : DEFAULT_WINDOW_DAYS;
}

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: OverviewQuery }>('/overview', async (request, reply) => {
    try {
      const overview = await dashboardService.getOverview({
        teamId:    parseOptionalNumber(request.query.teamId),
        projectId: parseOptionalNumber(request.query.projectId),
        windowDays: parseWindowDays(request.query.windowDays),
      });
      return successResponse(overview);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get dashboard overview'));
    }
  });

  fastify.get<{ Params: { id: string }; Querystring: OverviewQuery }>('/agents/:id', async (request, reply) => {
    try {
      const agentId = parseNumber(request.params.id);
      const detail = await dashboardService.getAgentDetail(agentId, {
        teamId:    parseOptionalNumber(request.query.teamId),
        projectId: parseOptionalNumber(request.query.projectId),
        windowDays: parseWindowDays(request.query.windowDays),
      });
      return successResponse(detail);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get agent detail'));
    }
  });

  fastify.get<{ Params: { id: string }; Querystring: OverviewQuery }>('/projects/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const detail = await dashboardService.getProjectDetail(projectId, {
        windowDays: parseWindowDays(request.query.windowDays),
      });
      return successResponse(detail);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get project detail'));
    }
  });

  fastify.get<{ Params: { id: string }; Querystring: OverviewQuery }>('/teams/:id', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const detail = await dashboardService.getTeamDetail(teamId, {
        windowDays: parseWindowDays(request.query.windowDays),
      });
      return successResponse(detail);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get team detail'));
    }
  });
};
