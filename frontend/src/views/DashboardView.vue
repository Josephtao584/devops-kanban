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
          </div>
          <div class="hero-surface__actions">
            <ScopeSelector v-model="scope" :teams="teams" :projects="projects" />
            <el-button class="hero-surface__refresh" @click="loadOverview">
              <el-icon><Refresh /></el-icon>
              {{ $t('dashboard.refresh') }}
            </el-button>
          </div>
        </div>
      </section>

      <!-- Loading / Error -->
      <div v-if="error" class="error-surface surface-panel">
        <el-icon class="error-surface__icon"><WarningFilled /></el-icon>
        <p class="error-surface__text">{{ error }}</p>
        <el-button @click="loadOverview">{{ $t('dashboard.refresh') }}</el-button>
      </div>

      <el-skeleton v-if="loading" :rows="8" animated />

      <!-- Metric cards -->
      <section v-if="overview && !loading" class="metric-grid">
        <div class="metric-card surface-card surface-card--hoverable">
          <div class="metric-card__icon" style="--icon-bg: var(--accent-color-soft); --icon-color: var(--accent-color);">
            <el-icon><Connection /></el-icon>
          </div>
          <div class="metric-card__header">
            <span class="metric-card__label">{{ $t('dashboard.sessions.title') }}</span>
          </div>
          <div class="metric-card__values">
            <div class="metric-card__value">
              <span class="metric-card__number">{{ overview.sessions.recent7d }}</span>
              <span class="metric-card__sub">{{ $t('dashboard.metric.recent') }}</span>
            </div>
            <div class="metric-card__divider"></div>
            <div class="metric-card__value">
              <span class="metric-card__number">{{ overview.sessions.total }}</span>
              <span class="metric-card__sub">{{ $t('dashboard.metric.total') }}</span>
            </div>
          </div>
          <div class="metric-card__footer">
            <el-tag size="small" type="success">{{ overview.sessions.running }} {{ $t('dashboard.sessions.running') }}</el-tag>
            <el-tag size="small" type="info">{{ overview.sessions.idle }} {{ $t('dashboard.sessions.idle') }}</el-tag>
          </div>
        </div>

        <div class="metric-card surface-card surface-card--hoverable">
          <div class="metric-card__icon" style="--icon-bg: var(--warning-soft); --icon-color: var(--warning-strong);">
            <el-icon><Document /></el-icon>
          </div>
          <div class="metric-card__header">
            <span class="metric-card__label">{{ $t('dashboard.tasks.title') }}</span>
          </div>
          <div class="metric-card__values">
            <div class="metric-card__value">
              <span class="metric-card__number">{{ overview.tasks.recent7dDone }}</span>
              <span class="metric-card__sub">{{ $t('dashboard.metric.recent') }}</span>
            </div>
            <div class="metric-card__divider"></div>
            <div class="metric-card__value">
              <span class="metric-card__number">{{ overview.tasks.total }}</span>
              <span class="metric-card__sub">{{ $t('dashboard.metric.total') }}</span>
            </div>
          </div>
          <div class="metric-card__footer">
            <span class="metric-card__footer-text">
              TODO {{ overview.tasks.byStatus.todo }}, IN_PROGRESS {{ overview.tasks.byStatus.inProgress }}, DONE {{ overview.tasks.byStatus.done }}, BLOCKED {{ overview.tasks.byStatus.blocked }}
            </span>
          </div>
        </div>

        <div class="metric-card surface-card surface-card--hoverable">
          <div class="metric-card__icon" style="--icon-bg: var(--danger-soft); --icon-color: var(--danger-strong);">
            <el-icon><Operation /></el-icon>
          </div>
          <div class="metric-card__header">
            <span class="metric-card__label">{{ $t('dashboard.workflows.title') }}</span>
          </div>
          <div class="metric-card__values">
            <div class="metric-card__value">
              <span class="metric-card__number">{{ overview.workflows.recent7dCompleted }}</span>
              <span class="metric-card__sub">{{ $t('dashboard.metric.recent') }}</span>
            </div>
            <div class="metric-card__divider"></div>
            <div class="metric-card__value">
              <span class="metric-card__number">{{ overview.workflows.total }}</span>
              <span class="metric-card__sub">{{ $t('dashboard.metric.total') }}</span>
            </div>
          </div>
          <div class="metric-card__footer">
            <el-tag size="small" type="warning">{{ overview.workflows.running }} running</el-tag>
            <el-tag size="small" type="danger">{{ overview.workflows.recent7dFailed }} failed</el-tag>
            <el-tag size="small" type="info">{{ overview.workflows.suspended }} suspended</el-tag>
          </div>
        </div>
      </section>

      <!-- Charts row -->
      <section v-if="overview && !loading" class="chart-row surface-panel">
        <div class="chart-row__card">
          <h3 class="chart-row__title">{{ $t('dashboard.tasks.byStatus') }}</h3>
          <StatusDistribution :by-status="overview.tasks.byStatus" />
        </div>
        <div class="chart-row__card">
          <h3 class="chart-row__title">{{ $t('dashboard.trend.title') }}</h3>
          <TrendChart :data="overview.trend30d" />
        </div>
      </section>

      <!-- Leaderboards -->
      <section v-if="overview && !loading" class="leaderboard-grid surface-panel">
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
        <LeaderboardCard
          :title="$t('dashboard.leaderboard.teams')"
          :items="teamItems"
          @select="onSelectTeam"
        />
      </section>
    </div>
  </div>
