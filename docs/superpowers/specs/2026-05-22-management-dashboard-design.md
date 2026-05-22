# 管理看板（Management Dashboard）设计

- 日期：2026-05-22
- 分支：dev
- 范围：新增运营/管理看板页面，主页 + Agent / 项目 / 团队 三类明细页

## 1. 背景与目标

当前 Coplat 的导航以工作流执行（Workspace、Workflow Template、Agent 等）为中心，缺少给运营/管理者用的全局视角。需要一个看板页面，让管理者快速看到：

- Session 数量（运行中、空闲、累计、近 7 天）
- 任务状态分布（按 status）
- 每个 Agent 的执行任务数量与表现
- 每个项目的执行任务数量
- 每个团队的执行任务数量
- 近 30 天 session/任务/workflow 趋势

并能从主页下钻到 Agent / 项目 / 团队 的运营明细页。

## 2. 用户场景与定位

- 用户角色：运营 / 团队 leader / 平台管理者
- 主要诉求：进页后一眼看到全局数据，可以按团队或项目缩窄范围
- 不在本期：自定义时间窗、导出 CSV、实时推送、用户级权限

## 3. 关键设计决策

| 项 | 决策 | 备注 |
|---|---|---|
| 数据聚合层 | 后端单端点一次返回 | 复用现有 Routes → Services → Repositories 分层 |
| 粒度切换 | 顶部「团队 + 项目」两级联动下拉 | 团队选具体值后，项目下拉只显示该团队下项目 |
| 时间窗 | 卡片同时显示「近 7 天」和「累计」两个数字 | 趋势线固定近 30 天 |
| 数据新鲜度 | 进页加载一次 + 手动刷新按钮 | 不引入 WebSocket 推送、不引入轮询 |
| 入口位置 | 左侧导航新增一组「运营 / 管理」 | 与「Workspace」「平台配置」并列 |
| 下钻范围 | 本期全量交付：主页 + 3 类明细页 | Agent / 项目 / 团队 各一个明细路由 |
| 图表库 | 引入 `echarts ^5.5.0`（按需引入 line + pie） | 当前 frontend 无图表库 |

## 4. 架构

```
DashboardView (/dashboard)
  ├─ ScopeSelector             顶部 团队+项目 两级联动
  ├─ MetricCard ×N             Session / 任务 / Workflow 总体（近期+累计）
  ├─ StatusDistribution        任务状态环形/分布
  ├─ LeaderboardCard ×3        Top Agent / 项目 / 团队
  └─ TrendChart                近 30 天 session/任务/workflow 趋势

  ↓ axios

GET /api/dashboard/overview?teamId?&projectId?
GET /api/dashboard/agents/:agentId?teamId?&projectId?
GET /api/dashboard/projects/:projectId
GET /api/dashboard/teams/:teamId

  ↓ Fastify routes/dashboard.ts
  ↓ DashboardService
  ↓ dashboardRepository (跨表聚合 SQL)
        + 复用 taskRepository / sessionRepository / agentRepository /
              teamRepository / workflowRunRepository
```

## 5. 后端

### 5.1 新增文件

- `backend/src/routes/dashboard.ts` — 4 个 GET 路由，统一走 `successResponse` / `errorResponse`
- `backend/src/services/DashboardService.ts` — 聚合逻辑入口
- `backend/src/repositories/dashboardRepository.ts` — 跨表聚合 SQL（不属于单一实体表，独立放）

### 5.2 路由注册

在 `backend/src/routes/index.ts` 注册：
```ts
await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
```

### 5.3 端点契约

