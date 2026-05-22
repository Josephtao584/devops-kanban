<template>
  <div ref="el" class="status-distribution"></div>
</template>

<script>
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

export default {
  name: 'StatusDistribution',
  props: { byStatus: { type: Object, required: true } },
  data: () => ({ chart: null }),
  watch: { byStatus: { handler() { this.render() }, deep: true } },
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
      const entries = Object.entries(this.byStatus).map(([k, v]) => ({ name: k, value: Number(v) }))
      this.chart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 0 },
        series: [{
          name: 'Tasks',
          type: 'pie',
          radius: ['40%', '70%'],
          data: entries,
        }],
      })
    },
  },
}
</script>

<style scoped>
.status-distribution { width: 100%; height: 280px; }
</style>
