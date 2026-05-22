import type { Client } from '@libsql/client';
import { getDbClient } from '../db/client.js';

export const ALLOWED_WINDOW_DAYS = [7, 14, 30, 90] as const;
export type WindowDays = typeof ALLOWED_WINDOW_DAYS[number];
export const DEFAULT_WINDOW_DAYS: WindowDays = 7;
export const TREND_WINDOW_DAYS = 30;

export interface ScopeFilter {
  teamId?: number | null;
  projectId?: number | null;
  agentId?: number | null;
  windowDays?: WindowDays;
}

function recentExpr(days: number): string {
  return `-${days} days`;
}

function trendStartExpr(days: number): string {
  return `-${days - 1} days`;
}

export interface TaskStatusCounts {
  todo: number;
  inProgress: number;
  done: number;
  requirements: number;
  blocked: number;
  cancelled: number;
  total: number;
}

export interface SessionStats {
  running: number;
  idle: number;
  recent7d: number;
  total: number;
}

export interface WorkflowStats {
  running: number;
  suspended: number;
  recent7dCompleted: number;
  recent7dFailed: number;
  total: number;
}

export interface AgentLeaderboardEntry {
  agentId: number;
  name: string;
  sessionsTotal: number;
  sessionsRecent7d: number;
  successRate: number;
}

export interface ProjectLeaderboardEntry {
  projectId: number;
  name: string;
  tasksTotal: number;
  sessionsTotal: number;
  sessionsRecent7d: number;
}

export interface TeamLeaderboardEntry {
  teamId: number;
  name: string;
  projectCount: number;
  tasksTotal: number;
  sessionsRecent7d: number;
}

export interface TrendEntry {
  date: string;
  sessionsStarted: number;
  tasksCompleted: number;
  workflowsCompleted: number;
}

export interface RecentSessionEntry {
  id: number;
  taskId: number;
  taskTitle: string | null;
  projectId: number | null;
  projectName: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentProjectBreakdownEntry {
  projectId: number;
  name: string;
  sessionsTotal: number;
  sessionsRecent7d: number;
}

export interface AgentTeamBreakdownEntry {
  teamId: number;
  name: string;
  sessionsTotal: number;
  sessionsRecent7d: number;
}

export interface TeamProjectBreakdownEntry {
  projectId: number;
  name: string;
  tasksTotal: number;
  sessionsTotal: number;
  sessionsRecent7d: number;
}

const LEADERBOARD_LIMIT = 10;
const RECENT_SESSIONS_LIMIT = 10;

export class DashboardRepository {
  private client: Client;

  constructor(client?: Client) {
    this.client = client ?? getDbClient();
  }

  async getTaskStatusCounts(scope: ScopeFilter): Promise<TaskStatusCounts> {
    const result = await this.client.execute({
      sql: `
        SELECT
          SUM(CASE WHEN status = 'TODO'         THEN 1 ELSE 0 END) AS todo,
          SUM(CASE WHEN status = 'IN_PROGRESS'  THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN status = 'DONE'         THEN 1 ELSE 0 END) AS done,
          SUM(CASE WHEN status = 'REQUIREMENTS' THEN 1 ELSE 0 END) AS requirements,
          SUM(CASE WHEN status = 'BLOCKED'      THEN 1 ELSE 0 END) AS blocked,
          SUM(CASE WHEN status = 'CANCELLED'    THEN 1 ELSE 0 END) AS cancelled,
          COUNT(*) AS total
        FROM tasks
        WHERE (? IS NULL OR project_id = ?)
          AND (? IS NULL OR project_id IN (SELECT id FROM projects WHERE team_id = ?))
      `,
      args: [
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId ?? null, scope.teamId ?? null,
      ],
    });
    const row = result.rows[0] ?? {};
    return {
      todo:         Number(row.todo ?? 0),
      inProgress:   Number(row.in_progress ?? 0),
      done:         Number(row.done ?? 0),
      requirements: Number(row.requirements ?? 0),
      blocked:      Number(row.blocked ?? 0),
      cancelled:    Number(row.cancelled ?? 0),
      total:        Number(row.total ?? 0),
    };
  }

