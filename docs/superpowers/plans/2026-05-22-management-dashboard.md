# 管理看板（Management Dashboard）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个给运营/管理者使用的看板页面 `/dashboard`，主页展示 Session/任务/Workflow 总体指标、Agent/项目/团队 Top10 排行、近 30 天趋势，并提供 Agent / 项目 / 团队三类明细页；支持团队+项目两级联动 scope 过滤；进页加载一次 + 手动刷新。

**Architecture:** 后端走现有 Routes → Services → Repositories 分层，新增 `routes/dashboard.ts` + `services/DashboardService.ts` + `repositories/dashboardRepository.ts`，单端点一次返回主页所需的全部聚合数据；明细页各自一个端点。前端新增 4 个 view + 5 个 dashboard 组件 + 1 个 axios 封装；图表用 echarts 5（按需引入 line + pie）。

**Tech Stack:** Backend: Fastify 4 + LibSQL + tsx + Node test runner。Frontend: Vue 3 + Vite 5 + Element Plus + Pinia + vue-i18n + Vitest + echarts ^5.5.0（新增）。

**Spec:** `docs/superpowers/specs/2026-05-22-management-dashboard-design.md`

---

## File Structure

### 后端新增

| 文件 | 责任 |
|---|---|
| `backend/src/repositories/dashboardRepository.ts` | 跨表聚合 SQL：任务状态分布、Agent/项目/团队 Top、30 天趋势、明细页查询 |
| `backend/src/services/DashboardService.ts` | 调度 repository、组合 overview/detail 响应、scope 过滤、错误归一化 |
| `backend/src/routes/dashboard.ts` | 4 个 GET 路由：`/overview`、`/agents/:id`、`/projects/:id`、`/teams/:id` |
| `backend/test/services/dashboardService.test.ts` | 用内存 LibSQL fixtures 验证聚合逻辑 |

### 后端修改

| 文件 | 改动 |
|---|---|
| `backend/src/routes/index.ts` | 导出 `dashboardRoutes` |
| `backend/src/app.ts` | `fastify.register(dashboardRoutes, { prefix: '/api/dashboard' })` |

### 前端新增

| 文件 | 责任 |
|---|---|
| `frontend/src/api/dashboard.js` | axios 封装：`getOverview`、`getAgentDetail`、`getProjectDetail`、`getTeamDetail` |
| `frontend/src/components/dashboard/ScopeSelector.vue` | 团队 + 项目 两级联动下拉 |
| `frontend/src/components/dashboard/MetricCard.vue` | 通用「近期 + 累计」双数字卡 |
| `frontend/src/components/dashboard/LeaderboardCard.vue` | 通用 Top N 列表，行项可点击 |
| `frontend/src/components/dashboard/TrendChart.vue` | 30 天折线（echarts） |
| `frontend/src/components/dashboard/StatusDistribution.vue` | 任务状态环形（echarts pie） |
| `frontend/src/views/DashboardView.vue` | 主页 |
| `frontend/src/views/DashboardAgentDetailView.vue` | Agent 明细页 |
| `frontend/src/views/DashboardProjectDetailView.vue` | 项目明细页 |
| `frontend/src/views/DashboardTeamDetailView.vue` | 团队明细页 |
| `frontend/src/components/dashboard/__tests__/ScopeSelector.spec.js` | 单元测试 |
| `frontend/src/components/dashboard/__tests__/MetricCard.spec.js` | 单元测试 |
| `frontend/src/components/dashboard/__tests__/LeaderboardCard.spec.js` | 单元测试 |
| `frontend/src/views/__tests__/DashboardView.spec.js` | 主视图集成测试 |

### 前端修改

| 文件 | 改动 |
|---|---|
| `frontend/package.json` | 新增 `"echarts": "^5.5.0"` |
| `frontend/src/router/index.js` | 4 条新路由 |
| `frontend/src/App.vue` | 新增「运营 / 管理」分组 + 「看板」入口 |
| `frontend/src/locales/zh.js` | i18n key（dashboard.* + nav.*） |
| `frontend/src/locales/en.js` | i18n key 英文翻译 |

---

## Task 顺序与依赖

阶段 A — 后端聚合（Task 1–6）
阶段 B — 后端路由（Task 7）
阶段 C — 前端依赖与 API 封装（Task 8–9）
阶段 D — 前端通用组件（Task 10–13）
阶段 E — 前端主视图与明细视图（Task 14–17）
阶段 F — 路由与导航（Task 18–19）
阶段 G — 端到端冒烟（Task 20）

每个 Task 自带 RED → GREEN → COMMIT 步骤；后端走 Node test runner（`npm test`），前端走 Vitest（`npm run test:run`）。

---

## Task 1: dashboardRepository — 任务状态分布

**Files:**
- Create: `backend/src/repositories/dashboardRepository.ts`
- Test: `backend/test/services/dashboardService.test.ts` （本任务先写 fixtures helper + 第一个测试）

- [ ] **Step 1: 写失败测试 — 任务状态分布**

`backend/test/services/dashboardService.test.ts`：

```ts
import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import { createClient, type Client } from '@libsql/client';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFileSync } from 'fs';

// 用临时 DB 隔离每个测试文件
function createTempDb(): { client: Client; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'dashboard-test-'));
  const client = createClient({ url: `file:${join(dir, 'test.db')}` });
  return {
    client,
    cleanup: () => {
      try { client.close(); } catch {}
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function applySchema(client: Client) {
  const sql = readFileSync(new URL('../../src/db/schema.sql', import.meta.url), 'utf-8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
}

async function seedFixtures(client: Client) {
  // 2 teams, 3 projects (p1,p2 in t1; p3 in t2), 1 agent
  await client.execute(`INSERT INTO teams (id, name) VALUES (1, 'T1'), (2, 'T2')`);
  await client.execute(`INSERT INTO projects (id, name, team_id) VALUES (1, 'P1', 1), (2, 'P2', 1), (3, 'P3', 2)`);
  await client.execute(`INSERT INTO agents (id, name, executorType, role) VALUES (1, 'A1', 'CLAUDE_CODE', 'developer')`);
  // tasks: p1 has 2 TODO + 1 DONE; p2 has 1 IN_PROGRESS; p3 has 1 BLOCKED
  await client.execute(`INSERT INTO tasks (id, title, project_id, status) VALUES
    (1, 't1', 1, 'TODO'), (2, 't2', 1, 'TODO'), (3, 't3', 1, 'DONE'),
    (4, 't4', 2, 'IN_PROGRESS'),
    (5, 't5', 3, 'BLOCKED')`);
}

test.test('dashboardRepository.getTaskStatusCounts: global scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const counts = await repo.getTaskStatusCounts({});
    assert.equal(counts.TODO, 2);
    assert.equal(counts.DONE, 1);
    assert.equal(counts.IN_PROGRESS, 1);
    assert.equal(counts.BLOCKED, 1);
    assert.equal(counts.CANCELLED, 0);
    assert.equal(counts.REQUIREMENTS, 0);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: 运行测试，确认失败**

```
cd backend && npm test -- --test-name-pattern="dashboardRepository.getTaskStatusCounts: global scope"
```

期望：`Cannot find module ... dashboardRepository.js`。

- [ ] **Step 3: 写最小实现**

`backend/src/repositories/dashboardRepository.ts`：

```ts
import type { Client } from '@libsql/client';
import { getDbClient } from '../db/client.js';

export interface ScopeFilter {
  teamId?: number | null;
  projectId?: number | null;
}

export interface TaskStatusCounts {
  REQUIREMENTS: number;
  TODO: number;
  IN_PROGRESS: number;
  DONE: number;
  BLOCKED: number;
  CANCELLED: number;
}

const EMPTY_COUNTS: TaskStatusCounts = {
  REQUIREMENTS: 0, TODO: 0, IN_PROGRESS: 0, DONE: 0, BLOCKED: 0, CANCELLED: 0,
};

export class DashboardRepository {
  private client: Client;

  constructor(client?: Client) {
    this.client = client ?? getDbClient();
  }

  async getTaskStatusCounts(scope: ScopeFilter): Promise<TaskStatusCounts> {
    const result = await this.client.execute({
      sql: `
        SELECT status, COUNT(*) AS c
        FROM tasks
        WHERE (? IS NULL OR project_id = ?)
          AND (? IS NULL OR project_id IN (SELECT id FROM projects WHERE team_id = ?))
        GROUP BY status
      `,
      args: [
        scope.projectId ?? null, scope.projectId ?? null,
        scope.teamId ?? null, scope.teamId ?? null,
      ],
    });
    const counts: TaskStatusCounts = { ...EMPTY_COUNTS };
    for (const row of result.rows) {
      const status = row.status as keyof TaskStatusCounts;
      if (status in counts) counts[status] = Number(row.c);
    }
    return counts;
  }
}

