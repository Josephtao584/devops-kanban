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
