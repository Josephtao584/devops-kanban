<template>
  <div class="leaderboard-card surface-card">
    <div class="leaderboard-card__header">
      <span class="leaderboard-card__title">{{ title }}</span>
    </div>
    <div v-if="items.length === 0" class="leaderboard-card__empty">{{ $t('dashboard.empty') }}</div>
    <ul v-else class="leaderboard-card__list">
      <li
        v-for="(it, idx) in items"
        :key="it.id"
        class="leaderboard-card__row"
        data-test="leaderboard-row"
        @click="$emit('select', it.id)"
      >
        <span class="rank" :class="rankClass(idx)">{{ idx + 1 }}</span>
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
  methods: {
    rankClass(idx) {
      if (idx === 0) return 'rank--gold'
      if (idx === 1) return 'rank--silver'
      if (idx === 2) return 'rank--bronze'
      return ''
    },
  },
}
</script>

<style scoped>
.leaderboard-card {
  padding: 16px;
  border-radius: 12px;
}

.leaderboard-card__header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.leaderboard-card__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
}

.leaderboard-card__empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px 0;
  text-align: center;
}

.leaderboard-card__list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.leaderboard-card__row {
  display: grid;
  grid-template-columns: 28px 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 8px 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.leaderboard-card__row:hover {
  background: var(--surface-tint-strong);
}

.rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}

.rank--gold {
  background: rgba(245, 158, 11, 0.16);
  color: #D97706;
}

.rank--silver {
  background: rgba(107, 114, 128, 0.16);
  color: #6B7280;
}

.rank--bronze {
  background: rgba(180, 83, 9, 0.12);
  color: #92400E;
}

.name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.primary {
  font-weight: 700;
  font-size: 14px;
  color: var(--accent-color);
}

.secondary {
  color: var(--text-muted);
  font-size: 11px;
}
</style>