```
GET /api/dashboard/overview?teamId?&projectId?
→ {
    scope: { teamId, projectId, teamName, projectName },
    sessions:  { running, idle, recent7d, total },
    tasks:     { byStatus: { TODO, IN_PROGRESS, DONE, BLOCKED, CANCELLED, REQUIREMENTS },
                  recent7dDone, total },
    workflows: { running, suspended, recent7dCompleted, recent7dFailed, total },
    agentTop:    [{ agentId, name, sessionsTotal, sessionsRecent7d, successRate }],   // limit 10
    projectTop:  [{ projectId, name, tasksTotal, sessionsTotal, sessionsRecent7d }],   // limit 10
    teamTop:     [{ teamId, name, projectCount, tasksTotal, sessionsRecent7d }],       // limit 10
    trend30d:    [{ date: 'YYYY-MM-DD', sessionsStarted, tasksCompleted, workflowsCompleted }]
  }

GET /api/dashboard/agents/:agentId?teamId?&projectId?
→ { agent, sessions, recentSessions[20], byProject, byTeam, trend30d }

GET /api/dashboard/projects/:projectId
→ { project, team, sessions, tasks, agentBreakdown, recentSessions[20], trend30d }

GET /api/dashboard/teams/:teamId
→ { team, projects, aggregateSessions, aggregateTasks, agentBreakdown, trend30d }
```

所有响应统一包装为 `{ success, message, data, error }`。

### 5.4 Scope 过滤

- 不传 `teamId` 和 `projectId` → 全局
- 仅传 `teamId` → SQL 中通过 `projects.team_id = ?` 过滤
- 传 `projectId` → SQL 中通过 `tasks.project_id = ?` 过滤（projectId 优先于 teamId）
- Top 列表始终遵循同一 scope，不"忽略过滤"

### 5.5 关键 SQL 模式（dashboardRepository）

```sql
-- 任务按状态分布（带 scope）
SELECT status, COUNT(*) AS c
FROM tasks t
WHERE (:projectId IS NULL OR t.project_id = :projectId)
  AND (:teamId    IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = :teamId))
GROUP BY status;

-- Agent 排行
SELECT s.agent_id, a.name,
       COUNT(*) AS total,
       SUM(CASE WHEN s.started_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7d,
       AVG(CASE WHEN s.status='COMPLETED' THEN 1.0 WHEN s.status='FAILED' THEN 0.0 END) AS success_rate
FROM sessions s
JOIN agents a ON a.id = s.agent_id
JOIN tasks  t ON t.id = s.task_id
WHERE s.agent_id IS NOT NULL
  AND (:projectId IS NULL OR t.project_id = :projectId)
  AND (:teamId    IS NULL OR t.project_id IN (SELECT id FROM projects WHERE team_id = :teamId))
GROUP BY s.agent_id, a.name
ORDER BY total DESC
LIMIT 10;

-- 30 天趋势
WITH RECURSIVE days(d) AS (
  SELECT date('now','-29 days')
  UNION ALL SELECT date(d,'+1 day') FROM days WHERE d < date('now')
)
SELECT d AS date,
       (SELECT COUNT(*) FROM sessions      WHERE date(started_at)=d AND ...) AS sessions_started,
       (SELECT COUNT(*) FROM tasks         WHERE date(updated_at)=d AND status='DONE' AND ...) AS tasks_completed,
       (SELECT COUNT(*) FROM workflow_runs WHERE date(updated_at)=d AND status='COMPLETED' AND ...) AS workflows_completed
FROM days;
```

### 5.6 索引

现有 schema 已具备：
- `idx_tasks_project_id`、`idx_tasks_status`
- `idx_sessions_task_id`、`idx_sessions_status`
- `idx_workflow_runs_status`、`idx_workflow_runs_task_id`
- `idx_projects_team_id`

覆盖所有过滤路径。**本期不新增索引。**

### 5.7 错误处理

- `teamId` / `projectId` / `agentId` 不存在 → `{ success: false, error: 'NOT_FOUND' }` + HTTP 404
- 聚合内部任一查询异常 → service 顶层 try/catch，返回 `{ success: false, error: '...' }` + HTTP 500，错误信息脱敏
- 路由层使用 Zod 校验 query 参数，非数字传入 → 400 + 校验错误

