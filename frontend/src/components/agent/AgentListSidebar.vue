<template>
  <div class="agent-list-panel">
    <div class="panel-header">
      <h3>{{ $t('agent.teamList') }}</h3>
      <span class="agent-count">{{ agents.length }}</span>
    </div>
    <div class="agent-list" v-if="!loading">
      <div
        class="agent-list-item"
        v-for="agent in agents"
        :key="agent.id"
        :class="{ 'active': selectedId === agent.id, 'is-disabled': !agent.enabled }"
        @click.stop="emit('select', agent)"
      >
        <span class="agent-list-item__dot" :class="{ 'is-off': !agent.enabled }"></span>
        <div class="agent-list-item__body">
          <span class="agent-list-item__name">{{ agent.name }}</span>
          <span class="agent-list-item__role">{{ locale === 'zh' ? localGetRoleConfig(agent.role || 'BACKEND_DEV').name : localGetRoleConfig(agent.role || 'BACKEND_DEV').nameEn }}</span>
        </div>
      </div>
      <div v-if="agents.length === 0" class="empty-list">
        {{ $t('agent.noAgents') }}
      </div>
    </div>
    <div v-else class="loading-state">
      {{ $t('common.loading') }}
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { getRoleConfig } from '../../constants/agent'

defineProps({
  agents: { type: Array, default: () => [] },
  selectedId: { type: [Number, String], default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const { t, locale } = useI18n()

// We need to use the i18n but don't call t here; just expose locale for role display
const localGetRoleConfig = getRoleConfig
</script>

<style scoped>
.agent-list-panel {
  width: 260px;
  flex-shrink: 0;
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.agent-count {
  background: var(--accent-color-soft);
  color: var(--accent-color-strong, var(--accent-color));
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  min-width: 22px;
  text-align: center;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: var(--panel-bg);
}

.agent-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
  margin-bottom: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  text-align: left;
}

.agent-list-item:hover {
  background: var(--bg-secondary);
  border-color: rgba(37, 198, 201, 0.24);
}

.agent-list-item.active {
  background: rgba(37, 198, 201, 0.05);
  border-color: var(--accent-color);
  box-shadow: inset 0 0 0 1px rgba(37, 198, 201, 0.12);
}

.agent-list-item.is-disabled .agent-list-item__name {
  color: var(--text-secondary);
}

.agent-list-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.16);
}

.agent-list-item__dot.is-off {
  background: #d1d5db;
  box-shadow: none;
}

.agent-list-item__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
  flex: 1;
}

.agent-list-item__name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.agent-list-item__role {
  font-size: 11px;
  color: var(--text-muted, var(--text-secondary));
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-state, .empty-list {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