  async getSessionStats(scope: ScopeFilter): Promise<SessionStats> {
    const window = recentExpr(scope.windowDays ?? DEFAULT_WINDOW_DAYS);
    const result = await this.client.execute({
      sql: `
        SELECT
          SUM(CASE WHEN s.status = 'RUNNING' THEN 1 ELSE 0 END) AS running,
          SUM(CASE WHEN s.status = 'IDLE'    THEN 1 ELSE 0 END) AS idle,
          SUM(CASE WHEN s.started_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS recent7d,
          COUNT(*) AS total
        FROM sessions s
        JOIN tasks t ON t.id = s.task_id
        WHERE (? IS NULL OR s.agent_id = ?)
          AND (? IS NULL OR t.project_id = ?)
          AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
      `,
      args: [
        window,
        scope.agentId   ?? null, scope.agentId   ?? null,
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId    ?? null, scope.teamId    ?? null,
      ],
    });
    const row = result.rows[0] ?? {};
    return {
      running:  Number(row.running  ?? 0),
      idle:     Number(row.idle     ?? 0),
      recent7d: Number(row.recent7d ?? 0),
      total:    Number(row.total    ?? 0),
    };
  }

  async getWorkflowStats(scope: ScopeFilter): Promise<WorkflowStats> {
    const window = recentExpr(scope.windowDays ?? DEFAULT_WINDOW_DAYS);
    const result = await this.client.execute({
      sql: `
        SELECT
          SUM(CASE WHEN wr.status = 'RUNNING'   THEN 1 ELSE 0 END) AS running,
          SUM(CASE WHEN wr.status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended,
          SUM(CASE WHEN wr.status = 'COMPLETED' AND wr.updated_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS rc,
          SUM(CASE WHEN wr.status = 'FAILED'    AND wr.updated_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS rf,
          COUNT(*) AS total
        FROM workflow_runs wr
        JOIN tasks t ON t.id = wr.task_id
        WHERE (? IS NULL OR t.project_id = ?)
          AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
      `,
      args: [
        window, window,
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId ?? null, scope.teamId ?? null,
      ],
    });
    const row = result.rows[0] ?? {};
    return {
      running:           Number(row.running   ?? 0),
      suspended:         Number(row.suspended ?? 0),
      recent7dCompleted: Number(row.rc        ?? 0),
      recent7dFailed:    Number(row.rf        ?? 0),
      total:             Number(row.total     ?? 0),
    };
  }

  async getAgentLeaderboard(scope: ScopeFilter): Promise<AgentLeaderboardEntry[]> {
    const window = recentExpr(scope.windowDays ?? DEFAULT_WINDOW_DAYS);
    const result = await this.client.execute({
      sql: `
        SELECT s.agent_id AS agent_id, a.name AS name,
               COUNT(*) AS total,
               SUM(CASE WHEN s.started_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS recent7d,
               AVG(CASE WHEN s.status = 'COMPLETED' THEN 1.0
                        WHEN s.status = 'FAILED'    THEN 0.0
                        ELSE NULL END) AS success_rate
        FROM sessions s
        JOIN agents a ON a.id = s.agent_id
        JOIN tasks  t ON t.id = s.task_id
        WHERE s.agent_id IS NOT NULL
          AND (? IS NULL OR t.project_id = ?)
          AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
        GROUP BY s.agent_id, a.name
        ORDER BY total DESC
        LIMIT ${LEADERBOARD_LIMIT}
      `,
      args: [
        window,
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId    ?? null, scope.teamId    ?? null,
      ],
    });
    return result.rows.map(r => ({
      agentId:           Number(r.agent_id),
      name:              String(r.name),
      sessionsTotal:     Number(r.total),
      sessionsRecent7d:  Number(r.recent7d),
      successRate:       r.success_rate === null ? 0 : Number(r.success_rate),
    }));
  }

  async getProjectLeaderboard(scope: ScopeFilter): Promise<ProjectLeaderboardEntry[]> {
    const window = recentExpr(scope.windowDays ?? DEFAULT_WINDOW_DAYS);
    const result = await this.client.execute({
      sql: `
        SELECT p.id AS project_id, p.name AS name,
               (SELECT COUNT(*) FROM tasks    WHERE project_id = p.id) AS tasks_total,
               (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id = s.task_id
                  WHERE t.project_id = p.id) AS sessions_total,
               (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id = s.task_id
                  WHERE t.project_id = p.id AND s.started_at >= datetime('now', ?)) AS sessions_recent7d
        FROM projects p
        WHERE (? IS NULL OR p.id = ?)
          AND (? IS NULL OR p.team_id = ?)
        ORDER BY sessions_total DESC, tasks_total DESC
        LIMIT ${LEADERBOARD_LIMIT}
      `,
      args: [
        window,
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId    ?? null, scope.teamId    ?? null,
      ],
    });
    return result.rows.map(r => ({
      projectId:         Number(r.project_id),
      name:              String(r.name),
      tasksTotal:        Number(r.tasks_total),
      sessionsTotal:     Number(r.sessions_total),
      sessionsRecent7d:  Number(r.sessions_recent7d),
    }));
  }

