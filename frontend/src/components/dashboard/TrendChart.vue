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
