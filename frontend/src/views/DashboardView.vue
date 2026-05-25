<template>
  <div class="dashboard-view">
    <div class="dashboard-inner">

      <!-- Hero header -->
      <section class="hero-surface surface-panel">
        <div class="hero-surface__decor hero-surface__decor--a"></div>
        <div class="hero-surface__decor hero-surface__decor--b"></div>
        <div class="hero-surface__inner">
          <div class="hero-surface__content">
            <h1 class="hero-surface__title">{{ $t('dashboard.title') }}</h1>
            <p class="hero-surface__description">{{ $t('dashboard.description') }}</p>
            <p v-if="lastUpdatedLabel" class="hero-surface__meta">{{ lastUpdatedLabel }}</p>
          </div>
          <div class="hero-surface__actions">
            <ScopeSelector v-model="scope" :teams="teams" :projects="projects" />
            <el-button class="hero-surface__refresh" :loading="loading" @click="loadOverview">
              <el-icon v-if="!loading"><Refresh /></el-icon>
              {{ $t('dashboard.refresh') }}
            </el-button>
          </div>
        </div>
        <div v-if="loading && overview" class="hero-surface__progress"></div>
      </section>

      <!-- Error -->
      <div v-if="error" class="error-surface surface-panel">
        <el-icon class="error-surface__icon"><WarningFilled /></el-icon>
        <p class="error-surface__text">{{ error }}</p>
        <el-button @click="loadOverview">{{ $t('dashboard.refresh') }}</el-button>
      </div>

      <el-skeleton v-if="loading && !overview" :rows="8" animated />

      <template v-if="overview">

        <!-- Alert bar -->
        <div v-if="alerts.length > 0" class="alert-bar">
          <div v-for="alert in alerts" :key="alert.key" class="alert-bar__item" :class="'alert-bar__item--' + alert.level">
            <span class="alert-bar__dot"></span>
            <span class="alert-bar__text">
              <span>{{ alert.text }}</span>
              <template v-if="alert.items && alert.items.length">
                <span class="alert-bar__sep">：</span>
                <template v-for="(item, idx) in alert.items" :key="item.runId">
                  <a
                    class="alert-bar__link"
                    :href="item.projectId ? `/workspace/${item.projectId}` : '/workspace'"
                    @click.prevent="goToTask(item)"
                  >{{ item.taskTitle || `#${item.taskId}` }}</a>
                  <span v-if="idx < alert.items.length - 1" class="alert-bar__comma">、</span>
                </template>
              </template>
            </span>
          </div>
        </div>

        <!-- Metric cards -->
        <section class="metric-grid">

          <!-- Tasks -->
          <div class="kpi-card kpi-card--amber">
            <div class="kpi-card__top">
              <span class="kpi-card__label">{{ $t('dashboard.tasks.title') }}</span>
              <span v-if="taskVelocity > 0" class="velocity-badge">{{ taskVelocity }}/天</span>
            </div>
            <div class="kpi-card__main">
              <span class="kpi-card__number">{{ overview.tasks.recent7dDone }}</span>
              <span v-if="tasksDelta" class="delta-badge" :class="'delta-badge--' + tasksDelta.dir">
                {{ tasksDelta.dir === 'up' ? '↑' : '↓' }}{{ tasksDelta.pct !== null ? Math.abs(tasksDelta.pct) + '%' : '新增' }}
              </span>
            </div>
            <div class="kpi-card__sub">{{ recentLabel }}完成</div>
            <div class="kpi-card__stats">
              <span class="kpi-stat"><span class="kpi-stat__val">{{ overview.tasks.total }}</span><span class="kpi-stat__label">累计</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val kpi-stat__val--blue">{{ taskByStatus.inProgress || 0 }}</span><span class="kpi-stat__label">进行中</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val kpi-stat__val--red">{{ taskByStatus.blocked || 0 }}</span><span class="kpi-stat__label">阻塞</span></span>
            </div>
            <div class="kpi-completion">
              <div class="kpi-completion__bar">
                <div class="kpi-completion__fill" :style="{ width: taskCompletionPct + '%' }"></div>
              </div>
              <span class="kpi-completion__pct">{{ taskCompletionPct }}% 完成率</span>
            </div>
          </div>

          <!-- AgentTeam -->
          <div class="kpi-card kpi-card--purple">
            <div class="kpi-card__top">
              <span class="kpi-card__label">{{ $t('dashboard.workflows.title') }}</span>
              <span v-if="workflowSuccessRate !== null" class="success-rate-badge" :class="workflowSuccessRate >= 80 ? 'success-rate-badge--good' : 'success-rate-badge--warn'">
                成功率 {{ workflowSuccessRate }}%
              </span>
            </div>
            <div class="kpi-card__main">
              <span class="kpi-card__number">{{ overview.workflows.recent7dCompleted }}</span>
              <span v-if="workflowsDelta" class="delta-badge" :class="'delta-badge--' + workflowsDelta.dir">
                {{ workflowsDelta.dir === 'up' ? '↑' : '↓' }}{{ workflowsDelta.pct !== null ? Math.abs(workflowsDelta.pct) + '%' : '新增' }}
              </span>
            </div>
            <div class="kpi-card__sub">{{ recentLabel }}完成</div>
            <div class="kpi-card__stats">
              <span class="kpi-stat"><span class="kpi-stat__val">{{ overview.workflows.total }}</span><span class="kpi-stat__label">累计</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val kpi-stat__val--orange">{{ overview.workflows.running }}</span><span class="kpi-stat__label">运行中</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val kpi-stat__val--red">{{ overview.workflows.recent7dFailed }}</span><span class="kpi-stat__label">失败</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val kpi-stat__val--yellow">{{ overview.workflows.suspended }}</span><span class="kpi-stat__label">挂起</span></span>
            </div>
            <div v-if="workflowSuccessRate !== null" class="kpi-completion">
              <div class="kpi-completion__bar">
                <div class="kpi-completion__fill" :style="{ width: workflowSuccessRate + '%' }" :class="workflowSuccessRate >= 80 ? '' : 'kpi-completion__fill--warn'"></div>
              </div>
            </div>
          </div>

          <!-- Sessions -->
          <div class="kpi-card kpi-card--teal">
            <div class="kpi-card__top">
              <span class="kpi-card__label">{{ $t('dashboard.sessions.title') }}</span>
              <span v-if="overview.sessions.running > 0" class="live-badge">
                <span class="live-dot"></span>活跃中
              </span>
            </div>
            <div class="kpi-card__main">
              <span class="kpi-card__number">{{ overview.sessions.recent7d }}</span>
              <span v-if="sessionsDelta" class="delta-badge" :class="'delta-badge--' + sessionsDelta.dir">
                {{ sessionsDelta.dir === 'up' ? '↑' : '↓' }}{{ sessionsDelta.pct !== null ? Math.abs(sessionsDelta.pct) + '%' : '新增' }}
              </span>
            </div>
            <div class="kpi-card__sub">{{ recentLabel }}</div>
            <div class="kpi-card__stats">
              <span class="kpi-stat"><span class="kpi-stat__val">{{ overview.sessions.total }}</span><span class="kpi-stat__label">累计</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val kpi-stat__val--green">{{ overview.sessions.running }}</span><span class="kpi-stat__label">运行中</span></span>
              <span class="kpi-stat"><span class="kpi-stat__val">{{ overview.sessions.idle }}</span><span class="kpi-stat__label">空闲</span></span>
            </div>
          </div>

        </section>

        <!-- Bottom row: trend + status distribution -->
        <section class="bottom-row">
          <div class="bottom-row__main surface-panel">
            <h3 class="section-title">{{ trendTitle }}</h3>
            <TrendChart :data="overview.trend30d" />
          </div>
          <div class="bottom-row__side">
            <div class="surface-panel side-panel">
              <h3 class="section-title">任务状态分布</h3>
              <StatusDistribution v-if="overview.tasks.byStatus" :by-status="overview.tasks.byStatus" />
            </div>
          </div>
        </section>

        <!-- Leaderboard row -->
        <section class="surface-panel leaderboard-full">
          <LeaderboardChart
            :agent-items="agentItems"
            :project-items="projectItems"
            :team-items="teamItems"
            @select-agent="onSelectAgent"
            @select-project="onSelectProject"
            @select-team="onSelectTeam"
          />
        </section>

      </template>
    </div>
  </div>
