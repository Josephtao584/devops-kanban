import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { createClient, type Client } from '@libsql/client';
import { migrateSchema } from '../../src/db/migrate.js';

function createTempDb(): { client: Client; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-test-'));
  const client = createClient({ url: `file:${path.join(dir, 'test.db')}` });
  return {
    client,
    cleanup: () => {
      try {
        client.close();
      } catch (_) {
        // Ignore close errors
      }
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (_) {
        // Ignore cleanup errors
      }
    },
  };
}

function extractCreateTableSql(sql: string): string {
  const matches = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?\);/gi);
  return matches ? matches.join('\n\n') : '';
}

function extractCreateIndexSql(sql: string): string {
  const matches = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+\w+\([^)]+\);/gi);
  return matches ? matches.join('\n\n') : '';
}

async function applySchema(client: Client): Promise<void> {
  const schemaPath = path.join(import.meta.dirname, '../../src/db/schema.sql');
  const schemaSql = await fsPromises.readFile(schemaPath, 'utf-8');

  const tableSql = extractCreateTableSql(schemaSql);
  if (tableSql) {
    await client.executeMultiple(tableSql);
  }

  await migrateSchema(client, schemaSql);

  const indexSql = extractCreateIndexSql(schemaSql);
  if (indexSql) {
    await client.executeMultiple(indexSql);
  }
}

async function seedFixtures(client: Client) {
  await client.execute(`INSERT INTO projects (id, name, team_id) VALUES
    (1, 'Project A', 1),
    (2, 'Project B', 2)`);
  await client.execute(`INSERT INTO tasks (id, title, project_id, status, priority, source, depends_on, labels) VALUES
    (1, 'Task 1', 1, 'TODO',       'MEDIUM', 'internal', '[]', '[]'),
    (2, 'Task 2', 1, 'IN_PROGRESS','MEDIUM', 'internal', '[]', '[]'),
    (3, 'Task 3', 1, 'DONE',       'MEDIUM', 'internal', '[]', '[]'),
    (4, 'Task 4', 1, 'BLOCKED',    'MEDIUM', 'internal', '[]', '[]'),
    (5, 'Task 5', 2, 'IN_PROGRESS','HIGH',   'internal', '[]', '[]'),
    (6, 'Task 6', 2, 'DONE',       'LOW',    'internal', '[]', '[]')`);
}

