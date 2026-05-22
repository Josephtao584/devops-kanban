import type { Client } from '@libsql/client';
import { getDbClient } from '../db/client.js';
import { DashboardRepository, type ScopeFilter } from '../repositories/dashboardRepository.js';
import { NotFoundError } from '../utils/errors.js';

const TASKS_RECENT_DONE_WINDOW = '-7 days';

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
      teamName = String(r.rows[0].name);
    }
    if (scope.projectId != null) {
      const r = await this.client.execute({ sql: 'SELECT name FROM projects WHERE id = ?', args: [scope.projectId] });
      if (r.rows.length === 0) throw new NotFoundError('Project not found', `project ${scope.projectId} missing`);
      projectName = String(r.rows[0].name);
    }
    return {
      teamId: scope.teamId ?? null,
      projectId: scope.projectId ?? null,
      teamName,
      projectName,
    };
  }

  async getOverview(scope: ScopeFilter) {
    const resolvedScope = await this.resolveScope(scope);
    const [sessions, tasks, workflows, agentTop, projectTop, teamTop, trend30d] = await Promise.all([
      this.repo.getSessionStats(scope),
      this.getTaskBlock(scope),
      this.repo.getWorkflowStats(scope),
      this.repo.getAgentLeaderboard(scope),
      this.repo.getProjectLeaderboard(scope),
      this.repo.getTeamLeaderboard(scope),
      this.repo.getTrend30d(scope),
    ]);
    return { scope: resolvedScope, sessions, tasks, workflows, agentTop, projectTop, teamTop, trend30d };
  }

  private async getTaskBlock(scope: ScopeFilter) {
    const byStatus = await this.repo.getTaskStatusCounts(scope);
    const recentDoneRow = await this.client.execute({
      sql: `
        SELECT COUNT(*) AS c FROM tasks
        WHERE status = 'DONE' AND updated_at >= datetime('now', ?)
          AND (? IS NULL OR project_id = ?)
          AND (? IS NULL OR project_id IN (SELECT id FROM projects WHERE team_id = ?))
      `,
      args: [
        TASKS_RECENT_DONE_WINDOW,
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId    ?? null, scope.teamId    ?? null,
      ],
    });
    return { byStatus, recent7dDone: Number(recentDoneRow.rows[0]?.c ?? 0), total: byStatus.total };
  }

  async getAgentDetail(agentId: number, scope: ScopeFilter) {
    const agentRow = await this.client.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [agentId] });
    if (agentRow.rows.length === 0) throw new NotFoundError('Agent not found', `agent ${agentId} missing`);
    const sessions = await this.repo.getSessionStats(scope);
    return { agent: agentRow.rows[0], sessions, recentSessions: [], byProject: [], byTeam: [], trend30d: await this.repo.getTrend30d(scope) };
  }

  async getProjectDetail(projectId: number) {
    const p = await this.client.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [projectId] });
    if (p.rows.length === 0) throw new NotFoundError('Project not found', `project ${projectId} missing`);
    const project = p.rows[0];
    let team = null;
    if ((project as any).team_id) {
      const t = await this.client.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [(project as any).team_id] });
      team = t.rows[0] ?? null;
    }
    const scope = { projectId };
    const [sessions, taskBlock, trend30d] = await Promise.all([
      this.repo.getSessionStats(scope),
      this.getTaskBlock(scope),
      this.repo.getTrend30d(scope),
    ]);
    const agentBreakdown = await this.repo.getAgentLeaderboard(scope);
    return { project, team, sessions, tasks: taskBlock, agentBreakdown, recentSessions: [], trend30d };
  }

  async getTeamDetail(teamId: number) {
    const t = await this.client.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [teamId] });
    if (t.rows.length === 0) throw new NotFoundError('Team not found', `team ${teamId} missing`);
    const team = t.rows[0];
    const projects = await this.client.execute({ sql: 'SELECT * FROM projects WHERE team_id = ?', args: [teamId] });
    const scope = { teamId };
    const [aggregateSessions, taskBlock, trend30d, agentBreakdown] = await Promise.all([
      this.repo.getSessionStats(scope),
      this.getTaskBlock(scope),
      this.repo.getTrend30d(scope),
      this.repo.getAgentLeaderboard(scope),
    ]);
    return { team, projects: projects.rows, aggregateSessions, aggregateTasks: taskBlock, agentBreakdown, trend30d };
  }
}

export const dashboardService = new DashboardService();
