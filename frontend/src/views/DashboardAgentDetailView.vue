<template>
  <div class="dashboard-detail">
    <div class="dashboard-detail__inner">
      <!-- Header -->
      <section class="detail-hero surface-panel">
        <div class="detail-hero__inner">
          <el-button class="detail-hero__back" text @click="$router.back()">
            <el-icon><ArrowLeft /></el-icon>
            {{ $t('dashboard.back') }}
          </el-button>
          <div class="detail-hero__content">
            <p class="detail-hero__eyebrow">{{ $t('dashboard.detail.agent') }}</p>
            <h1 class="detail-hero__title">{{ detail?.agent?.name || id }}</h1>
          </div>
          <el-button class="detail-hero__refresh" :loading="loading" @click="load">
            <el-icon v-if="!loading"><Refresh /></el-icon>
            {{ $t('dashboard.refresh') }}
          </el-button>
        </div>
      </section>

      <div v-if="error" class="error-surface surface-panel">
        <el-icon class="error-surface__icon"><WarningFilled /></el-icon>
        <p class="error-surface__text">{{ error }}</p>
        <el-button @click="load">{{ $t('dashboard.refresh') }}</el-button>
      </div>

      <el-skeleton v-if="loading && !detail" :rows="6" animated />

      <template v-if="detail">
        <!-- Metric -->
        <section class="metric-grid">
          <div class="metric-card surface-card">
            <div class="metric-card__icon" style="--icon-bg: var(--accent-color-soft); --icon-color: var(--accent-color);">
              <el-icon><Connection /></el-icon>
            </div>
            <div class="metric-card__header">
              <span class="metric-card__label">{{ $t('dashboard.sessions.title') }}</span>
            </div>
            <div class="metric-card__values">
              <div class="metric-card__value">
                <span class="metric-card__number">{{ detail.sessions.recent7d }}</span>
                <span class="metric-card__sub">{{ recentLabel }}</span>
              </div>
              <div class="metric-card__divider"></div>
              <div class="metric-card__value">
                <span class="metric-card__number">{{ detail.sessions.total }}</span>
                <span class="metric-card__sub">{{ $t('dashboard.metric.total') }}</span>
              </div>
            </div>
            <div class="metric-card__footer">
              <el-tag size="small" type="success">{{ detail.sessions.running }} {{ $t('dashboard.sessions.running') }}</el-tag>
              <el-tag size="small" type="info">{{ detail.sessions.idle }} {{ $t('dashboard.sessions.idle') }}</el-tag>
            </div>
          </div>
        </section>

        <!-- Trend -->
        <section class="chart-row surface-panel">
          <h3 class="section-title">{{ trendTitle }}</h3>
          <TrendChart :data="detail.trend30d" />
        </section>

        <!-- Breakdowns -->
        <section class="breakdown-grid surface-panel">
          <LeaderboardCard
            :title="$t('dashboard.detail.byProject')"
            :items="byProjectItems"
            @select="onSelectProject"
          />
          <LeaderboardCard
            :title="$t('dashboard.detail.byTeam')"
            :items="byTeamItems"
            @select="onSelectTeam"
          />
        </section>

        <!-- Recent sessions -->
        <section class="surface-panel section-block">
          <h3 class="section-title">{{ $t('dashboard.detail.recentSessions') }}</h3>
          <el-table v-if="detail.recentSessions.length" :data="detail.recentSessions" size="small" stripe>
            <el-table-column prop="taskTitle" :label="$t('dashboard.detail.taskColumn')" min-width="200">
              <template #default="{ row }">
                {{ row.taskTitle || `#${row.taskId}` }}
              </template>
            </el-table-column>
            <el-table-column prop="projectName" :label="$t('dashboard.detail.projectColumn')" min-width="140">
              <template #default="{ row }">
                {{ row.projectName || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="status" :label="$t('dashboard.detail.statusColumn')" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="statusTagType(row.status)">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="startedAt" :label="$t('dashboard.detail.startedAt')" width="180" />
          </el-table>
          <div v-else class="section-empty">{{ $t('dashboard.detail.noSessions') }}</div>
        </section>
      </template>
    </div>
  </div>
</template>

<script>
import { ArrowLeft, Refresh, Connection, WarningFilled } from '@element-plus/icons-vue'
import LeaderboardCard from '../components/dashboard/LeaderboardCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import { getAgentDetail } from '../api/dashboard.js'

export default {
  name: 'DashboardAgentDetailView',
  components: { ArrowLeft, Refresh, Connection, WarningFilled, LeaderboardCard, TrendChart },
  data: () => ({ detail: null, error: null, loading: false, windowDays: 7 }),
  computed: {
    id() { return Number(this.$route.params.id) },
    recentLabel() { return this.$t('dashboard.metric.recent', { n: this.windowDays }) },
    trendTitle() { return this.$t('dashboard.trend.title', { n: this.windowDays }) },
    byProjectItems() {
      return (this.detail?.byProject || []).map(b => ({
        id: b.projectId, name: b.name,
        primary: b.sessionsTotal,
        secondary: `${b.sessionsRecent7d} ${this.recentLabel}`,
      }))
    },
    byTeamItems() {
      return (this.detail?.byTeam || []).map(b => ({
        id: b.teamId, name: b.name,
        primary: b.sessionsTotal,
        secondary: `${b.sessionsRecent7d} ${this.recentLabel}`,
      }))
    },
  },
  watch: { id() { this.load() } },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      this.error = null
      try {
        const res = await getAgentDetail(this.id, { windowDays: this.windowDays })
        if (res.success) {
          this.detail = res.data
          if (res.data?.windowDays) this.windowDays = res.data.windowDays
        } else this.error = res.message
      } catch (e) {
        if (e?.response?.status === 404) this.$router.replace('/dashboard')
        else this.error = e?.message
      } finally {
        this.loading = false
      }
    },
    statusTagType(s) {
      if (s === 'COMPLETED') return 'success'
      if (s === 'RUNNING')   return 'warning'
      if (s === 'FAILED')    return 'danger'
      return 'info'
    },
    onSelectProject(id) { this.$router.push({ name: 'DashboardProject', params: { id } }) },
    onSelectTeam(id)    { this.$router.push({ name: 'DashboardTeam',    params: { id } }) },
  },
}
</script>

