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
