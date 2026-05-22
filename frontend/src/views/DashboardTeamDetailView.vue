<template>
  <div class="dashboard-detail">
    <div class="dashboard-detail__inner">
      <section class="detail-hero surface-panel">
        <div class="detail-hero__inner">
          <el-button class="detail-hero__back" text @click="$router.back()">
            <el-icon><ArrowLeft /></el-icon>
            {{ $t('dashboard.back') }}
          </el-button>
          <div class="detail-hero__content">
            <p class="detail-hero__eyebrow">{{ $t('dashboard.detail.team') }}</p>
            <h1 class="detail-hero__title">{{ detail?.team?.name || id }}</h1>
            <p v-if="detail" class="detail-hero__sub">
              {{ detail.projectBreakdown.length }} {{ $t('dashboard.scope.project') }}
            </p>
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
                <span class="metric-card__number">{{ detail.aggregateSessions.recent7d }}</span>
                <span class="metric-card__sub">{{ $t('dashboard.metric.recent') }}</span>
              </div>
              <div class="metric-card__divider"></div>
              <div class="metric-card__value">
                <span class="metric-card__number">{{ detail.aggregateSessions.total }}</span>
                <span class="metric-card__sub">{{ $t('dashboard.metric.total') }}</span>
              </div>
            </div>
          </div>

          <div class="metric-card surface-card">
            <div class="metric-card__icon" style="--icon-bg: var(--warning-soft); --icon-color: var(--warning-strong);">
              <el-icon><Document /></el-icon>
            </div>
            <div class="metric-card__header">
              <span class="metric-card__label">{{ $t('dashboard.tasks.title') }}</span>
            </div>
            <div class="metric-card__values">
              <div class="metric-card__value">
                <span class="metric-card__number">{{ detail.aggregateTasks.recent7dDone }}</span>
                <span class="metric-card__sub">{{ $t('dashboard.metric.recent') }}</span>
              </div>
              <div class="metric-card__divider"></div>
              <div class="metric-card__value">
                <span class="metric-card__number">{{ detail.aggregateTasks.total }}</span>
                <span class="metric-card__sub">{{ $t('dashboard.metric.total') }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="row-grid">
          <div class="surface-panel section-block">
            <h3 class="section-title">{{ $t('dashboard.tasks.byStatus') }}</h3>
            <StatusDistribution :by-status="detail.aggregateTasks.byStatus" />
          </div>
          <div class="surface-panel section-block">
            <h3 class="section-title">{{ $t('dashboard.trend.title') }}</h3>
            <TrendChart :data="detail.trend30d" />
          </div>
        </section>

        <section class="row-grid">
          <div class="surface-panel section-block">
            <LeaderboardCard
              :title="$t('dashboard.detail.projectBreakdown')"
              :items="projectItems"
              @select="onSelectProject"
            />
          </div>
          <div class="surface-panel section-block">
            <LeaderboardCard
              :title="$t('dashboard.leaderboard.agents')"
              :items="agentItems"
              @select="onSelectAgent"
            />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script>
import { ArrowLeft, Refresh, Connection, Document, WarningFilled } from '@element-plus/icons-vue'
import LeaderboardCard from '../components/dashboard/LeaderboardCard.vue'
import TrendChart from '../components/dashboard/TrendChart.vue'
import StatusDistribution from '../components/dashboard/StatusDistribution.vue'
import { getTeamDetail } from '../api/dashboard.js'

export default {
  name: 'DashboardTeamDetailView',
  components: { ArrowLeft, Refresh, Connection, Document, WarningFilled, LeaderboardCard, TrendChart, StatusDistribution },
  data: () => ({ detail: null, error: null, loading: false }),
  computed: {
    id() { return Number(this.$route.params.id) },
    projectItems() {
      return (this.detail?.projectBreakdown || []).map(p => ({
        id: p.projectId, name: p.name,
        primary: p.sessionsTotal,
        secondary: `${this.$t('dashboard.leaderboard.tasksTotal', { n: p.tasksTotal })} · ${p.sessionsRecent7d} ${this.$t('dashboard.metric.recent')}`,
      }))
    },
    agentItems() {
      return (this.detail?.agentBreakdown || []).map(a => ({
        id: a.agentId, name: a.name,
        primary: a.sessionsTotal,
        secondary: `${a.sessionsRecent7d} ${this.$t('dashboard.metric.recent')}`,
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
        const res = await getTeamDetail(this.id)
        if (res.success) this.detail = res.data
        else this.error = res.message
      } catch (e) {
        if (e?.response?.status === 404) this.$router.replace('/dashboard')
        else this.error = e?.message
      } finally {
        this.loading = false
      }
    },
    onSelectProject(id) { this.$router.push({ name: 'DashboardProject', params: { id } }) },
    onSelectAgent(id)   { this.$router.push({ name: 'DashboardAgent',   params: { id } }) },
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

.detail-hero { padding: 18px 22px; border-radius: 16px; }
.detail-hero__inner { display: flex; align-items: center; gap: 16px; }
.detail-hero__back :deep(.el-icon) { margin-right: 4px; }
.detail-hero__content { flex: 1; min-width: 0; }
.detail-hero__eyebrow { margin: 0; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.detail-hero__title { margin: 4px 0 0; font-size: 20px; font-weight: 700; color: var(--text-primary); }
.detail-hero__sub { margin: 4px 0 0; font-size: 12px; color: var(--text-muted); }
.detail-hero__refresh :deep(.el-icon) { margin-right: 4px; }

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
.error-surface__icon { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; color: var(--danger-strong); background: rgba(239, 68, 68, 0.12); }
.error-surface__text { margin: 0; font-size: 14px; color: var(--text-secondary); }

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.metric-card { padding: 20px; border-radius: 16px; display: flex; flex-direction: column; gap: 12px; }
.metric-card__icon { width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; color: var(--icon-color, var(--accent-color)); background: var(--icon-bg, var(--accent-color-soft)); }
.metric-card__header { display: flex; align-items: center; gap: 8px; }
.metric-card__label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.metric-card__values { display: flex; align-items: center; gap: 16px; }
.metric-card__value { display: flex; flex-direction: column; gap: 2px; }
.metric-card__number { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1.1; }
.metric-card__sub { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.metric-card__divider { width: 1px; height: 36px; background: var(--border-color); }

.row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.section-block {
  padding: 20px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 2px rgba(15, 35, 50, 0.04);
}

.section-title { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--text-secondary); }

@media (max-width: 768px) {
  .metric-grid, .row-grid { grid-template-columns: 1fr; }
}
</style>