export const dashboardRepository = new DashboardRepository();
```

- [ ] **Step 4: 运行测试，确认通过**

```
cd backend && npm test -- --test-name-pattern="dashboardRepository.getTaskStatusCounts: global scope"
```

期望：1 passing。

- [ ] **Step 5: 增加 teamId / projectId scope 测试并通过**

在测试文件追加：

```ts
test.test('dashboardRepository.getTaskStatusCounts: teamId scope filters out other teams', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const counts = await repo.getTaskStatusCounts({ teamId: 2 });
    assert.equal(counts.BLOCKED, 1);
    assert.equal(counts.TODO, 0);
    assert.equal(counts.DONE, 0);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTaskStatusCounts: projectId narrows further', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const counts = await repo.getTaskStatusCounts({ projectId: 1 });
    assert.equal(counts.TODO, 2);
    assert.equal(counts.DONE, 1);
    assert.equal(counts.IN_PROGRESS, 0);
  } finally { cleanup(); }
});
```

运行：`npm test -- --test-name-pattern="getTaskStatusCounts"`，期望 3 passing。

- [ ] **Step 6: 提交**

```bash
cd /Users/taowenpeng/IdeaProjects/devops-kanban
git add backend/src/repositories/dashboardRepository.ts backend/test/services/dashboardService.test.ts
git commit -m "feat(backend): add dashboardRepository with task status counts"
```

---

## Task 2: dashboardRepository — Session 总览

**Files:**
- Modify: `backend/src/repositories/dashboardRepository.ts`
- Modify: `backend/test/services/dashboardService.test.ts`

- [ ] **Step 1: 写失败测试**

在 `seedFixtures` 中追加 sessions（注意 `started_at` 用 `datetime('now', '-N days')` 设置不同时间）：

```ts
async function seedSessions(client: Client) {
  // 5 sessions on task 1 (project 1): 2 RUNNING, 1 IDLE, 2 COMPLETED；其中 4 个在 7 天内
  await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
    (1, 1, 1, 'RUNNING',   'CLAUDE_CODE', datetime('now','-1 days')),
    (2, 1, 1, 'RUNNING',   'CLAUDE_CODE', datetime('now','-2 days')),
    (3, 1, 1, 'IDLE',      'CLAUDE_CODE', datetime('now','-3 days')),
    (4, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-5 days')),
    (5, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-30 days'))`);
  // 1 session on task 5 (project 3 / team 2)
  await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
    (6, 5, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-2 days'))`);
}

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
    assert.equal(stats.recent7d, 5); // 5 sessions within 7 days (1,2,3,4,6)
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
```

- [ ] **Step 2: 运行测试，确认失败**

```
cd backend && npm test -- --test-name-pattern="getSessionStats"
```

期望：`repo.getSessionStats is not a function`。

- [ ] **Step 3: 实现方法**

`backend/src/repositories/dashboardRepository.ts` 追加：

```ts
export interface SessionStats {
  running: number;
  idle: number;
  recent7d: number;
  total: number;
}

// 类内追加：
async getSessionStats(scope: ScopeFilter): Promise<SessionStats> {
  const result = await this.client.execute({
    sql: `
      SELECT
        SUM(CASE WHEN s.status = 'RUNNING' THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN s.status = 'IDLE'    THEN 1 ELSE 0 END) AS idle,
        SUM(CASE WHEN s.started_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7d,
        COUNT(*) AS total
      FROM sessions s
      JOIN tasks t ON t.id = s.task_id
      WHERE (? IS NULL OR t.project_id = ?)
        AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
    `,
    args: [
      scope.projectId ?? null, scope.projectId ?? null,
      scope.teamId ?? null, scope.teamId ?? null,
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
```

- [ ] **Step 4: 运行测试，确认通过**

```
cd backend && npm test -- --test-name-pattern="getSessionStats"
```

期望：2 passing。

- [ ] **Step 5: 提交**

```bash
git add backend/src/repositories/dashboardRepository.ts backend/test/services/dashboardService.test.ts
git commit -m "feat(backend): add session stats aggregation to dashboardRepository"
```

---

## Task 3: dashboardRepository — Workflow 指标

**Files:**
- Modify: `backend/src/repositories/dashboardRepository.ts`
- Modify: `backend/test/services/dashboardService.test.ts`

- [ ] **Step 1: 写失败测试**

在测试文件追加：

```ts
async function seedWorkflowRuns(client: Client) {
  // workflow_runs need worktree_path/branch (NOT NULL); use placeholders
  await client.execute(`INSERT INTO workflow_runs (id, task_id, workflow_instance_id, status, worktree_path, branch, updated_at) VALUES
    (1, 1, 'inst-1', 'RUNNING',   '/wt/1', 'b1', datetime('now','-1 days')),
    (2, 1, 'inst-1', 'SUSPENDED', '/wt/2', 'b2', datetime('now','-2 days')),
    (3, 1, 'inst-1', 'COMPLETED', '/wt/3', 'b3', datetime('now','-3 days')),
    (4, 1, 'inst-1', 'FAILED',    '/wt/4', 'b4', datetime('now','-4 days')),
    (5, 5, 'inst-1', 'COMPLETED', '/wt/5', 'b5', datetime('now','-2 days'))`);
}

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
```

- [ ] **Step 2: 运行，确认失败**

```
cd backend && npm test -- --test-name-pattern="getWorkflowStats"
```

期望：`repo.getWorkflowStats is not a function`。

- [ ] **Step 3: 实现**

```ts
export interface WorkflowStats {
  running: number;
  suspended: number;
  recent7dCompleted: number;
  recent7dFailed: number;
  total: number;
}

async getWorkflowStats(scope: ScopeFilter): Promise<WorkflowStats> {
  const result = await this.client.execute({
    sql: `
      SELECT
        SUM(CASE WHEN wr.status = 'RUNNING'   THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN wr.status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended,
        SUM(CASE WHEN wr.status = 'COMPLETED' AND wr.updated_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS rc,
        SUM(CASE WHEN wr.status = 'FAILED'    AND wr.updated_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS rf,
        COUNT(*) AS total
      FROM workflow_runs wr
      JOIN tasks t ON t.id = wr.task_id
      WHERE (? IS NULL OR t.project_id = ?)
        AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
    `,
    args: [
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
```

- [ ] **Step 4: 运行，确认通过**

```
cd backend && npm test -- --test-name-pattern="getWorkflowStats"
```

期望：1 passing。

- [ ] **Step 5: 提交**

```bash
git add backend/src/repositories/dashboardRepository.ts backend/test/services/dashboardService.test.ts
git commit -m "feat(backend): add workflow stats aggregation to dashboardRepository"
```

---

## Task 4: dashboardRepository — Top N 排行（Agent / 项目 / 团队）

**Files:**
- Modify: `backend/src/repositories/dashboardRepository.ts`
- Modify: `backend/test/services/dashboardService.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
test.test('dashboardRepository.getAgentLeaderboard: orders by total desc and respects scope', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
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
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].agentId, 2);
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
      (22, 4, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const top = await repo.getProjectLeaderboard({});
    assert.ok(top.length >= 2);
    const p1 = top.find(p => p.projectId === 1);
    const p2 = top.find(p => p.projectId === 2);
    assert.equal(p1?.sessionsTotal, 2);
    assert.equal(p1?.tasksTotal, 3);
    assert.equal(p2?.sessionsTotal, 1);
  } finally { cleanup(); }
});

test.test('dashboardRepository.getTeamLeaderboard: aggregates across team projects', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    await client.execute(`INSERT INTO sessions (id, task_id, agent_id, status, executor_type, started_at) VALUES
      (30, 1, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days')),
      (31, 4, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days')),
      (32, 5, 1, 'COMPLETED', 'CLAUDE_CODE', datetime('now','-1 days'))`);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const repo = new DashboardRepository(client);
    const top = await repo.getTeamLeaderboard({});
    const t1 = top.find(t => t.teamId === 1);
    const t2 = top.find(t => t.teamId === 2);
    assert.equal(t1?.projectCount, 2);
    assert.equal(t1?.tasksTotal, 4);
    assert.equal(t1?.sessionsRecent7d, 2);
    assert.equal(t2?.projectCount, 1);
    assert.equal(t2?.sessionsRecent7d, 1);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: 运行，确认失败**

```
cd backend && npm test -- --test-name-pattern="Leaderboard"
```

期望：3 个测试都报 `is not a function`。

- [ ] **Step 3: 实现**

`backend/src/repositories/dashboardRepository.ts` 追加：

```ts
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

const LIMIT = 10;

async getAgentLeaderboard(scope: ScopeFilter): Promise<AgentLeaderboardEntry[]> {
  const result = await this.client.execute({
    sql: `
      SELECT s.agent_id AS agent_id, a.name AS name,
             COUNT(*) AS total,
             SUM(CASE WHEN s.started_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7d,
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
      LIMIT ${LIMIT}
    `,
    args: [
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
  const result = await this.client.execute({
    sql: `
      SELECT p.id AS project_id, p.name AS name,
             (SELECT COUNT(*) FROM tasks    WHERE project_id = p.id) AS tasks_total,
             (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id = s.task_id
                WHERE t.project_id = p.id) AS sessions_total,
             (SELECT COUNT(*) FROM sessions s JOIN tasks t ON t.id = s.task_id
                WHERE t.project_id = p.id AND s.started_at >= datetime('now','-7 days')) AS sessions_recent7d
      FROM projects p
      WHERE (? IS NULL OR p.id = ?)
        AND (? IS NULL OR p.team_id = ?)
      ORDER BY sessions_total DESC, tasks_total DESC
      LIMIT ${LIMIT}
    `,
    args: [
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
  const result = await this.client.execute({
    sql: `
      SELECT tm.id AS team_id, tm.name AS name,
             (SELECT COUNT(*) FROM projects WHERE team_id = tm.id) AS project_count,
             (SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id
                WHERE p.team_id = tm.id) AS tasks_total,
             (SELECT COUNT(*) FROM sessions s
                JOIN tasks    t ON t.id = s.task_id
                JOIN projects p ON p.id = t.project_id
                WHERE p.team_id = tm.id AND s.started_at >= datetime('now','-7 days')) AS sessions_recent7d
      FROM teams tm
      WHERE (? IS NULL OR tm.id = ?)
      ORDER BY sessions_recent7d DESC, tasks_total DESC
      LIMIT ${LIMIT}
    `,
    args: [scope.teamId ?? null, scope.teamId ?? null],
  });
  return result.rows.map(r => ({
    teamId:           Number(r.team_id),
    name:             String(r.name),
    projectCount:     Number(r.project_count),
    tasksTotal:       Number(r.tasks_total),
    sessionsRecent7d: Number(r.sessions_recent7d),
  }));
}
```

- [ ] **Step 4: 运行，确认通过**

```
cd backend && npm test -- --test-name-pattern="Leaderboard"
```

期望：3 passing。

- [ ] **Step 5: 提交**

```bash
git add backend/src/repositories/dashboardRepository.ts backend/test/services/dashboardService.test.ts
git commit -m "feat(backend): add agent/project/team leaderboards to dashboardRepository"
```

---

## Task 5: dashboardRepository — 30 天趋势

**Files:**
- Modify: `backend/src/repositories/dashboardRepository.ts`
- Modify: `backend/test/services/dashboardService.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
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
    const trend = await repo.getTrend30d({});
    assert.equal(trend.length, 30);
    const yesterday = trend[trend.length - 2];
    assert.equal(yesterday.sessionsStarted, 1);
    assert.equal(yesterday.tasksCompleted, 1);
    assert.equal(yesterday.workflowsCompleted, 1);
    // Day 0 should be all zeros (the oldest day in range)
    assert.equal(trend[0].sessionsStarted, 0);
    assert.equal(trend[0].tasksCompleted, 0);
    assert.equal(trend[0].workflowsCompleted, 0);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: 运行，确认失败**

```
cd backend && npm test -- --test-name-pattern="getTrend30d"
```

期望：`is not a function`。

- [ ] **Step 3: 实现**

```ts
export interface TrendEntry {
  date: string;
  sessionsStarted: number;
  tasksCompleted: number;
  workflowsCompleted: number;
}

async getTrend30d(scope: ScopeFilter): Promise<TrendEntry[]> {
  const result = await this.client.execute({
    sql: `
      WITH RECURSIVE days(d) AS (
        SELECT date('now','-29 days')
        UNION ALL SELECT date(d,'+1 day') FROM days WHERE d < date('now')
      )
      SELECT d AS date,
        (SELECT COUNT(*)
           FROM sessions s JOIN tasks t ON t.id = s.task_id
          WHERE date(s.started_at) = d
            AND (? IS NULL OR t.project_id = ?)
            AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
        ) AS sessions_started,
        (SELECT COUNT(*)
           FROM tasks t
          WHERE date(t.updated_at) = d AND t.status = 'DONE'
            AND (? IS NULL OR t.project_id = ?)
            AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
        ) AS tasks_completed,
        (SELECT COUNT(*)
           FROM workflow_runs wr JOIN tasks t ON t.id = wr.task_id
          WHERE date(wr.updated_at) = d AND wr.status = 'COMPLETED'
            AND (? IS NULL OR t.project_id = ?)
            AND (? IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = ?))
        ) AS workflows_completed
      FROM days
      ORDER BY d ASC
    `,
    args: [
      scope.projectId ?? null, scope.projectId ?? null, scope.teamId ?? null, scope.teamId ?? null,
      scope.projectId ?? null, scope.projectId ?? null, scope.teamId ?? null, scope.teamId ?? null,
      scope.projectId ?? null, scope.projectId ?? null, scope.teamId ?? null, scope.teamId ?? null,
    ],
  });
  return result.rows.map(r => ({
    date:               String(r.date),
    sessionsStarted:    Number(r.sessions_started),
    tasksCompleted:     Number(r.tasks_completed),
    workflowsCompleted: Number(r.workflows_completed),
  }));
}
```

- [ ] **Step 4: 运行，确认通过**

```
cd backend && npm test -- --test-name-pattern="getTrend30d"
```

期望：1 passing。

- [ ] **Step 5: 提交**

```bash
git add backend/src/repositories/dashboardRepository.ts backend/test/services/dashboardService.test.ts
git commit -m "feat(backend): add 30-day trend aggregation to dashboardRepository"
```

---

## Task 6: DashboardService — getOverview / getAgentDetail / getProjectDetail / getTeamDetail

**Files:**
- Create: `backend/src/services/DashboardService.ts`
- Modify: `backend/test/services/dashboardService.test.ts`

- [ ] **Step 1: 写 getOverview 失败测试**

```ts
test.test('DashboardService.getOverview composes all sections; resolves scope names', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const svc = new DashboardService(new DashboardRepository(client), client);

    const overview = await svc.getOverview({ teamId: 1 });
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
    await assert.rejects(() => svc.getOverview({ teamId: 999 }), /Team not found/);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: 运行，确认失败**

```
cd backend && npm test -- --test-name-pattern="DashboardService.getOverview"
```

期望：`Cannot find module ... DashboardService.js`。

- [ ] **Step 3: 实现 service**

`backend/src/services/DashboardService.ts`：

```ts
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
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
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
    return { byStatus, recent7dDone: Number(recentDoneRow.rows[0]?.c ?? 0), total };
  }

  async getAgentDetail(agentId: number, scope: ScopeFilter) {
    const agentRow = await this.client.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [agentId] });
    if (agentRow.rows.length === 0) throw new NotFoundError('Agent not found', `agent ${agentId} missing`);
    const sessions = await this.repo.getSessionStats({ ...scope }); // (placeholder; agent-scoped variant added in Task 6b)
    return { agent: agentRow.rows[0], sessions, recentSessions: [], byProject: [], byTeam: [], trend30d: await this.repo.getTrend30d(scope) };
  }

  async getProjectDetail(projectId: number) {
    const p = await this.client.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [projectId] });
    if (p.rows.length === 0) throw new NotFoundError('Project not found', `project ${projectId} missing`);
    const project = p.rows[0];
    let team = null;
    if (project.team_id) {
      const t = await this.client.execute({ sql: 'SELECT * FROM teams WHERE id = ?', args: [project.team_id] });
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
```

> 注：`NotFoundError` 已存在于 `backend/src/utils/errors.ts`（项目惯用），构造签名为 `(userMessage, internalMessage)`。如签名不一致请改成项目实际签名（参见 `teamService.ts` 中 `ValidationError` 的用法）。

- [ ] **Step 4: 运行 overview 测试，确认通过**

```
cd backend && npm test -- --test-name-pattern="DashboardService.getOverview"
```

期望：2 passing。

- [ ] **Step 5: 写 detail 测试并通过**

```ts
test.test('DashboardService.getProjectDetail returns project, team, sessions, tasks, trend', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const svc = new DashboardService(new DashboardRepository(client), client);
    const detail = await svc.getProjectDetail(1);
    assert.equal((detail.project as any).id, 1);
    assert.equal((detail.team as any).id, 1);
    assert.equal(detail.tasks.total, 3);
    assert.equal(detail.trend30d.length, 30);
  } finally { cleanup(); }
});

test.test('DashboardService.getTeamDetail aggregates over projects', async () => {
  const { client, cleanup } = createTempDb();
  try {
    await applySchema(client);
    await seedFixtures(client);
    const { DashboardService } = await import('../../src/services/DashboardService.js');
    const { DashboardRepository } = await import('../../src/repositories/dashboardRepository.js');
    const svc = new DashboardService(new DashboardRepository(client), client);
    const detail = await svc.getTeamDetail(1);
    assert.equal(detail.projects.length, 2);
    assert.equal(detail.aggregateTasks.total, 4);
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
    await assert.rejects(() => svc.getAgentDetail(999, {}), /Agent not found/);
  } finally { cleanup(); }
});
```

```
cd backend && npm test -- --test-name-pattern="DashboardService"
```

期望：5 passing。

- [ ] **Step 6: 提交**

```bash
git add backend/src/services/DashboardService.ts backend/test/services/dashboardService.test.ts
git commit -m "feat(backend): add DashboardService with overview and detail composers"
```

---

## Task 7: routes/dashboard.ts + 注册

**Files:**
- Create: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: 写路由文件**

`backend/src/routes/dashboard.ts`：

```ts
import type { FastifyPluginAsync } from 'fastify';
import { dashboardService } from '../services/DashboardService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { parseNumber, getStatusCode, getErrorMessage, logError } from '../utils/http.js';

interface OverviewQuery { teamId?: string; projectId?: string }

function parseOptionalNumber(v?: string): number | null {
  if (v === undefined || v === '' || v === 'null') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: OverviewQuery }>('/overview', async (request, reply) => {
    try {
      const overview = await dashboardService.getOverview({
        teamId:    parseOptionalNumber(request.query.teamId),
        projectId: parseOptionalNumber(request.query.projectId),
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
      });
      return successResponse(detail);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get agent detail'));
    }
  });

  fastify.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    try {
      const projectId = parseNumber(request.params.id);
      const detail = await dashboardService.getProjectDetail(projectId);
      return successResponse(detail);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get project detail'));
    }
  });

  fastify.get<{ Params: { id: string } }>('/teams/:id', async (request, reply) => {
    try {
      const teamId = parseNumber(request.params.id);
      const detail = await dashboardService.getTeamDetail(teamId);
      return successResponse(detail);
    } catch (error) {
      logError(error, request);
      reply.code(getStatusCode(error));
      return errorResponse(getErrorMessage(error, 'Failed to get team detail'));
    }
  });
};
```

- [ ] **Step 2: 在 routes/index.ts 加导出**

修改 `backend/src/routes/index.ts`，在末尾追加：

```ts
export { dashboardRoutes } from './dashboard.js';
```

- [ ] **Step 3: 在 app.ts 注册**

修改 `backend/src/app.ts`，在 `import { ... routes }` 块内加入 `dashboardRoutes`，并在 `fastify.register(teamRoutes, ...)` 之后加入：

```ts
fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
```

- [ ] **Step 4: 编译验证**

```
cd backend && npm run typecheck
```

期望：0 errors。

- [ ] **Step 5: 启动后端冒烟**

```
cd backend && npm run dev &
sleep 3
curl -s http://localhost:8000/api/dashboard/overview | head -c 200
```

期望：返回 `{"success":true,...}`，包含 `scope`、`sessions`、`tasks`、`workflows`、`trend30d` 字段。完成后 `kill %1`。

- [ ] **Step 6: 提交**

```bash
git add backend/src/routes/dashboard.ts backend/src/routes/index.ts backend/src/app.ts
git commit -m "feat(backend): wire /api/dashboard routes"
```

---

## Task 8: 前端依赖与 axios 封装

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/api/dashboard.js`

- [ ] **Step 1: 安装 echarts**

```
cd frontend && npm install echarts@^5.5.0
```

- [ ] **Step 2: 创建 API 封装**

`frontend/src/api/dashboard.js`：

```js
import api from './index.js'

export const getOverview = (params = {}) => {
  const query = {}
  if (params.teamId    != null) query.teamId    = params.teamId
  if (params.projectId != null) query.projectId = params.projectId
  return api.get('/dashboard/overview', { params: query })
}

export const getAgentDetail = (agentId, params = {}) => {
  const query = {}
  if (params.teamId    != null) query.teamId    = params.teamId
  if (params.projectId != null) query.projectId = params.projectId
  return api.get(`/dashboard/agents/${agentId}`, { params: query })
}

export const getProjectDetail = (projectId) => api.get(`/dashboard/projects/${projectId}`)
export const getTeamDetail    = (teamId)    => api.get(`/dashboard/teams/${teamId}`)
```

- [ ] **Step 3: 提交**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/dashboard.js
git commit -m "feat(frontend): add echarts dep and dashboard api wrapper"
```

---

## Task 9: i18n 文案

**Files:**
- Modify: `frontend/src/locales/zh.js`
- Modify: `frontend/src/locales/en.js`

- [ ] **Step 1: 在 zh.js 增加 key**

定位 `nav.*` 区块，追加：

```js
nav.groupOperations: '运营 / 管理',
nav.dashboard: '看板',
```

并在合适位置追加 `dashboard` 命名空间：

```js
dashboard: {
  title: '运营看板',
  refresh: '刷新',
  empty: '暂无数据',
  scope: { team: '团队', project: '项目', all: '全部' },
  metric: { recent: '近 7 天', total: '累计' },
  sessions: { title: 'Session', running: '进行中', idle: '空闲' },
  tasks: { title: '任务', byStatus: '任务状态分布' },
  workflows: { title: 'Workflow' },
  leaderboard: { agents: 'Agent 排行', projects: '项目排行', teams: '团队排行' },
  trend: { title: '近 30 天趋势' },
  detail: { agent: 'Agent 明细', project: '项目明细', team: '团队明细' },
}
```

> 注：实际 zh.js 可能为扁平 key（`'dashboard.title': '运营看板'`）或嵌套对象，取决于该文件现有约定 — 沿用现有写法即可，不要混用。

- [ ] **Step 2: 同步 en.js**

```
dashboard: {
  title: 'Operations Dashboard',
  refresh: 'Refresh',
  empty: 'No data',
  scope: { team: 'Team', project: 'Project', all: 'All' },
  metric: { recent: 'Last 7 days', total: 'Total' },
  sessions: { title: 'Sessions', running: 'Running', idle: 'Idle' },
  tasks: { title: 'Tasks', byStatus: 'Tasks by status' },
  workflows: { title: 'Workflow' },
  leaderboard: { agents: 'Top Agents', projects: 'Top Projects', teams: 'Top Teams' },
  trend: { title: 'Last 30 days' },
  detail: { agent: 'Agent details', project: 'Project details', team: 'Team details' },
}
```

并：

```
nav.groupOperations: 'Operations',
nav.dashboard: 'Dashboard',
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/locales/zh.js frontend/src/locales/en.js
git commit -m "feat(frontend): add i18n keys for dashboard"
```

> 如果 `frontend/src/locales/` 中只有 `zh.js` 和 `index.js`，则只改 `zh.js`，并在 `index.js` 中确认默认 locale。

---

## Task 10: ScopeSelector 组件 + 测试

**Files:**
- Create: `frontend/src/components/dashboard/ScopeSelector.vue`
- Create: `frontend/src/components/dashboard/__tests__/ScopeSelector.spec.js`

- [ ] **Step 1: 写失败测试**

`frontend/src/components/dashboard/__tests__/ScopeSelector.spec.js`：

```js
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import ScopeSelector from '../ScopeSelector.vue'

const teams = [{ id: 1, name: 'T1' }, { id: 2, name: 'T2' }]
const projects = [
  { id: 10, name: 'P10', team_id: 1 },
  { id: 11, name: 'P11', team_id: 1 },
  { id: 20, name: 'P20', team_id: 2 },
]

const stubI18n = { global: { mocks: { $t: (k) => k } } }

describe('ScopeSelector', () => {
  it('shows all projects when team is "all"', async () => {
    const wrapper = mount(ScopeSelector, {
      props: { teams, projects, modelValue: { teamId: null, projectId: null } },
      global: stubI18n.global,
    })
    expect(wrapper.findAll('[data-test="project-option"]').length).toBe(projects.length)
  })

  it('filters projects by selected team', async () => {
    const wrapper = mount(ScopeSelector, {
      props: { teams, projects, modelValue: { teamId: 1, projectId: null } },
      global: stubI18n.global,
    })
    expect(wrapper.findAll('[data-test="project-option"]').length).toBe(2)
  })

  it('emits update:modelValue with project=null when team change orphans the project', async () => {
    const wrapper = mount(ScopeSelector, {
      props: { teams, projects, modelValue: { teamId: 1, projectId: 10 } },
      global: stubI18n.global,
    })
    await wrapper.vm.onTeamChange(2)
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted.at(-1)[0]).toEqual({ teamId: 2, projectId: null })
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```
cd frontend && npm run test:run -- src/components/dashboard/__tests__/ScopeSelector.spec.js
```

期望：找不到组件文件。

- [ ] **Step 3: 实现组件**

`frontend/src/components/dashboard/ScopeSelector.vue`：

```vue
<template>
  <div class="scope-selector">
    <label>{{ $t('dashboard.scope.team') }}</label>
    <select :value="modelValue.teamId ?? ''" @change="onTeamChange(parseId($event.target.value))">
      <option value="">{{ $t('dashboard.scope.all') }}</option>
      <option v-for="t in teams" :key="t.id" :value="t.id" data-test="team-option">{{ t.name }}</option>
    </select>

    <label>{{ $t('dashboard.scope.project') }}</label>
    <select :value="modelValue.projectId ?? ''" @change="onProjectChange(parseId($event.target.value))">
      <option value="">{{ $t('dashboard.scope.all') }}</option>
      <option v-for="p in filteredProjects" :key="p.id" :value="p.id" data-test="project-option">{{ p.name }}</option>
    </select>
  </div>
</template>

<script>
export default {
  name: 'ScopeSelector',
  props: {
    teams: { type: Array, required: true },
    projects: { type: Array, required: true },
    modelValue: { type: Object, required: true },
  },
  emits: ['update:modelValue'],
  computed: {
    filteredProjects() {
      const t = this.modelValue.teamId
      if (t == null) return this.projects
      return this.projects.filter(p => p.team_id === t)
    },
  },
  methods: {
    parseId(v) {
      if (v === '' || v == null) return null
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : null
    },
    onTeamChange(teamId) {
      const cur = this.modelValue.projectId
      const stillValid = cur != null && this.projects.some(p => p.id === cur && (teamId == null || p.team_id === teamId))
      this.$emit('update:modelValue', { teamId, projectId: stillValid ? cur : null })
    },
    onProjectChange(projectId) {
      this.$emit('update:modelValue', { ...this.modelValue, projectId })
    },
  },
}
</script>
```

- [ ] **Step 4: 运行，确认通过**

```
cd frontend && npm run test:run -- src/components/dashboard/__tests__/ScopeSelector.spec.js
```

期望：3 passing。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/dashboard/ScopeSelector.vue frontend/src/components/dashboard/__tests__/ScopeSelector.spec.js
git commit -m "feat(frontend): add ScopeSelector component"
```

---

## Task 11: MetricCard 组件 + 测试

**Files:**
- Create: `frontend/src/components/dashboard/MetricCard.vue`
- Create: `frontend/src/components/dashboard/__tests__/MetricCard.spec.js`

- [ ] **Step 1: 写失败测试**

```js
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import MetricCard from '../MetricCard.vue'

const stubs = { global: { mocks: { $t: (k) => k } } }

describe('MetricCard', () => {
  it('renders title, recent and total values', () => {
    const w = mount(MetricCard, {
      props: { title: 'Sessions', recent: 12, total: 145 },
      global: stubs.global,
    })
    expect(w.text()).toContain('Sessions')
    expect(w.text()).toContain('12')
    expect(w.text()).toContain('145')
  })

  it('emits click when card is clickable', async () => {
    const w = mount(MetricCard, {
      props: { title: 'Sessions', recent: 1, total: 2, clickable: true },
      global: stubs.global,
    })
    await w.find('[data-test="metric-card"]').trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```
cd frontend && npm run test:run -- src/components/dashboard/__tests__/MetricCard.spec.js
```

- [ ] **Step 3: 实现**

`frontend/src/components/dashboard/MetricCard.vue`：

```vue
<template>
  <div class="metric-card" data-test="metric-card" :class="{ clickable }" @click="onClick">
    <div class="metric-card__title">{{ title }}</div>
    <div class="metric-card__values">
      <div class="metric-card__recent">
        <span class="label">{{ $t('dashboard.metric.recent') }}</span>
        <span class="value">{{ recent }}</span>
      </div>
      <div class="metric-card__total">
        <span class="label">{{ $t('dashboard.metric.total') }}</span>
        <span class="value">{{ total }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MetricCard',
  props: {
    title:     { type: String, required: true },
    recent:    { type: Number, required: true },
    total:     { type: Number, required: true },
    clickable: { type: Boolean, default: false },
  },
  emits: ['click'],
  methods: {
    onClick() {
      if (this.clickable) this.$emit('click')
    },
  },
}
</script>

<style scoped>
.metric-card { padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-primary); }
.metric-card.clickable { cursor: pointer; }
.metric-card.clickable:hover { box-shadow: var(--shadow-md); }
.metric-card__title { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.metric-card__values { display: flex; gap: 24px; }
.metric-card__recent .value, .metric-card__total .value { font-size: 24px; font-weight: 600; color: var(--text-primary); }
.label { display: block; font-size: 12px; color: var(--text-muted); }
</style>
```

- [ ] **Step 4: 运行，确认通过**

```
cd frontend && npm run test:run -- src/components/dashboard/__tests__/MetricCard.spec.js
```

期望：2 passing。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/dashboard/MetricCard.vue frontend/src/components/dashboard/__tests__/MetricCard.spec.js
git commit -m "feat(frontend): add MetricCard component"
```

---

## Task 12: LeaderboardCard 组件 + 测试

**Files:**
- Create: `frontend/src/components/dashboard/LeaderboardCard.vue`
- Create: `frontend/src/components/dashboard/__tests__/LeaderboardCard.spec.js`

- [ ] **Step 1: 写失败测试**

```js
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import LeaderboardCard from '../LeaderboardCard.vue'

const stubs = { global: { mocks: { $t: (k) => k } } }

const items = [
  { id: 1, name: 'A1', primary: 12, secondary: '近 5' },
  { id: 2, name: 'A2', primary: 7,  secondary: '近 2' },
]

describe('LeaderboardCard', () => {
  it('renders items in given order with primary and secondary metrics', () => {
    const w = mount(LeaderboardCard, {
      props: { title: 'Top Agents', items },
      global: stubs.global,
    })
    const rows = w.findAll('[data-test="leaderboard-row"]')
    expect(rows.length).toBe(2)
    expect(rows[0].text()).toContain('A1')
    expect(rows[0].text()).toContain('12')
  })

  it('emits "select" with item id on row click', async () => {
    const w = mount(LeaderboardCard, {
      props: { title: 'Top Agents', items },
      global: stubs.global,
    })
    await w.findAll('[data-test="leaderboard-row"]')[0].trigger('click')
    expect(w.emitted('select')[0]).toEqual([1])
  })

  it('shows empty placeholder when items is empty', () => {
    const w = mount(LeaderboardCard, {
      props: { title: 'Top Agents', items: [] },
      global: stubs.global,
    })
    expect(w.text()).toContain('dashboard.empty')
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```
cd frontend && npm run test:run -- src/components/dashboard/__tests__/LeaderboardCard.spec.js
```

- [ ] **Step 3: 实现**

`frontend/src/components/dashboard/LeaderboardCard.vue`：

```vue
<template>
  <div class="leaderboard-card">
    <div class="leaderboard-card__title">{{ title }}</div>
    <div v-if="items.length === 0" class="leaderboard-card__empty">{{ $t('dashboard.empty') }}</div>
    <ul v-else class="leaderboard-card__list">
      <li
        v-for="(it, idx) in items"
        :key="it.id"
        class="leaderboard-card__row"
        data-test="leaderboard-row"
        @click="$emit('select', it.id)"
      >
        <span class="rank">{{ idx + 1 }}</span>
        <span class="name">{{ it.name }}</span>
        <span class="primary">{{ it.primary }}</span>
        <span v-if="it.secondary != null" class="secondary">{{ it.secondary }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'LeaderboardCard',
  props: {
    title: { type: String, required: true },
    items: { type: Array, required: true },
  },
  emits: ['select'],
}
</script>

<style scoped>
.leaderboard-card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
.leaderboard-card__title { font-weight: 600; margin-bottom: 12px; }
.leaderboard-card__empty { color: var(--text-muted); font-size: 13px; }
.leaderboard-card__list { list-style: none; padding: 0; margin: 0; }
.leaderboard-card__row { display: grid; grid-template-columns: 24px 1fr auto auto; gap: 12px; padding: 8px 0; cursor: pointer; }
.leaderboard-card__row:hover { background: var(--hover-bg); }
.rank { color: var(--text-muted); }
.primary { font-weight: 600; }
.secondary { color: var(--text-secondary); font-size: 12px; }
</style>
```

- [ ] **Step 4: 运行，确认通过**

```
cd frontend && npm run test:run -- src/components/dashboard/__tests__/LeaderboardCard.spec.js
```

期望：3 passing。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/dashboard/LeaderboardCard.vue frontend/src/components/dashboard/__tests__/LeaderboardCard.spec.js
git commit -m "feat(frontend): add LeaderboardCard component"
```

---

## Task 13: TrendChart + StatusDistribution（echarts 按需引入）

**Files:**
- Create: `frontend/src/components/dashboard/TrendChart.vue`
- Create: `frontend/src/components/dashboard/StatusDistribution.vue`

无单测（图表组件视觉效果以人工验证为主，后续 e2e 覆盖）。

- [ ] **Step 1: 写 TrendChart**

`frontend/src/components/dashboard/TrendChart.vue`：

```vue
<template>
  <div ref="el" class="trend-chart"></div>
</template>

<script>
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

export default {
  name: 'TrendChart',
  props: { data: { type: Array, required: true } },
  data: () => ({ chart: null }),
  watch: {
    data: { handler() { this.render() }, deep: true },
  },
  mounted() {
    this.chart = echarts.init(this.$refs.el)
    this.render()
    this._onResize = () => this.chart && this.chart.resize()
    window.addEventListener('resize', this._onResize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this._onResize)
    this.chart && this.chart.dispose()
  },
  methods: {
    render() {
      if (!this.chart) return
      this.chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['Sessions', 'Tasks', 'Workflows'] },
        xAxis: { type: 'category', data: this.data.map(d => d.date) },
        yAxis: { type: 'value' },
        series: [
          { name: 'Sessions',  type: 'line', data: this.data.map(d => d.sessionsStarted) },
          { name: 'Tasks',     type: 'line', data: this.data.map(d => d.tasksCompleted) },
          { name: 'Workflows', type: 'line', data: this.data.map(d => d.workflowsCompleted) },
        ],
      })
    },
  },
}
</script>

<style scoped>
.trend-chart { width: 100%; height: 280px; }
</style>
```

- [ ] **Step 2: 写 StatusDistribution**

`frontend/src/components/dashboard/StatusDistribution.vue`：

```vue
<template>
  <div ref="el" class="status-distribution"></div>
</template>

<script>
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

export default {
  name: 'StatusDistribution',
  props: { byStatus: { type: Object, required: true } },
  data: () => ({ chart: null }),
  watch: { byStatus: { handler() { this.render() }, deep: true } },
  mounted() {
    this.chart = echarts.init(this.$refs.el)
    this.render()
    this._onResize = () => this.chart && this.chart.resize()
    window.addEventListener('resize', this._onResize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this._onResize)
    this.chart && this.chart.dispose()
  },
  methods: {
    render() {
      if (!this.chart) return
      const entries = Object.entries(this.byStatus).map(([k, v]) => ({ name: k, value: Number(v) }))
      this.chart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [{
          name: 'Tasks',
          type: 'pie',
          radius: ['40%', '70%'],
          data: entries,
        }],
      })
    },
  },
}
</script>

<style scoped>
.status-distribution { width: 100%; height: 280px; }
</style>
```

- [ ] **Step 3: 编译验证**

```
cd frontend && npm run build
```

期望：build 成功，no errors。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/dashboard/TrendChart.vue frontend/src/components/dashboard/StatusDistribution.vue
git commit -m "feat(frontend): add TrendChart and StatusDistribution charts"
```

---

## Task 14: DashboardView 主页 + 测试

**Files:**
- Create: `frontend/src/views/DashboardView.vue`
- Create: `frontend/src/views/__tests__/DashboardView.spec.js`

- [ ] **Step 1: 写失败测试**

```js
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../api/dashboard.js', () => ({
  getOverview: vi.fn(),
}))
vi.mock('../../api/team.js', () => ({
  getTeams: vi.fn(),
}))
vi.mock('../../api/project.js', () => ({
  getProjects: vi.fn(),
}))

import DashboardView from '../DashboardView.vue'
import { getOverview } from '../../api/dashboard.js'
import { getTeams } from '../../api/team.js'
import { getProjects } from '../../api/project.js'

const stubI18n = { mocks: { $t: (k) => k } }

const sampleOverview = {
  scope: { teamId: null, projectId: null, teamName: null, projectName: null },
  sessions:  { running: 1, idle: 0, recent7d: 5, total: 20 },
  tasks:     { byStatus: { TODO: 1, IN_PROGRESS: 0, DONE: 2, BLOCKED: 0, CANCELLED: 0, REQUIREMENTS: 0 },
                recent7dDone: 1, total: 3 },
  workflows: { running: 0, suspended: 0, recent7dCompleted: 0, recent7dFailed: 0, total: 0 },
  agentTop: [{ agentId: 1, name: 'A1', sessionsTotal: 10, sessionsRecent7d: 3, successRate: 0.8 }],
  projectTop: [{ projectId: 5, name: 'P5', tasksTotal: 7, sessionsTotal: 3, sessionsRecent7d: 1 }],
  teamTop:    [{ teamId: 1, name: 'T1', projectCount: 2, tasksTotal: 7, sessionsRecent7d: 1 }],
  trend30d: Array.from({ length: 30 }, (_, i) => ({ date: `2026-04-${i+1}`, sessionsStarted: 0, tasksCompleted: 0, workflowsCompleted: 0 })),
}

describe('DashboardView', () => {
  it('loads overview on mount and renders cards', async () => {
    getTeams.mockResolvedValue({ success: true, data: [{ id: 1, name: 'T1' }] })
    getProjects.mockResolvedValue({ success: true, data: [{ id: 5, name: 'P5', team_id: 1 }] })
    getOverview.mockResolvedValue({ success: true, data: sampleOverview })
    const w = mount(DashboardView, { global: stubI18n, stubs: { TrendChart: true, StatusDistribution: true } })
    await flushPromises()
    expect(getOverview).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('A1')
    expect(w.text()).toContain('P5')
  })

  it('reloads when scope changes', async () => {
    getTeams.mockResolvedValue({ success: true, data: [{ id: 1, name: 'T1' }] })
    getProjects.mockResolvedValue({ success: true, data: [] })
    getOverview.mockResolvedValue({ success: true, data: sampleOverview })
    const w = mount(DashboardView, { global: stubI18n, stubs: { TrendChart: true, StatusDistribution: true } })
    await flushPromises()
    w.vm.scope = { teamId: 1, projectId: null }
    await flushPromises()
    expect(getOverview).toHaveBeenCalledTimes(2)
    expect(getOverview.mock.calls[1][0]).toEqual({ teamId: 1, projectId: null })
  })

  it('navigates to agent detail on leaderboard select', async () => {
    getTeams.mockResolvedValue({ success: true, data: [] })
    getProjects.mockResolvedValue({ success: true, data: [] })
    getOverview.mockResolvedValue({ success: true, data: sampleOverview })
    const push = vi.fn()
    const w = mount(DashboardView, {
      global: { ...stubI18n, mocks: { ...stubI18n.mocks, $router: { push } } },
      stubs: { TrendChart: true, StatusDistribution: true },
    })
    await flushPromises()
    w.vm.onSelectAgent(1)
    expect(push).toHaveBeenCalledWith({ name: 'DashboardAgent', params: { id: 1 } })
  })
})
```

- [ ] **Step 2: 运行，确认失败**

```
cd frontend && npm run test:run -- src/views/__tests__/DashboardView.spec.js
```

- [ ] **Step 3: 实现 DashboardView**

`frontend/src/views/DashboardView.vue`：

```vue
<template>
  <div class="dashboard-view">
    <header class="dashboard-view__header">
      <h2>{{ $t('dashboard.title') }}</h2>
      <ScopeSelector v-model="scope" :teams="teams" :projects="projects" />
      <button @click="loadOverview">{{ $t('dashboard.refresh') }}</button>
    </header>

    <section class="dashboard-view__metrics" v-if="overview">
      <MetricCard :title="$t('dashboard.sessions.title')" :recent="overview.sessions.recent7d" :total="overview.sessions.total" />
      <MetricCard :title="$t('dashboard.tasks.title')"    :recent="overview.tasks.recent7dDone" :total="overview.tasks.total" />
      <MetricCard :title="$t('dashboard.workflows.title')" :recent="overview.workflows.recent7dCompleted" :total="overview.workflows.total" />
    </section>

    <section class="dashboard-view__row" v-if="overview">
      <div class="card">
        <h3>{{ $t('dashboard.tasks.byStatus') }}</h3>
        <StatusDistribution :by-status="overview.tasks.byStatus" />
      </div>
      <div class="card">
        <h3>{{ $t('dashboard.trend.title') }}</h3>
        <TrendChart :data="overview.trend30d" />
      </div>
    </section>

    <section class="dashboard-view__row" v-if="overview">
      <LeaderboardCard
        :title="$t('dashboard.leaderboard.agents')"
        :items="agentItems"
        @select="onSelectAgent"
      />
      <LeaderboardCard
        :title="$t('dashboard.leaderboard.projects')"
        :items="projectItems"
        @select="onSelectProject"
      />
    </section>

    <section class="dashboard-view__row" v-if="overview">
      <LeaderboardCard
        :title="$t('dashboard.leaderboard.teams')"
        :items="teamItems"
        @select="onSelectTeam"
      />
    </section>
  </div>
</template>

<script>
import ScopeSelector from '../components/dashboard/ScopeSelector.vue'
import MetricCard from '../components/dashboard/MetricCard.vue'
import LeaderboardCard from '../components/dashboard/LeaderboardCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import StatusDistribution from '../components/dashboard/StatusDistribution.vue'
import { getOverview } from '../api/dashboard.js'
import { getTeams } from '../api/team.js'
import { getProjects } from '../api/project.js'

export default {
  name: 'DashboardView',
  components: { ScopeSelector, MetricCard, LeaderboardCard, TrendChart, StatusDistribution },
  data() {
    return {
      scope: { teamId: null, projectId: null },
      teams: [],
      projects: [],
      overview: null,
      loading: false,
      error: null,
    }
  },
  computed: {
    agentItems() {
      return (this.overview?.agentTop || []).map(a => ({
        id: a.agentId, name: a.name,
        primary: a.sessionsTotal,
        secondary: `${this.$t('dashboard.metric.recent')} ${a.sessionsRecent7d}`,
      }))
    },
    projectItems() {
      return (this.overview?.projectTop || []).map(p => ({
        id: p.projectId, name: p.name,
        primary: p.sessionsTotal,
        secondary: `${this.$t('dashboard.metric.recent')} ${p.sessionsRecent7d}`,
      }))
    },
    teamItems() {
      return (this.overview?.teamTop || []).map(t => ({
        id: t.teamId, name: t.name,
        primary: t.tasksTotal,
        secondary: `${this.$t('dashboard.metric.recent')} ${t.sessionsRecent7d}`,
      }))
    },
  },
  watch: {
    scope: { handler() { this.loadOverview() }, deep: true },
  },
  async mounted() {
    const [tRes, pRes] = await Promise.all([getTeams(), getProjects()])
    if (tRes.success) this.teams = tRes.data
    if (pRes.success) this.projects = pRes.data
    await this.loadOverview()
  },
  methods: {
    async loadOverview() {
      this.loading = true
      this.error = null
      try {
        const res = await getOverview(this.scope)
        if (res.success) this.overview = res.data
        else this.error = res.message || 'load failed'
      } catch (e) {
        this.error = e?.message || 'load failed'
      } finally {
        this.loading = false
      }
    },
    onSelectAgent(id)   { this.$router.push({ name: 'DashboardAgent',   params: { id } }) },
    onSelectProject(id) { this.$router.push({ name: 'DashboardProject', params: { id } }) },
    onSelectTeam(id)    { this.$router.push({ name: 'DashboardTeam',    params: { id } }) },
  },
}
</script>

<style scoped>
.dashboard-view { padding: 20px; max-width: 1280px; margin: 0 auto; }
.dashboard-view__header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.dashboard-view__header h2 { flex: 1; }
.dashboard-view__metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.dashboard-view__row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
</style>
```

- [ ] **Step 4: 运行，确认通过**

```
cd frontend && npm run test:run -- src/views/__tests__/DashboardView.spec.js
```

期望：3 passing。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/views/DashboardView.vue frontend/src/views/__tests__/DashboardView.spec.js
git commit -m "feat(frontend): add DashboardView main page"
```

---

## Task 15: DashboardAgentDetailView

**Files:**
- Create: `frontend/src/views/DashboardAgentDetailView.vue`

无单测（明细页绝大部分逻辑等同主视图，靠主视图测试 + 手动验证；如未来出问题再补）。

- [ ] **Step 1: 实现**

```vue
<template>
  <div class="dashboard-detail">
    <header>
      <button @click="$router.back()">←</button>
      <h2>{{ $t('dashboard.detail.agent') }}: {{ detail?.agent?.name || id }}</h2>
      <button @click="load">{{ $t('dashboard.refresh') }}</button>
    </header>
    <section v-if="detail" class="grid">
      <MetricCard :title="$t('dashboard.sessions.title')" :recent="detail.sessions.recent7d" :total="detail.sessions.total" />
    </section>
    <section v-if="detail" class="card">
      <h3>{{ $t('dashboard.trend.title') }}</h3>
      <TrendChart :data="detail.trend30d" />
    </section>
  </div>
</template>

<script>
import MetricCard from '../components/dashboard/MetricCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import { getAgentDetail } from '../api/dashboard.js'

export default {
  name: 'DashboardAgentDetailView',
  components: { MetricCard, TrendChart },
  data: () => ({ detail: null, error: null }),
  computed: { id() { return Number(this.$route.params.id) } },
  watch: { id() { this.load() } },
  mounted() { this.load() },
  methods: {
    async load() {
      try {
        const res = await getAgentDetail(this.id, {})
        if (res.success) this.detail = res.data
        else this.error = res.message
      } catch (e) {
        if (e?.response?.status === 404) this.$router.replace('/dashboard')
        else this.error = e?.message
      }
    },
  },
}
</script>
<style scoped>
.dashboard-detail { padding: 20px; max-width: 1280px; margin: 0 auto; }
header { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
header h2 { flex: 1; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/views/DashboardAgentDetailView.vue
git commit -m "feat(frontend): add DashboardAgentDetailView"
```

---

## Task 16: DashboardProjectDetailView

**Files:**
- Create: `frontend/src/views/DashboardProjectDetailView.vue`

- [ ] **Step 1: 实现**

```vue
<template>
  <div class="dashboard-detail">
    <header>
      <button @click="$router.back()">←</button>
      <h2>{{ $t('dashboard.detail.project') }}: {{ detail?.project?.name || id }}</h2>
      <button @click="load">{{ $t('dashboard.refresh') }}</button>
    </header>
    <section v-if="detail" class="grid">
      <MetricCard :title="$t('dashboard.sessions.title')" :recent="detail.sessions.recent7d" :total="detail.sessions.total" />
      <MetricCard :title="$t('dashboard.tasks.title')"    :recent="detail.tasks.recent7dDone" :total="detail.tasks.total" />
    </section>
    <section v-if="detail" class="row">
      <div class="card">
        <h3>{{ $t('dashboard.tasks.byStatus') }}</h3>
        <StatusDistribution :by-status="detail.tasks.byStatus" />
      </div>
      <div class="card">
        <h3>{{ $t('dashboard.trend.title') }}</h3>
        <TrendChart :data="detail.trend30d" />
      </div>
    </section>
    <section v-if="detail">
      <LeaderboardCard
        :title="$t('dashboard.leaderboard.agents')"
        :items="agentItems"
        @select="onSelectAgent"
      />
    </section>
  </div>
</template>

<script>
import MetricCard from '../components/dashboard/MetricCard.vue'
import LeaderboardCard from '../components/dashboard/LeaderboardCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import StatusDistribution from '../components/dashboard/StatusDistribution.vue'
import { getProjectDetail } from '../api/dashboard.js'

export default {
  name: 'DashboardProjectDetailView',
  components: { MetricCard, LeaderboardCard, TrendChart, StatusDistribution },
  data: () => ({ detail: null, error: null }),
  computed: {
    id() { return Number(this.$route.params.id) },
    agentItems() {
      return (this.detail?.agentBreakdown || []).map(a => ({
        id: a.agentId, name: a.name, primary: a.sessionsTotal,
        secondary: `${this.$t('dashboard.metric.recent')} ${a.sessionsRecent7d}`,
      }))
    },
  },
  watch: { id() { this.load() } },
  mounted() { this.load() },
  methods: {
    async load() {
      try {
        const res = await getProjectDetail(this.id)
        if (res.success) this.detail = res.data
        else this.error = res.message
      } catch (e) {
        if (e?.response?.status === 404) this.$router.replace('/dashboard')
        else this.error = e?.message
      }
    },
    onSelectAgent(id) { this.$router.push({ name: 'DashboardAgent', params: { id } }) },
  },
}
</script>
<style scoped>
.dashboard-detail { padding: 20px; max-width: 1280px; margin: 0 auto; }
header { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
header h2 { flex: 1; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/views/DashboardProjectDetailView.vue
git commit -m "feat(frontend): add DashboardProjectDetailView"
```

---

## Task 17: DashboardTeamDetailView

**Files:**
- Create: `frontend/src/views/DashboardTeamDetailView.vue`

- [ ] **Step 1: 实现**

```vue
<template>
  <div class="dashboard-detail">
    <header>
      <button @click="$router.back()">←</button>
      <h2>{{ $t('dashboard.detail.team') }}: {{ detail?.team?.name || id }}</h2>
      <button @click="load">{{ $t('dashboard.refresh') }}</button>
    </header>
    <section v-if="detail" class="grid">
      <MetricCard :title="$t('dashboard.sessions.title')" :recent="detail.aggregateSessions.recent7d" :total="detail.aggregateSessions.total" />
      <MetricCard :title="$t('dashboard.tasks.title')"    :recent="detail.aggregateTasks.recent7dDone" :total="detail.aggregateTasks.total" />
    </section>
    <section v-if="detail" class="row">
      <div class="card">
        <h3>{{ $t('dashboard.tasks.byStatus') }}</h3>
        <StatusDistribution :by-status="detail.aggregateTasks.byStatus" />
      </div>
      <div class="card">
        <h3>{{ $t('dashboard.trend.title') }}</h3>
        <TrendChart :data="detail.trend30d" />
      </div>
    </section>
    <section v-if="detail">
      <LeaderboardCard
        :title="$t('dashboard.leaderboard.projects')"
        :items="projectItems"
        @select="onSelectProject"
      />
    </section>
  </div>
</template>

<script>
import MetricCard from '../components/dashboard/MetricCard.vue'
import LeaderboardCard from '../components/dashboard/LeaderboardCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import StatusDistribution from '../components/dashboard/StatusDistribution.vue'
import { getTeamDetail } from '../api/dashboard.js'

export default {
  name: 'DashboardTeamDetailView',
  components: { MetricCard, LeaderboardCard, TrendChart, StatusDistribution },
  data: () => ({ detail: null, error: null }),
  computed: {
    id() { return Number(this.$route.params.id) },
    projectItems() {
      return (this.detail?.projects || []).map(p => ({
        id: p.id, name: p.name, primary: p.id, secondary: '',
      }))
    },
  },
  watch: { id() { this.load() } },
  mounted() { this.load() },
  methods: {
    async load() {
      try {
        const res = await getTeamDetail(this.id)
        if (res.success) this.detail = res.data
        else this.error = res.message
      } catch (e) {
        if (e?.response?.status === 404) this.$router.replace('/dashboard')
        else this.error = e?.message
      }
    },
    onSelectProject(id) { this.$router.push({ name: 'DashboardProject', params: { id } }) },
  },
}
</script>
<style scoped>
.dashboard-detail { padding: 20px; max-width: 1280px; margin: 0 auto; }
header { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
header h2 { flex: 1; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/views/DashboardTeamDetailView.vue
git commit -m "feat(frontend): add DashboardTeamDetailView"
```

---

## Task 18: 路由注册

**Files:**
- Modify: `frontend/src/router/index.js`

- [ ] **Step 1: 加 4 条路由**

在 routes 数组末尾追加：

```js
{ path: '/dashboard',                 name: 'Dashboard',         component: () => import('../views/DashboardView.vue') },
{ path: '/dashboard/agents/:id',      name: 'DashboardAgent',    component: () => import('../views/DashboardAgentDetailView.vue') },
{ path: '/dashboard/projects/:id',    name: 'DashboardProject',  component: () => import('../views/DashboardProjectDetailView.vue') },
{ path: '/dashboard/teams/:id',       name: 'DashboardTeam',     component: () => import('../views/DashboardTeamDetailView.vue') },
```

- [ ] **Step 2: 启动并访问 /dashboard 冒烟**

```
cd frontend && npm run dev &
sleep 3
curl -s http://localhost:3000/dashboard | grep -i 'div id="app"'
```

期望：返回 index.html，包含 `<div id="app">`。完成后 `kill %1`。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/router/index.js
git commit -m "feat(frontend): wire dashboard routes"
```

---

## Task 19: 导航分组

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: 在 sidebar 增加运营分组**

在 `<nav class="sidebar-nav">` 内的「Workspace 组」与「平台配置 组」之间，增加：

```html
<div class="nav-group">
  <div class="nav-group-label has-divider">
    <span v-if="!isSidebarCollapsed">{{ $t('nav.groupOperations') }}</span>
    <div v-else class="nav-group-divider"></div>
  </div>
  <router-link to="/dashboard" class="nav-item" :class="{ 'router-link-active': $route.path.startsWith('/dashboard') }" :title="$t('nav.dashboard')">
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 3v18h18"></path>
      <path d="M7 14l3-3 3 3 5-5"></path>
    </svg>
    <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.dashboard') }}</span>
  </router-link>
</div>
```

- [ ] **Step 2: 启动前端，肉眼验证**

```
cd frontend && npm run dev
```

打开 http://localhost:3000，确认左侧边栏出现「运营 / 管理 → 看板」入口，点击进入 `/dashboard`。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/App.vue
git commit -m "feat(frontend): add Operations nav group with dashboard entry"
```

---

## Task 20: 端到端冒烟

无新增文件，纯人工验收 + 自动化全量回归。

- [ ] **Step 1: 启动整套服务**

```
./start.sh
```

- [ ] **Step 2: 浏览器逐项验证**

打开 http://localhost:3000/dashboard：
- 顶部团队下拉显示所有团队，项目下拉显示所有项目
- 三张 MetricCard 显示「近 7 天 / 累计」双数字
- 任务状态分布饼图渲染
- 30 天趋势折线图渲染
- 三张 Leaderboard（Agent / 项目 / 团队）显示 Top 10
- 切换团队下拉为某团队，所有指标缩窄；项目下拉变短
- 切换项目下拉为某项目，指标进一步缩窄
- 点击 Agent 行项 → 跳转 `/dashboard/agents/:id` 并加载明细
- 点击 项目 行项 → 跳转 `/dashboard/projects/:id`
- 点击 团队 行项 → 跳转 `/dashboard/teams/:id`
- 点击「刷新」按钮，网络面板看到新请求

- [ ] **Step 3: 后端全量测试**

```
cd backend && npm test
```

期望：全部通过，含新加的 `dashboardService.test.ts` 11 个用例。

- [ ] **Step 4: 前端全量测试 + build**

```
cd frontend && npm run test:run && npm run build
```

期望：所有测试通过，build 成功。

- [ ] **Step 5: 提交（如有遗漏的小修补）**

```bash
git status
# 若有遗漏，git add ... && git commit -m "fix(dashboard): ..."
```

---

## Self-Review

**1. Spec 覆盖检查：**
- 4 个端点 ✓ (Task 7)
- DashboardService / dashboardRepository ✓ (Task 1–6)
- 双数字 + 累计 ✓ (Task 11 MetricCard)
- 团队+项目联动 ✓ (Task 10 ScopeSelector)
- 4 个视图 ✓ (Task 14–17)
- 5 个 dashboard 组件 ✓ (Task 10–13)
- 4 条路由 ✓ (Task 18)
- 导航分组 ✓ (Task 19)
- echarts 依赖 ✓ (Task 8)
- i18n key ✓ (Task 9)
- 后端测试覆盖 scope/Top/趋势/NotFound ✓ (Task 1–6)
- 前端测试覆盖 Scope/Metric/Leaderboard/View ✓ (Task 10–14)

**2. Placeholder 扫描：** 无 TBD/TODO；所有步骤含可运行命令或可粘贴代码。

**3. 类型一致性：** Repository 返回类型 (`SessionStats`、`WorkflowStats`、`TaskStatusCounts`、`AgentLeaderboardEntry` 等) 与 Service 组合后的字段命名 (`sessions.recent7d`、`tasks.byStatus`、`agentTop` 等) 与端点契约和前端 props 命名一致。`scope` 在 repo / service / api / view 之间均使用 `{ teamId, projectId }`。

**已知约束/假设：**
- `NotFoundError` 的构造签名以项目实际为准（`teamService.ts` 用 `ValidationError(message, internalMessage)` 形态）。Task 6 实现时若签名不匹配，应改成 `new NotFoundError('Team not found')` 单参数形态。
- `frontend/src/locales/` 实际只有 `index.js` + `zh.js`（无 `en.js`）。若是这样，Task 9 第 2 步跳过 en.js，仅维护 zh.js。
- `getTeams` / `getProjects` 已在 `frontend/src/api/team.js` / `project.js` 中存在，直接复用。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-22-management-dashboard.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