</template>

<script>
import { Refresh, Connection, Document, Operation, WarningFilled } from '@element-plus/icons-vue'
import ScopeSelector from '../components/dashboard/ScopeSelector.vue'
import LeaderboardChart from '../components/dashboard/LeaderboardChart.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import StatusDistribution from '../components/dashboard/StatusDistribution.vue'
import { getOverview } from '../api/dashboard.js'
import { getTeams } from '../api/team.js'
import { getProjects } from '../api/project.js'

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export default {
  name: 'DashboardView',
  components: { ScopeSelector, LeaderboardChart, TrendChart, StatusDistribution },
  data() {
    return {
      scope: { teamId: null, projectId: null, windowDays: 7 },
      teams: [],
      projects: [],
      overview: null,
      loading: false,
      error: null,
      lastUpdatedAt: null,
    }
  },
  computed: {
    windowDays() { return this.scope.windowDays ?? 7 },
    recentLabel() { return this.$t('dashboard.metric.recent', { n: this.windowDays }) },
    trendTitle() { return this.$t('dashboard.trend.title', { n: this.windowDays }) },
    lastUpdatedLabel() {
      if (!this.lastUpdatedAt) return ''
      return this.$t('dashboard.lastUpdated', { time: formatTime(this.lastUpdatedAt) })
    },
    taskByStatus() {
      return this.overview?.tasks?.byStatus || {}
    },
    taskCompletionPct() {
      const total = this.overview?.tasks?.total || 0
      const done = this.taskByStatus.DONE || 0
      if (total === 0) return 0
      return Math.round((done / total) * 100)
    },
    taskVelocity() {
      const done = this.overview?.tasks?.recent7dDone || 0
      const days = this.windowDays || 7
      if (done === 0) return 0
      return (done / days).toFixed(1)
    },
    workflowSuccessRate() {
      const completed = this.overview?.workflows?.recent7dCompleted || 0
      const failed = this.overview?.workflows?.recent7dFailed || 0
      const total = completed + failed
      if (total === 0) return null
      return Math.round((completed / total) * 100)
    },
    prevPeriod() {
      return this.overview?.prevPeriod || null
    },
    sessionsDelta() {
      if (!this.prevPeriod) return null
      const curr = this.overview?.sessions?.recent7d || 0
      const prev = this.prevPeriod.sessions
      return this._calcDelta(curr, prev)
    },
    tasksDelta() {
      if (!this.prevPeriod) return null
      const curr = this.overview?.tasks?.recent7dDone || 0
      const prev = this.prevPeriod.tasksDone
      return this._calcDelta(curr, prev)
    },
    workflowsDelta() {
      if (!this.prevPeriod) return null
      const curr = this.overview?.workflows?.recent7dCompleted || 0
      const prev = this.prevPeriod.workflowsCompleted
      return this._calcDelta(curr, prev)
    },
    alerts() {
      if (!this.overview) return []
      const list = []
      const blocked = this.taskByStatus.BLOCKED || 0
      const suspended = this.overview.workflows?.suspended || 0
      const failed = this.overview.workflows?.recent7dFailed || 0
      const suspendedItems = this.overview.workflows?.suspendedItems || []
      const failedItems = this.overview.workflows?.failedItems || []
      if (blocked > 0) {
        list.push({ key: 'blocked', level: 'warn', text: `${blocked} 个任务处于阻塞状态，需要关注` })
      }
      if (suspended > 0) {
        list.push({
          key: 'suspended',
          level: 'warn',
          text: `${suspended} 个 AgentTeam 等待确认，请及时处理`,
          items: suspendedItems,
        })
      }
      if (failed > 0 && this.workflowSuccessRate !== null && this.workflowSuccessRate < 60) {
        list.push({
          key: 'failrate',
          level: 'danger',
          text: `近期 AgentTeam 成功率仅 ${this.workflowSuccessRate}%，请排查失败原因`,
          items: failedItems,
        })
      }
      return list
    },
    agentItems() {
      return (this.overview?.agentTop || []).map(a => {
        const ratePct = Math.round((a.successRate ?? 0) * 100)
        const recent = `${a.sessionsRecent7d} ${this.recentLabel}`
        const secondary = a.successRate > 0
          ? `${recent} · ${this.$t('dashboard.leaderboard.successRate', { rate: ratePct })}`
          : recent
        return { id: a.agentId, name: a.name, primary: a.sessionsTotal, secondary }
      })
    },
    projectItems() {
      return (this.overview?.projectTop || []).map(p => ({
        id: p.projectId, name: p.name,
        primary: p.sessionsTotal,
        secondary: `${p.sessionsRecent7d} ${this.recentLabel}`,
      }))
    },
    teamItems() {
      return (this.overview?.teamTop || []).map(t => ({
        id: t.teamId, name: t.name,
        primary: t.sessionsRecent7d,
        secondary: this.$t('dashboard.leaderboard.tasksTotal', { n: t.tasksTotal }),
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
    _calcDelta(curr, prev) {
      if (prev === 0 && curr === 0) return null
      if (prev === 0) return { pct: null, dir: 'up', curr, prev }
      const pct = Math.round(((curr - prev) / prev) * 100)
      return { pct, dir: pct >= 0 ? 'up' : 'down', curr, prev }
    },
    goToTask(item) {
      const target = item?.projectId
        ? `/workspace/${item.projectId}`
        : '/workspace'
      this.$router.push(target)
    },
    async loadOverview() {
      this.loading = true
      this.error = null
      try {
        const res = await getOverview(this.scope)
        if (res.success) {
          this.overview = res.data
          this.lastUpdatedAt = Date.now()
        } else {
          this.error = res.message || 'load failed'
        }
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
.dashboard-view {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(120% 80% at 20% -10%, rgba(37, 198, 201, 0.10), transparent 60%),
    radial-gradient(80% 60% at 95% 0%, rgba(99, 102, 241, 0.06), transparent 65%),
    var(--page-bg);
  padding: var(--page-padding);
}

.dashboard-inner {
  width: 100%;
  max-width: var(--page-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Hero header */
.hero-surface {
  position: relative;
  overflow: hidden;
  padding: 24px 28px;
  border-radius: 18px;
  border: 1px solid rgba(37, 198, 201, 0.18);
  background:
    linear-gradient(135deg, rgba(37, 198, 201, 0.10) 0%, rgba(37, 198, 201, 0.02) 50%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, #ffffff 100%);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.7) inset,
    0 6px 18px rgba(15, 35, 50, 0.04),
    0 24px 48px rgba(15, 35, 50, 0.05);
}

.hero-surface__decor {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.55;
}

.hero-surface__decor--a {
  top: -80px;
  right: -60px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(37, 198, 201, 0.45), transparent 70%);
}

.hero-surface__decor--b {
  bottom: -120px;
  left: 30%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(124, 92, 246, 0.18), transparent 70%);
}

.hero-surface__inner {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
  z-index: 1;
}

.hero-surface__content {
  flex: 1;
  min-width: 0;
}

.hero-surface__title {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  background: linear-gradient(135deg, #0f3a3b 0%, #25C6C9 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-surface__description {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.hero-surface__meta {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.hero-surface__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.hero-surface__refresh :deep(.el-icon) {
  margin-right: 4px;
}

.hero-surface__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: hero-progress 1.2s ease-in-out infinite;
}

@keyframes hero-progress {
  0%   { background-position: -40% 0; }
  100% { background-position: 140% 0; }
}

/* Error surface */
.error-surface {
  padding: 40px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: var(--danger-soft);
  border-color: rgba(239, 68, 68, 0.14);
}

.error-surface__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--danger-strong);
  background: rgba(239, 68, 68, 0.12);
}

.error-surface__text {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

/* Metric grid */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* KPI Card */
.kpi-card {
  position: relative;
  padding: 20px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 4px rgba(15, 35, 50, 0.05);
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}

.kpi-card:hover {
  box-shadow: 0 4px 16px rgba(15, 35, 50, 0.10);
  transform: translateY(-1px);
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  border-radius: 16px 16px 0 0;
}

.kpi-card--teal::before  { background: linear-gradient(90deg, #25C6C9, #0e9ea1); }
.kpi-card--amber::before { background: linear-gradient(90deg, #EAB445, #d97706); }
.kpi-card--purple::before{ background: linear-gradient(90deg, #7c5cf6, #5b3fd4); }

.kpi-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kpi-card__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.kpi-card__main {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.kpi-card__number {
  font-size: 36px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -0.02em;
}

.kpi-card__sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: -4px;
}

.kpi-card__stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.kpi-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kpi-stat__val {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.kpi-stat__val--green  { color: #10b981; }
.kpi-stat__val--blue   { color: #25C6C9; }
.kpi-stat__val--red    { color: #ef4444; }
.kpi-stat__val--orange { color: #f59e0b; }
.kpi-stat__val--yellow { color: #d97706; }

.kpi-stat__label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-completion {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kpi-completion__bar {
  flex: 1;
  height: 4px;
  background: var(--border-color);
  border-radius: 999px;
  overflow: hidden;
}

.kpi-completion__fill {
  height: 100%;
  background: #10b981;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.kpi-completion__fill--warn { background: #f59e0b; }

.kpi-completion__pct {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Bottom row */
.bottom-row {
  display: flex;
  gap: 16px;
  align-items: stretch;
}

.bottom-row__main {
  flex: 3 1 0;
  min-width: 0;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
  display: flex;
  flex-direction: column;
}

.bottom-row__side {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.side-panel {
  flex: 1;
  padding: 16px 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
  display: flex;
  flex-direction: column;
}

.section-title {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Leaderboard full-width row */
.leaderboard-full {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
}

/* Delta badge */
.delta-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
}

.delta-badge--up   { background: rgba(5, 150, 105, 0.10); color: #059669; }
.delta-badge--down { background: rgba(239, 68, 68, 0.08); color: #dc2626; }

/* Alert bar */
.alert-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-bar__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
}

.alert-bar__item--warn {
  background: rgba(234, 180, 69, 0.12);
  border: 1px solid rgba(234, 180, 69, 0.28);
  color: #92650a;
}

.alert-bar__item--danger {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.22);
  color: #b91c1c;
}

.alert-bar__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse-dot 1.8s ease-in-out infinite;
}

.alert-bar__item--warn   .alert-bar__dot { background: #EAB445; }
.alert-bar__item--danger .alert-bar__dot { background: #ef4444; }

.alert-bar__sep {
  margin: 0 2px;
  color: var(--text-muted);
}

.alert-bar__link {
  color: var(--el-color-primary, #2563eb);
  text-decoration: none;
  cursor: pointer;
}

.alert-bar__link:hover {
  text-decoration: underline;
}

.alert-bar__comma {
  margin: 0 2px;
  color: var(--text-muted);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.75); }
}

/* Live badge */
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  background: rgba(5, 150, 105, 0.10);
  border: 1px solid rgba(5, 150, 105, 0.22);
  padding: 2px 8px;
  border-radius: 999px;
}

.live-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse-dot 1.4s ease-in-out infinite;
}

/* Velocity badge */
.velocity-badge {
  font-size: 11px;
  font-weight: 600;
  color: #b98015;
  background: rgba(234, 180, 69, 0.12);
  border: 1px solid rgba(234, 180, 69, 0.24);
  padding: 2px 8px;
  border-radius: 999px;
}

/* Success rate badge */
.success-rate-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.success-rate-badge--good {
  color: #059669;
  background: rgba(5, 150, 105, 0.10);
  border: 1px solid rgba(5, 150, 105, 0.22);
}

.success-rate-badge--warn {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.20);
}

/* Responsive */
@media (max-width: 1280px) {
  .bottom-row__side { flex: 1 1 0; }
}

@media (max-width: 1024px) {
  .metric-grid { grid-template-columns: repeat(2, 1fr); }
  .bottom-row  { flex-direction: column; }
  .bottom-row__side { flex: unset; width: 100%; flex-direction: row; }
  .side-panel  { flex: 1; }
}

@media (max-width: 768px) {
  .metric-grid { grid-template-columns: 1fr; }
  .bottom-row__side { flex-direction: column; }
  .hero-surface__inner { flex-direction: column; align-items: flex-start; }
}
</style>
