<template>
  <div ref="el" class="trend-chart"></div>
</template>

<script>
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

function shortDate(d) {
  return d.length >= 10 ? d.slice(5) : d
}

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
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.chart && this.chart.resize())
      this._ro.observe(this.$refs.el)
    }
  },
  beforeUnmount() {
    window.removeEventListener('resize', this._onResize)
    this._ro && this._ro.disconnect()
    this.chart && this.chart.dispose()
  },
  methods: {
    render() {
      if (!this.chart) return
      const sessionsLabel  = this.$t('dashboard.trend.sessions')
      const tasksLabel     = this.$t('dashboard.trend.tasks')
      const workflowsLabel = this.$t('dashboard.trend.workflows')
      this.chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: {
          data: [tasksLabel, workflowsLabel, sessionsLabel],
          bottom: 0,
          itemWidth: 14,
          itemHeight: 8,
          textStyle: { fontSize: 12, color: 'var(--text-secondary)' },
        },
        grid: { left: 36, right: 16, top: 24, bottom: 36, containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: this.data.map(d => shortDate(d.date)),
          axisLabel: { fontSize: 11, color: '#9ca3af', interval: 'auto' },
          axisLine: { lineStyle: { color: '#e5e7eb' } },
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          axisLabel: { fontSize: 11, color: '#9ca3af' },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        series: [
          {
            name: tasksLabel,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#EAB445' },
            data: this.data.map(d => d.tasksCompleted),
          },
          {
            name: workflowsLabel,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#7c5cf6' },
            data: this.data.map(d => d.workflowsCompleted),
          },
          {
            name: sessionsLabel,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#25C6C9' },
            areaStyle: { opacity: 0.10, color: '#25C6C9' },
            data: this.data.map(d => d.sessionsStarted),
          },
        ],
      })
    },
  },
}
</script>

<style scoped>
.trend-chart { width: 100%; flex: 1; min-height: 220px; }
</style>
