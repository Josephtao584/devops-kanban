import { config } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'

// Set up a global Pinia instance for tests
setActivePinia(createPinia())

config.global.plugins = [ElementPlus]

// Global stubs for echarts-based components (canvas not available in jsdom)
config.global.stubs = {
  TrendChart: { template: '<div data-test="trend-chart"></div>', name: 'TrendChart' },
  StatusDistribution: { template: '<div data-test="status-distribution"></div>', name: 'StatusDistribution' },
}
