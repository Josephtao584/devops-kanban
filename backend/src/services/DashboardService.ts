import type { Client } from '@libsql/client';
import { getDbClient } from '../db/client.js';
import {
  DashboardRepository,
  DEFAULT_WINDOW_DAYS,
  type ScopeFilter,
  type WindowDays,
} from '../repositories/dashboardRepository.js';
import { NotFoundError } from '../utils/errors.js';

export class DashboardService {
  private repo: DashboardRepository;
  private client: Client;

  constructor(repo?: DashboardRepository, client?: Client) {
    this.client = client ?? getDbClient();
    this.repo = repo ?? new DashboardRepository(this.client);
  }

  private async resolveScope(scope: ScopeFilter) {
    let teamName: string | null = null;
    let projectName: string | null = null;
    if (scope.teamId != null) {
      const r = await this.client.execute({ sql: 'SELECT name FROM teams WHERE id = ?', args: [scope.teamId] });
      if (r.rows.length === 0) throw new NotFoundError('Team not found', `team ${scope.teamId} missing`);
      teamName = String(r.rows[0]!.name);
    }
    if (scope.projectId != null) {
      const r = await this.client.execute({ sql: 'SELECT name FROM projects WHERE id = ?', args: [scope.projectId] });
      if (r.rows.length === 0) throw new NotFoundError('Project not found', `project ${scope.projectId} missing`);
      projectName = String(r.rows[0]!.name);
    }
    return {
      teamId: scope.teamId ?? null,
      projectId: scope.projectId ?? null,
      teamName,
      projectName,
      windowDays: scope.windowDays ?? DEFAULT_WINDOW_DAYS,
    };
  }

  async getOverview(scope: ScopeFilter) {
    const resolvedScope = await this.resolveScope(scope);
    const [sessions, tasks, workflows, agentTop, projectTop, teamTop, trend, prevPeriod] = await Promise.all([
      this.repo.getSessionStats(scope),
      this.getTaskBlock(scope),
      this.repo.getWorkflowStats(scope),
      this.repo.getAgentLeaderboard(scope),
      this.repo.getProjectLeaderboard(scope),
      this.repo.getTeamLeaderboard(scope),
      this.repo.getTrend(scope),
      this.repo.getPrevPeriodCounts(scope),
    ]);
    return { scope: resolvedScope, sessions, tasks, workflows, agentTop, projectTop, teamTop, trend30d: trend, prevPeriod };
  }

  private async getTaskBlock(scope: ScopeFilter) {
    const days = scope.windowDays ?? DEFAULT_WINDOW_DAYS;
    const window = `-${days} days`;
    const byStatus = await this.repo.getTaskStatusCounts(scope);
    const recentDoneRow = await this.client.execute({
      sql: `
        SELECT COUNT(*) AS c FROM tasks
        WHERE status = 'DONE' AND updated_at >= datetime('now', ?)
          AND (? IS NULL OR project_id = ?)
          AND (? IS NULL OR project_id IN (SELECT id FROM projects WHERE team_id = ?))
      `,
      args: [
        window,
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId    ?? null, scope.teamId    ?? null,
      ],
    });
    return { byStatus, recent7dDone: Number(recentDoneRow.rows[0]?.c ?? 0), total: byStatus.total };
  }

  async getAgentDetail(agentId: number, scope: ScopeFilter) {
    const agentRow = await this.client.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [agentId] });
    if (agentRow.rows.length === 0) throw new NotFoundError('Agent not found', `agent ${agentId} missing`);
    const windowDays: WindowDays = scope.windowDays ?? DEFAULT_WINDOW_DAYS;
    const agentScope: ScopeFilter = { ...scope, agentId };
    const [sessions, trend, recentSessions, byProject, byTeam] = await Promise.all([
      this.repo.getSessionStats(agentScope),
      this.repo.getTrend(agentScope),
      this.repo.getRecentSessionsForAgent(agentId),
      this.repo.getAgentBreakdownByProject(agentId, windowDays),
      this.repo.getAgentBreakdownByTeam(agentId, windowDays),
    ]);
    return { agent: agentRow.rows[0], sessions, recentSessions, byProject, byTeam, trend30d: trend, windowDays };
  }

  async getProjectDetail(projectId: number, scope: ScopeFilter = {}) {
    const p = await this.client.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [projectId] });
    if (p.rows.length === 0) throw new NotFoundError('Project not found', `project ${projectId} missing`);
    const project = p.rows[0]!;
    const teamId = project.team_id == null ? null : Number(project.team_id);
    let team = null;
    if (teamId != null) {
      const t = await this.client.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [teamId] });
      team = t.rows[0] ?? null;
    }
    const windowDays: WindowDays = scope.windowDays ?? DEFAULT_WINDOW_DAYS;
    const projectScope: ScopeFilter = { projectId, windowDays };
    const [sessions, taskBlock, trend, agentBreakdown] = await Promise.all([
      this.repo.getSessionStats(projectScope),
      this.getTaskBlock(projectScope),
      this.repo.getTrend(projectScope),
      this.repo.getAgentLeaderboard(projectScope),
    ]);
    return { project, team, sessions, tasks: taskBlock, agentBreakdown, trend30d: trend, windowDays };
  }

  async getTeamDetail(teamId: number, scope: ScopeFilter = {}) {
    const t = await this.client.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [teamId] });
    if (t.rows.length === 0) throw new NotFoundError('Team not found', `team ${teamId} missing`);
    const team = t.rows[0];
    const windowDays: WindowDays = scope.windowDays ?? DEFAULT_WINDOW_DAYS;
    const teamScope: ScopeFilter = { teamId, windowDays };
    const [aggregateSessions, taskBlock, trend, agentBreakdown, projectBreakdown] = await Promise.all([
      this.repo.getSessionStats(teamScope),
      this.getTaskBlock(teamScope),
      this.repo.getTrend(teamScope),
      this.repo.getAgentLeaderboard(teamScope),
      this.repo.getTeamProjectBreakdown(teamId, windowDays),
    ]);
    return { team, projectBreakdown, aggregateSessions, aggregateTasks: taskBlock, agentBreakdown, trend30d: trend, windowDays };
  }
}

export const dashboardService = new DashboardService();
