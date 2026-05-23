<template>
  <div class="leaderboard-table">
    <div class="leaderboard-col" v-for="col in cols" :key="col.key">
      <div class="leaderboard-col__title">{{ col.title }}</div>
      <div v-if="col.items.length === 0" class="leaderboard-col__empty">暂无数据</div>
      <table v-else class="leaderboard-col__table">
        <tbody>
          <tr
            v-for="(item, idx) in col.items"
            :key="item.id"
            class="leaderboard-col__row"
            @click="$emit(col.event, item.id)"
          >
            <td class="cell-rank">
              <span class="rank" :class="rankClass(idx)">{{ idx + 1 }}</span>
            </td>
            <td class="cell-name">{{ item.name }}</td>
            <td class="cell-primary">{{ item.primary }}</td>
            <td class="cell-secondary">{{ item.secondary }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LeaderboardChart',
  props: {
    agentItems:   { type: Array, default: () => [] },
    projectItems: { type: Array, default: () => [] },
    teamItems:    { type: Array, default: () => [] },
  },
  emits: ['select-agent', 'select-project', 'select-team'],
  computed: {
    cols() {
      return [
        { key: 'agent',   title: 'Agent 排名', items: this.agentItems.slice(0, 8),   event: 'select-agent' },
        { key: 'project', title: '项目排名',   items: this.projectItems.slice(0, 8), event: 'select-project' },
        { key: 'team',    title: '团队排行',   items: this.teamItems.slice(0, 8),    event: 'select-team' },
      ]
    },
  },
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
.leaderboard-table {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
}

.leaderboard-col {
  padding: 0 20px;
}

.leaderboard-col + .leaderboard-col {
  border-left: 1px solid var(--border-color);
}

.leaderboard-col__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.leaderboard-col__empty {
  font-size: 13px;
  color: var(--text-muted);
  padding: 16px 0;
  text-align: center;
}

.leaderboard-col__table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-col__row {
  cursor: pointer;
  transition: background 0.12s;
}

.leaderboard-col__row:hover {
  background: var(--hover-bg, rgba(0,0,0,0.03));
}

.leaderboard-col__row + .leaderboard-col__row td {
  border-top: 1px solid rgba(100, 116, 139, 0.07);
}

td {
  padding: 8px 4px;
  font-size: 13px;
  vertical-align: middle;
}

.cell-rank {
  width: 28px;
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

.rank--gold   { background: rgba(245, 158, 11, 0.16); color: #D97706; }
.rank--silver { background: rgba(107, 114, 128, 0.16); color: #6B7280; }
.rank--bronze { background: rgba(180, 83, 9, 0.12); color: #92400E; }

.cell-name {
  color: var(--text-primary);
  font-weight: 500;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-primary {
  font-weight: 700;
  color: var(--accent-color);
  text-align: right;
  white-space: nowrap;
  width: 36px;
}

.cell-secondary {
  color: var(--text-muted);
  font-size: 11px;
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .leaderboard-table {
    grid-template-columns: 1fr;
  }
  .leaderboard-col + .leaderboard-col {
    border-left: none;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
    margin-top: 16px;
  }
}
</style>