  async getTeamLeaderboard(scope: ScopeFilter): Promise<TeamLeaderboardEntry[]> {
    const window = recentExpr(scope.windowDays ?? DEFAULT_WINDOW_DAYS);
    const result = await this.client.execute({
      sql: `
        SELECT tm.id AS team_id, tm.name AS name,
               (SELECT COUNT(*) FROM projects WHERE team_id = tm.id) AS project_count,
               (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id
                  WHERE p.team_id = tm.id) AS tasks_total,
               (SELECT COUNT(*) FROM sessions s
                  JOIN tasks    t ON t.id = s.task_id
                  JOIN projects p ON p.id = t.project_id
                  WHERE p.team_id = tm.id AND s.started_at >= datetime('now', ?)) AS sessions_recent7d
        FROM teams tm
        WHERE (? IS NULL OR tm.id = ?)
        ORDER BY sessions_recent7d DESC, tasks_total DESC
        LIMIT ${LEADERBOARD_LIMIT}
      `,
      args: [window, scope.teamId ?? null, scope.teamId ?? null],
    });
    return result.rows.map(r => ({
      teamId:           Number(r.team_id),
      name:             String(r.name),
      projectCount:     Number(r.project_count),
      tasksTotal:       Number(r.tasks_total),
      sessionsRecent7d: Number(r.sessions_recent7d),
    }));
  }

  async getTrend(scope: ScopeFilter): Promise<TrendEntry[]> {
    const days = scope.windowDays ?? DEFAULT_WINDOW_DAYS;
    const start = trendStartExpr(days);
    const a = scope.agentId   ?? null;
    const p = scope.projectId ?? null;
    const t = scope.teamId    ?? null;
    const result = await this.client.execute({
      sql: `
        WITH RECURSIVE days(d) AS (
          SELECT date('now', ?)
          UNION ALL SELECT date(d,'+1 day') FROM days WHERE d < date('now')
        )
        SELECT d AS date,
          (SELECT COUNT(*)
             FROM sessions s JOIN tasks t ON t.id = s.task_id
            WHERE date(s.started_at) = d
              AND (? IS NULL OR s.agent_id = ?)
              AND (? IS NULL OR t.project_id = ?)
              AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
          ) AS sessions_started,
          (SELECT COUNT(DISTINCT t.id)
             FROM tasks t
            WHERE date(t.updated_at) = d AND t.status = 'DONE'
              AND (? IS NULL OR EXISTS (SELECT 1 FROM sessions s2 WHERE s2.task_id = t.id AND s2.agent_id = ?))
              AND (? IS NULL OR t.project_id = ?)
              AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
          ) AS tasks_completed,
          (SELECT COUNT(*)
             FROM workflow_runs wr JOIN tasks t ON t.id = wr.task_id
            WHERE date(wr.updated_at) = d AND wr.status = 'COMPLETED'
              AND (? IS NULL OR EXISTS (SELECT 1 FROM sessions s3 WHERE s3.task_id = wr.task_id AND s3.agent_id = ?))
              AND (? IS NULL OR t.project_id = ?)
              AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
          ) AS workflows_completed
        FROM days
        ORDER BY d ASC
      `,
      args: [
        start,
        a, a, p, p, t, t,
        a, a, p, p, t, t,
        a, a, p, p, t, t,
      ],
    });
    return result.rows.map(r => ({
      date:               String(r.date),
      sessionsStarted:    Number(r.sessions_started),
      tasksCompleted:     Number(r.tasks_completed),
      workflowsCompleted: Number(r.workflows_completed),
    }));
  }

  /** @deprecated use getTrend */
  async getTrend30d(scope: ScopeFilter): Promise<TrendEntry[]> {
    return this.getTrend(scope);
  }