</template>

<script>
import { Refresh, Connection, Document, Operation, WarningFilled } from '@element-plus/icons-vue'
import ScopeSelector from '../components/dashboard/ScopeSelector.vue'
import LeaderboardCard from '../components/dashboard/LeaderboardCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import StatusDistribution from '../components/dashboard/StatusDistribution.vue'
import { getOverview } from '../api/dashboard.js'
import { getTeams } from '../api/team.js'
import { getProjects } from '../api/project.js'

export default {
  name: 'DashboardView',
  components: { ScopeSelector, LeaderboardCard, TrendChart, StatusDistribution },
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
        secondary: `${a.sessionsRecent7d} ${this.$t('dashboard.metric.recent')}`,
      }))
    },
    projectItems() {
      return (this.overview?.projectTop || []).map(p => ({
        id: p.projectId, name: p.name,
        primary: p.sessionsTotal,
        secondary: `${p.sessionsRecent7d} ${this.$t('dashboard.metric.recent')}`,
      }))
    },
    teamItems() {
      return (this.overview?.teamTop || []).map(t => ({
        id: t.teamId, name: t.name,
        primary: t.tasksTotal,
        secondary: `${t.sessionsRecent7d} ${this.$t('dashboard.metric.recent')}`,
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
.dashboard-view {
  min-height: 100%;
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

.hero-surface__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.hero-surface__refresh :deep(.el-icon) {
  margin-right: 4px;
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

.metric-card {
  position: relative;
  padding: 20px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.metric-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--icon-color, var(--accent-color));
  background: var(--icon-bg, var(--accent-color-soft));
}

.metric-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-card__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.metric-card__values {
  display: flex;
  align-items: center;
  gap: 16px;
}

.metric-card__value {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-card__number {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
}

.metric-card__sub {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-card__divider {
  width: 1px;
  height: 36px;
  background: var(--border-color);
}

.metric-card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-card__footer-text {
  font-size: 11px;
  color: var(--text-muted);
}

/* Chart row */
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
}

.chart-row__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-row__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Leaderboard grid */
.leaderboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
}

/* LeaderboardCard overrides */
.leaderboard-grid :deep(.leaderboard-card) {
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
}

.leaderboard-grid :deep(.leaderboard-card__title) {
  font-size: 13px;
  margin-bottom: 8px;
}

.leaderboard-grid :deep(.leaderboard-card__row) {
  padding: 10px 0;
  border-bottom: 1px solid rgba(100, 116, 139, 0.08);
}

.leaderboard-grid :deep(.leaderboard-card__row:last-child) {
  border-bottom: none;
}

/* Responsive */
@media (max-width: 1024px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .metric-grid,
  .chart-row,
  .leaderboard-grid {
    grid-template-columns: 1fr;
  }

  .hero-surface__inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