### 5.8 常量

`DashboardService` 内：
- `NEAR_TERM_DAYS = 7` —「近期」窗口
- `TREND_DAYS = 30` — 趋势窗口
- `LEADERBOARD_LIMIT = 10` — Top N
- `RECENT_SESSIONS_LIMIT = 20` — 明细页最近 session 列表

## 6. 前端

### 6.1 新增文件

```
frontend/src/views/DashboardView.vue
frontend/src/views/DashboardAgentDetailView.vue
frontend/src/views/DashboardProjectDetailView.vue
frontend/src/views/DashboardTeamDetailView.vue
frontend/src/components/dashboard/ScopeSelector.vue
frontend/src/components/dashboard/MetricCard.vue
frontend/src/components/dashboard/LeaderboardCard.vue
frontend/src/components/dashboard/TrendChart.vue
frontend/src/components/dashboard/StatusDistribution.vue
frontend/src/api/dashboard.js
```

### 6.2 依赖

- 新增 `echarts ^5.5.0` 到 `frontend/package.json` dependencies
- TrendChart / StatusDistribution 按需引入 `LineChart` / `PieChart` + 必要的 component / renderer，避免引入完整包

### 6.3 状态管理

不引入 Pinia store。看板数据进页拉一次后存于组件 `ref`，没有跨视图复用需求。ScopeSelector 内通过 `team` API + `project` API 拉一次列表，按选中 team 在前端过滤项目下拉项。切换 team 后若当前选中 project 不属于新 team，则把 project 重置为「全部」。

### 6.4 路由

修改 `frontend/src/router/index.js`，新增 4 条：

```js
{ path: '/dashboard',                 name: 'Dashboard',         component: () => import('../views/DashboardView.vue') },
{ path: '/dashboard/agents/:id',      name: 'DashboardAgent',    component: () => import('../views/DashboardAgentDetailView.vue') },
{ path: '/dashboard/projects/:id',    name: 'DashboardProject',  component: () => import('../views/DashboardProjectDetailView.vue') },
{ path: '/dashboard/teams/:id',       name: 'DashboardTeam',     component: () => import('../views/DashboardTeamDetailView.vue') },
```

### 6.5 导航分组

修改 `App.vue`，左侧导航新增一组「运营 / 管理」：

```
Workspace
  - 项目
  - 工作台
运营 / 管理               ← 新增
  - 看板
平台配置
  - 工作流模板
  - Agent
  - 技能
  - MCP 服务器
```

对应 i18n key：`nav.groupOperations`、`nav.dashboard`，在 `zh.js` / `en.js` 同步加。

### 6.6 主页布局（DashboardView.vue）

```
┌─────────────────────────────────────────────────────┐
│  运营看板        [团队▾] [项目▾]          [↻ 刷新]  │
├─────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │Session  │ │任务     │ │Workflow │ │成功率   │    │
│ │近 12/总145│ │近 8/总67 │ │近 4/总23 │ │  92%   │    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
├──────────────────────┬──────────────────────────────┤
│ 任务状态分布         │ 近 30 天趋势                 │
│ (Pie)                │ (Line)                       │
├──────────────────────┼──────────────────────────────┤
│ Agent 排行          │ 项目排行                      │
│ (Top 10 列表)        │ (Top 10 列表)                │
├──────────────────────┴──────────────────────────────┤
│ 团队排行 (Top 10 列表)                              │
└─────────────────────────────────────────────────────┘
```

每张卡右上角小刷新图标按钮（仅刷新自己），整页右上角全局刷新按钮。

### 6.7 下钻

主页 LeaderboardCard 行项点击 → `router.push({ name: 'DashboardAgent', params: { id } })` 等。明细页内若再有可点链接也用同样方式。

## 7. i18n

`frontend/src/locales/zh.js` 和 `en.js` 同步新增：