<style scoped>
.dashboard-detail {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(120% 80% at 20% -10%, rgba(37, 198, 201, 0.10), transparent 60%),
    var(--page-bg);
  padding: var(--page-padding);
}

.dashboard-detail__inner {
  width: 100%;
  max-width: var(--page-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Hero */
.detail-hero {
  padding: 18px 22px;
  border-radius: 16px;
}

.detail-hero__inner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.detail-hero__back :deep(.el-icon) { margin-right: 4px; }

.detail-hero__content {
  flex: 1;
  min-width: 0;
}

.detail-hero__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.detail-hero__title {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.detail-hero__refresh :deep(.el-icon) { margin-right: 4px; }

/* Error */
.error-surface {
  padding: 32px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: var(--danger-soft);
  border-color: rgba(239, 68, 68, 0.14);
}

.error-surface__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--danger-strong);
  background: rgba(239, 68, 68, 0.12);
}

.error-surface__text { margin: 0; font-size: 14px; color: var(--text-secondary); }

/* Metric */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.metric-card {
  padding: 20px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.metric-card__header { display: flex; align-items: center; gap: 8px; }
.metric-card__label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.metric-card__values { display: flex; align-items: center; gap: 16px; }
.metric-card__value { display: flex; flex-direction: column; gap: 2px; }
.metric-card__number { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.1; }
.metric-card__sub { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.metric-card__divider { width: 1px; height: 36px; background: var(--border-color); }
.metric-card__footer { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Sections */
.chart-row,
.breakdown-grid,
.section-block {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
}

.section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.breakdown-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.breakdown-grid :deep(.leaderboard-card) {
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
}

.breakdown-grid :deep(.leaderboard-card + .leaderboard-card) {
  border-left: 1px solid var(--border-color);
  padding-left: 16px;
}

.section-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

@media (max-width: 768px) {
  .metric-grid { grid-template-columns: 1fr; }
  .breakdown-grid { grid-template-columns: 1fr; }
  .breakdown-grid :deep(.leaderboard-card + .leaderboard-card) {
    border-left: none;
    padding-left: 0;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
  }
}
</style>
