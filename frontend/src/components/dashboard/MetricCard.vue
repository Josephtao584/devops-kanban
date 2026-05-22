<template>
  <div class="metric-card" data-test="metric-card" :class="{ clickable }" @click="onClick">
    <div class="metric-card__title">{{ title }}</div>
    <div class="metric-card__values">
      <div class="metric-card__recent">
        <span class="label">{{ $t('dashboard.metric.recent') }}</span>
        <span class="value">{{ recent }}</span>
      </div>
      <div class="metric-card__total">
        <span class="label">{{ $t('dashboard.metric.total') }}</span>
        <span class="value">{{ total }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MetricCard',
  props: {
    title:     { type: String, required: true },
    recent:    { type: Number, required: true },
    total:     { type: Number, required: true },
    clickable: { type: Boolean, default: false },
  },
  emits: ['click'],
  methods: {
    onClick() {
      if (this.clickable) this.$emit('click')
    },
  },
}
</script>

<style scoped>
.metric-card { padding: 16px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--bg-primary); }
.metric-card.clickable { cursor: pointer; }
.metric-card.clickable:hover { box-shadow: var(--shadow-md); }
.metric-card__title { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.metric-card__values { display: flex; gap: 24px; }
.metric-card__recent .value, .metric-card__total .value { font-size: 24px; font-weight: 600; color: var(--text-primary); }
.label { display: block; font-size: 12px; color: var(--text-muted); }
</style>
