<template>
  <div class="leaderboard-card">
    <div class="leaderboard-card__title">{{ title }}</div>
    <div v-if="items.length === 0" class="leaderboard-card__empty">{{ $t('dashboard.empty') }}</div>
    <ul v-else class="leaderboard-card__list">
      <li
        v-for="(it, idx) in items"
        :key="it.id"
        class="leaderboard-card__row"
        data-test="leaderboard-row"
        @click="$emit('select', it.id)"
      >
        <span class="rank">{{ idx + 1 }}</span>
        <span class="name">{{ it.name }}</span>
        <span class="primary">{{ it.primary }}</span>
        <span v-if="it.secondary != null" class="secondary">{{ it.secondary }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'LeaderboardCard',
  props: {
    title: { type: String, required: true },
    items: { type: Array, required: true },
  },
  emits: ['select'],
}
</script>

<style scoped>
.leaderboard-card { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; }
.leaderboard-card__title { font-weight: 600; margin-bottom: 12px; }
.leaderboard-card__empty { color: var(--text-muted); font-size: 13px; }
.leaderboard-card__list { list-style: none; padding: 0; margin: 0; }
.leaderboard-card__row { display: grid; grid-template-columns: 24px 1fr auto auto; gap: 12px; padding: 8px 0; cursor: pointer; }
.leaderboard-card__row:hover { background: var(--hover-bg); }
.rank { color: var(--text-muted); }
.primary { font-weight: 600; }
.secondary { color: var(--text-secondary); font-size: 12px; }
</style>
