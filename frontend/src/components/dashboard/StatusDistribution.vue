<template>
  <div class="status-distribution">
    <div class="total-row">
      <span class="total-row__num">{{ total }}</span>
      <span class="total-row__label">任务总数</span>
    </div>

    <div class="bars">
      <div v-for="row in rows" :key="row.key" class="bar-row">
        <div class="bar-row__head">
          <span class="bar-row__dot" :style="{ background: row.color }"></span>
          <span class="bar-row__label">{{ row.label }}</span>
          <span class="bar-row__value">{{ row.value }}</span>
          <span class="bar-row__pct">{{ row.pct.toFixed(0) }}%</span>
        </div>
        <div class="bar-row__track">
          <div
            class="bar-row__bar"
            :style="{ width: row.pct + '%', background: row.color }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const STATUS_ORDER = ['todo', 'inProgress', 'done', 'blocked']

const STATUS_LABELS = {
  todo:        '待处理',
  inProgress:  '进行中',
  done:        '已完成',
  blocked:     '阻塞',
}
const STATUS_COLORS = {
  todo:        '#94a3b8',
  inProgress:  '#25C6C9',
  done:        '#10b981',
  blocked:     '#ef4444',
}

export default {
  name: 'StatusDistribution',
  props: { byStatus: { type: Object, required: true } },
  computed: {
    rows() {
      const keys = STATUS_ORDER.filter(k => this.byStatus[k] !== undefined)
      const values = keys.map(k => Number(this.byStatus[k] ?? 0))
      const total = values.reduce((a, b) => a + b, 0) || 0
      return keys.map((k, i) => ({
        key: k,
        label: STATUS_LABELS[k] ?? k,
        color: STATUS_COLORS[k] ?? '#94a3b8',
        value: values[i],
        pct: total === 0 ? 0 : (values[i] / total) * 100,
      }))
    },
    total() {
      return this.rows.reduce((a, r) => a + r.value, 0)
    },
  },
}
</script>

<style scoped>
.status-distribution {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.total-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.total-row__num {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -0.02em;
}

.total-row__label {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}

.bar-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bar-row__head {
  display: grid;
  grid-template-columns: 10px 1fr auto auto;
  align-items: center;
  gap: 8px;
}

.bar-row__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.bar-row__label {
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

.bar-row__value {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.bar-row__pct {
  font-size: 10px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  min-width: 30px;
  text-align: right;
}

.bar-row__track {
  height: 8px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}

.bar-row__bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}
</style>