async function seedSessions(client: Client) {
  await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
    (1, 1, 1, 'RUNNING',   'CLAUDE_CODE', datetime('now','-1 days')),
    (2, 1, 1, 'RUNNING',   'CLAUDE_CODE', datetime('now','-2 days')),
    (3, 1, 1, 'IDLE',      'CLAUDE_CODE', datetime('now','-3 days')),
    (4, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-5 days')),
    (5, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-30 days'))`);
  await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
    (6, 5, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-2 days'))`);
}

async function seedWorkflowRuns(client: Client) {
  await client.execute(`INSERT INTO workflow_runs (id, task_id, workflow_instance_id, status, worktree_path, branch, updated_at) VALUES
    (1, 1, 'inst-1', 'RUNNING',   '/wt/1', 'b1', datetime('now','-1 days')),
    (2, 1, 'inst-1', 'SUSPENDED', '/wt/2', 'b2', datetime('now','-2 days')),
    (3, 1, 'inst-1', 'COMPLETED', '/wt/3', 'b3', datetime('now','-3 days')),
    (4, 1, 'inst-1', 'FAILED',    '/wt/4', 'b4', datetime('now','-4 days')),
    (5, 5, 'inst-1', 'COMPLETED', '/wt/5', 'b5', datetime('now','-2 days'))`);
}

// --- Repository tests ---

test.test('dashboardRepository.getTaskStatusCounts: global scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const counts = await repo.getTaskStatusCounts({});
    assert.equal(counts.todo, 1);
    assert.equal(counts.inProgress, 2);
    assert.equal(counts.done, 2);
    assert.equal(counts.blocked, 1);
    assert.equal(counts.total, 6);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTaskStatusCounts: teamId scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const counts = await repo.getTaskStatusCounts({ teamId: 2 });
    assert.equal(counts.todo, 0);
    assert.equal(counts.inProgress, 1);
    assert.equal(counts.done, 1);
    assert.equal(counts.total, 2);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTaskStatusCounts: projectId scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const counts = await repo.getTaskStatusCounts({ projectId: 1 });
    assert.equal(counts.todo, 1);
    assert.equal(counts.inProgress, 1);
    assert.equal(counts.done, 1);
    assert.equal(counts.blocked, 1);
    assert.equal(counts.total, 4);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getSessionStats: global scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await seedSessions(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const stats = await repo.getSessionStats({});
    assert.equal(stats.running, 2);
    assert.equal(stats.idle, 1);
    assert.equal(stats.total, 6);
    assert.equal(stats.recent7d, 5);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getSessionStats: teamId=2 scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await seedSessions(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const stats = await repo.getSessionStats({ teamId: 2 });
    assert.equal(stats.total, 1);
    assert.equal(stats.recent7d, 1);
    assert.equal(stats.running, 0);
    assert.equal(stats.idle, 0);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getWorkflowStats: global', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await seedWorkflowRuns(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const stats = await repo.getWorkflowStats({});
    assert.equal(stats.running, 1);
    assert.equal(stats.suspended, 1);
    assert.equal(stats.recent7dCompleted, 2);
    assert.equal(stats.recent7dFailed, 1);
    assert.equal(stats.total, 5);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getAgentLeaderboard: orders by total desc and respects scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO agents (id, name, executorType, role) VALUES (1, 'A1', 'CLAUDE_CODE', 'developer')`);
    await client.execute(`INSERT INTO agents (id, name, executorType, role) VALUES (2, 'A2', 'CLAUDE_CODE', 'developer')`);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (10, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days')),
      (11, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-2 days')),
      (12, 1, 1, 'FAILED',    'CLAUDE_CODE', datetime('now','-3 days')),
      (13, 4, 2, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);

    const top = await repo.getAgentLeaderboard({});
    assert.equal(top.length, 2);
    assert.equal(top[0].agentId, 1);
    assert.equal(top[0].sessionsTotal, 3);
    assert.ok(Math.abs(top[0].successRate - 2/3) < 1e-6);
    assert.equal(top[1].agentId, 2);
    assert.equal(top[1].sessionsTotal, 1);

    const scoped = await repo.getAgentLeaderboard({ projectId: 2 });
    assert.equal(scoped.length, 0);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getProjectLeaderboard: includes session and task counts', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (20, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days')),
      (21, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-2 days')),
      (22, 5, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const top = await repo.getProjectLeaderboard({});
    assert.ok(top.length >= 2);
    const p1 = top.find(p => p.projectId === 1);
    const p2 = top.find(p => p.projectId === 2);
    assert.equal(p1?.sessionsTotal, 2);
    assert.equal(p1?.tasksTotal, 4);
    assert.equal(p2?.sessionsTotal, 1);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTeamLeaderboard: aggregates across team projects', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO teams (id, name) VALUES (1, 'Team Alpha'), (2, 'Team Beta')`);
    await client.execute(`UPDATE projects SET team_id = 1 WHERE id = 1`);
    await client.execute(`UPDATE projects SET team_id = 2 WHERE id = 2`);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (30, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days')),
      (31, 4, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days')),
      (32, 5, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const top = await repo.getTeamLeaderboard({});
    const t1 = top.find(t => t.teamId === 1);
    const t2 = top.find(t => t.teamId === 2);
    assert.equal(t1?.projectCount, 1);
    assert.equal(t1?.tasksTotal, 4);
    assert.equal(t1?.sessionsRecent7d, 2);
    assert.equal(t2?.projectCount, 1);
    assert.equal(t2?.sessionsRecent7d, 1);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTrend30d: returns 30 entries with zeros for empty days', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (40, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    await client.execute(`UPDATE tasks SET status='DONE', updated_at=datetime('now','-1 days') WHERE id=3`);
    await client.execute(`INSERT INTO workflow_runs (id, task_id, workflow_instance_id, status, worktree_path, branch, updated_at) VALUES
      (40, 1, 'inst-1', 'COMPLETED', '/wt/40', 'b40', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const trend = await repo.getTrend30d({ windowDays: 30 });
    assert.equal(trend.length, 30);
    const yesterday = trend[trend.length - 2];
    assert.equal(yesterday.sessionsStarted, 1);
    assert.equal(yesterday.tasksCompleted, 1);
    assert.equal(yesterday.workflowsCompleted, 1);
    assert.equal(trend[0].sessionsStarted, 0);
    assert.equal(trend[0].tasksCompleted, 0);
    assert.equal(trend[0].workflowsCompleted, 0);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTrend respects windowDays (7/14/30/90)', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    assert.equal((await repo.getTrend({ windowDays: 1  })).length, 1);
    assert.equal((await repo.getTrend({ windowDays: 7  })).length, 7);
    assert.equal((await repo.getTrend({ windowDays: 14 })).length, 14);
    assert.equal((await repo.getTrend({ windowDays: 30 })).length, 30);
    assert.equal((await repo.getTrend({ windowDays: 90 })).length, 90);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getSessionStats recent7d uses windowDays', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (50, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-3 days')),
      (51, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-10 days')),
      (52, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-25 days')),
      (53, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-60 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    assert.equal((await repo.getSessionStats({ windowDays: 7  })).recent7d, 1);
    assert.equal((await repo.getSessionStats({ windowDays: 14 })).recent7d, 2);
    assert.equal((await repo.getSessionStats({ windowDays: 30 })).recent7d, 3);
    assert.equal((await repo.getSessionStats({ windowDays: 90 })).recent7d, 4);
  } finally { cleanup(); }
});

// --- Service tests ---

test.test('DashboardService.getOverview composes all sections; resolves scope names', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO teams (id, name) VALUES (1, 'T1'), (2, 'T2')`);
    await client.execute(`UPDATE projects SET team_id = 1 WHERE id IN (1, 2)`);
    await client.execute(`INSERT INTO agents (id, name, executorType, role) VALUES (1, 'A1', 'CLAUDE_CODE', 'developer')`);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (1, 1, 1, 'RUNNING',   'CLAUDE_CODE', datetime('now','-1 days')),
      (2, 1, 1, 'IDLE',      'CLAUDE_CODE', datetime('now','-3 days')),
      (3, 3, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-2 days'))`);
    await client.execute(`INSERT INTO workflow_runs (id, task_id, workflow_instance_id, status, worktree_path, branch, updated_at) VALUES
      (1, 1, 'inst-1', 'COMPLETED', '/wt/1', 'b1', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const svc = new DashboardService(new DashboardRepository(client), client);

    const overview = await svc.getOverview({ teamId: 1, windowDays: 30 });
    assert.equal(overview.scope.teamId, 1);
    assert.equal(overview.scope.teamName, 'T1');
    assert.equal(overview.scope.projectId, null);
    assert.equal(overview.scope.projectName, null);
    assert.equal(typeof overview.sessions.total, 'number');
    assert.equal(typeof overview.tasks.total, 'number');
    assert.equal(typeof overview.workflows.total, 'number');
    assert.ok(Array.isArray(overview.agentTop));
    assert.ok(Array.isArray(overview.projectTop));
    assert.ok(Array.isArray(overview.teamTop));
    assert.equal(overview.trend30d.length, 30);
  } finally { cleanup(); }
});

test.test('DashboardService.getOverview throws NotFoundError for unknown teamId', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const svc = new DashboardService(new DashboardRepository(client), client);
    await assert.rejects(() => svc.getOverview({ teamId: 999 }), /team .* missing/);
  } finally { cleanup(); }
});

test.test('DashboardService.getProjectDetail returns project, team, sessions, tasks, trend', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const svc = new DashboardService(new DashboardRepository(client), client);
    const detail = await svc.getProjectDetail(1, { windowDays: 30 });
    assert.equal((detail.project as any).id, 1);
    assert.equal(detail.tasks.total, 4);
    assert.equal(detail.trend30d.length, 30);
  } finally { cleanup(); }
});

test.test('DashboardService.getTeamDetail aggregates over projects', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO teams (id, name) VALUES (1, 'T1'), (2, 'T2')`);
    await client.execute(`UPDATE projects SET team_id = 1 WHERE id IN (1, 2)`);
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const svc = new DashboardService(new DashboardRepository(client), client);
    const detail = await svc.getTeamDetail(1);
    assert.equal(detail.projectBreakdown.length, 2);
    assert.equal(detail.aggregateTasks.total, 6);
    const project1 = detail.projectBreakdown.find(p => p.projectId === 1);
    assert.equal(project1?.tasksTotal, 4);
  } finally { cleanup(); }
});

test.test('DashboardService.getAgentDetail throws NotFoundError for unknown agent', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const svc = new DashboardService(new DashboardRepository(client), client);
    await assert.rejects(() => svc.getAgentDetail(999, {}), /agent .* missing/);
  } finally { cleanup(); }
});

test.test('DashboardService.getAgentDetail returns sessions filtered by agentId, plus recent/byProject/byTeam', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO teams (id, name) VALUES (1, 'T1'), (2, 'T2')`);
    await client.execute(`UPDATE projects SET team_id = 1 WHERE id = 1`);
    await client.execute(`UPDATE projects SET team_id = 2 WHERE id = 2`);
    await client.execute(`INSERT INTO agents (id, name, executorType, role) VALUES (1, 'A1', 'CLAUDE_CODE', 'developer'), (2, 'A2', 'CLAUDE_CODE', 'developer')`);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (1, 1, 1, 'RUNNING',   'CLAUDE_CODE', datetime('now','-1 days')),
      (2, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-2 days')),
      (3, 5, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-3 days')),
      (4, 1, 2, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const svc = new DashboardService(new DashboardRepository(client), client);

    const detail = await svc.getAgentDetail(1, { windowDays: 30 });
    assert.equal(detail.sessions.total, 3, 'sessions should only count agent 1');
    assert.equal(detail.sessions.running, 1);
    assert.equal(detail.recentSessions.length, 3);
    assert.equal(detail.byProject.length, 2);
    const p1 = detail.byProject.find(b => b.projectId === 1);
    assert.equal(p1?.sessionsTotal, 2);
    const p2 = detail.byProject.find(b => b.projectId === 2);
    assert.equal(p2?.sessionsTotal, 1);
    assert.equal(detail.byTeam.length, 2);
    assert.equal(detail.trend30d.length, 30);
  } finally { cleanup(); }
});