```
nav.groupOperations: '运营 / 管理'  | 'Operations'
nav.dashboard:       '看板'         | 'Dashboard'
dashboard.title:     '运营看板'     | 'Operations Dashboard'
dashboard.scope.team:    '团队'     | 'Team'
dashboard.scope.project: '项目'     | 'Project'
dashboard.scope.all:     '全部'     | 'All'
dashboard.metric.recent: '近 7 天'  | 'Last 7 days'
dashboard.metric.total:  '累计'     | 'Total'
dashboard.sessions.running:  '进行中' | 'Running'
dashboard.sessions.idle:     '空闲'   | 'Idle'
dashboard.tasks.byStatus:    '任务状态分布' | 'Tasks by status'
dashboard.workflows.title:   'Workflow' | 'Workflow'
dashboard.leaderboard.agents:   'Agent 排行' | 'Top Agents'
dashboard.leaderboard.projects: '项目排行'   | 'Top Projects'
dashboard.leaderboard.teams:    '团队排行'   | 'Top Teams'
dashboard.trend.title:   '近 30 天趋势' | 'Last 30 days'
dashboard.refresh:       '刷新'         | 'Refresh'
dashboard.empty:         '暂无数据'     | 'No data'
dashboard.detail.agent:   'Agent 明细' | 'Agent details'
dashboard.detail.project: '项目明细'   | 'Project details'
dashboard.detail.team:    '团队明细'   | 'Team details'
```

## 8. 测试

### 8.1 后端（Node test runner + tsx）

`backend/tests/services/DashboardService.test.ts` — 用内存 LibSQL 准备 fixtures：

- 3 团队 / 5 项目 / 20 任务 / 30 session / 5 agent / 10 workflow run

覆盖：

- `getOverview()` 全局 scope 数字加总正确
- `getOverview({ teamId })` 排除其他团队的任务/session
- `getOverview({ projectId })` 进一步缩窄
- Top 列表按 total 降序、limit 10
- 趋势数组长度恒为 30、缺数据天补 0
- 不存在的 teamId / projectId / agentId 抛 NOT_FOUND

### 8.2 前端（Vitest）

- `DashboardView.spec.js` — mock dashboard api，断言：scope 切换会重新调 API、卡片显示 loading→data、空数据态文案、点击 leaderboard 行项触发路由跳转
- `ScopeSelector.spec.js` — 团队选「全部」时项目下拉显示所有项目；团队选具体值时项目下拉只显示该团队下的项目
- `MetricCard.spec.js` / `LeaderboardCard.spec.js` — 渲染 props，"近期 / 累计" 数字位置正确

Mock 模式遵循已记录的偏好：store mock 返回 `ref.value` 的形式，不是裸 ref。

## 9. 错误与边界

- 无团队/无项目时 ScopeSelector 显示「全部」为唯一选项，主页正常渲染全局数据
- session 表数据可能存在 `agent_id IS NULL`（早期 session）→ Agent 排行 SQL 用 `WHERE s.agent_id IS NOT NULL` 排除
- session.status 为空字符串/NULL → 「进行中」只匹配 `'RUNNING'`，「空闲」只匹配 `'IDLE'`
- 趋势线某天 0 数据 → 返回数组该项各字段为 0（不是缺项），前端图表默认连为零
- 后端任一聚合查询失败 → 整个端点 500 + 错误日志，前端整页 error 态 + retry 按钮（不做单卡片局部错误，避免复杂度）
- 团队/项目被删除后用户访问 `/dashboard/teams/:已删id` → 后端 404 → 前端跳回 `/dashboard` 并提示

## 10. 不在本期范围

- 时间窗自定义（固定 7 天 / 30 天）
- CSV 导出
- WebSocket 实时推送（手动刷新已满足）
- 数据缓存层（首版直接 SQL，后续按需加）
- 用户级权限（看板对所有登录用户可见，与现有 workspace 权限模型一致）
