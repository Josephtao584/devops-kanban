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