  async getRecentSessionsForAgent(agentId: number, limit = RECENT_SESSIONS_LIMIT): Promise<RecentSessionEntry[]> {
    const result = await this.client.execute({
      sql: `
        SELECT s.id AS id, s.task_id AS task_id, t.title AS task_title,
               t.project_id AS project_id, p.name AS project_name,
               s.status AS status, s.started_at AS started_at, s.completed_at AS completed_at
        FROM sessions s
        JOIN tasks t ON t.id = s.task_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE s.agent_id = ?
        ORDER BY COALESCE(s.started_at, s.completed_at) DESC
        LIMIT ?
      `,
      args: [agentId, limit],
    });
    return result.rows.map(r => ({
      id:           Number(r.id),
      taskId:       Number(r.task_id),
      taskTitle:    r.task_title === null ? null : String(r.task_title),
      projectId:    r.project_id === null ? null : Number(r.project_id),
      projectName:  r.project_name === null ? null : String(r.project_name),
      status:       String(r.status),
      startedAt:    r.started_at   === null ? null : String(r.started_at),
      completedAt:  r.completed_at === null ? null : String(r.completed_at),
    }));
  }

  async getAgentBreakdownByProject(agentId: number, windowDays: WindowDays = DEFAULT_WINDOW_DAYS): Promise<AgentProjectBreakdownEntry[]> {
    const window = recentExpr(windowDays);
    const result = await this.client.execute({
      sql: `
        SELECT p.id AS project_id, p.name AS name,
               COUNT(*) AS sessions_total,
               SUM(CASE WHEN s.started_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS sessions_recent7d
        FROM sessions s
        JOIN tasks t ON t.id = s.task_id
        JOIN projects p ON p.id = t.project_id
        WHERE s.agent_id = ?
        GROUP BY p.id, p.name
        ORDER BY sessions_total DESC
        LIMIT ${LEADERBOARD_LIMIT}
      `,
      args: [window, agentId],
    });
    return result.rows.map(r => ({
      projectId:        Number(r.project_id),
      name:             String(r.name),
      sessionsTotal:    Number(r.sessions_total),
      sessionsRecent7d: Number(r.sessions_recent7d),
    }));
  }

  async getAgentBreakdownByTeam(agentId: number, windowDays: WindowDays = DEFAULT_WINDOW_DAYS): Promise<AgentTeamBreakdownEntry[]> {
    const window = recentExpr(windowDays);
    const result = await this.client.execute({
      sql: `
        SELECT tm.id AS team_id, tm.name AS name,
               COUNT(*) AS sessions_total,
               SUM(CASE WHEN s.started_at >= datetime('now', ?) THEN 1 ELSE 0 END) AS sessions_recent7d
        FROM sessions s
        JOIN tasks t ON t.id = s.task_id
        JOIN projects p ON p.id = t.project_id
        JOIN teams tm ON tm.id = p.team_id
        WHERE s.agent_id = ?
        GROUP BY tm.id, tm.name
        ORDER BY sessions_total DESC
        LIMIT ${LEADERBOARD_LIMIT}
      `,
      args: [window, agentId],
    });
    return result.rows.map(r => ({
      teamId:           Number(r.team_id),
      name:             String(r.name),
      sessionsTotal:    Number(r.sessions_total),
      sessionsRecent7d: Number(r.sessions_recent7d),
    }));
  }

  async getTeamProjectBreakdown(teamId: number, windowDays: WindowDays = DEFAULT_WINDOW_DAYS): Promise<TeamProjectBreakdownEntry[]> {
    const window = recentExpr(windowDays);
    const result = await this.client.execute({
      sql: `
        SELECT p.id AS project_id, p.name AS name,
               (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) AS tasks_total,
               (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id = s.task_id
                  WHERE t.project_id = p.id) AS sessions_total,
               (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id = s.task_id
                  WHERE t.project_id = p.id AND s.started_at >= datetime('now', ?)) AS sessions_recent7d
        FROM projects p
        WHERE p.team_id = ?
        ORDER BY sessions_total DESC, tasks_total DESC
      `,
      args: [window, teamId],
    });
    return result.rows.map(r => ({
      projectId:        Number(r.project_id),
      name:             String(r.name),
      tasksTotal:       Number(r.tasks_total),
      sessionsTotal:    Number(r.sessions_total),
      sessionsRecent7d: Number(r.sessions_recent7d),
    }));
  }
}

export const dashboardRepository = new DashboardRepository();
