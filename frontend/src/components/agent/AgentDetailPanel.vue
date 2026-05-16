<template>
  <div class="agent-detail-panel" :class="{ 'has-chat': !collapsed }">
    <div class="detail-content">
      <div class="detail-header">
        <div class="agent-title-row">
          <div class="title-left">
            <h2>{{ agent.name }}</h2>
            <span class="role-badge-inline">
              {{ locale === 'zh' ? getRoleConfig(agent.role || 'BACKEND_DEV').name : getRoleConfig(agent.role || 'BACKEND_DEV').nameEn }}
            </span>
            <span class="executor-chip">{{ t(`agent.types.${agent.executorType}`) }}</span>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" @click.stop="emit('edit')">{{ $t('common.edit') }}</button>
            <button class="btn btn-danger btn-sm" @click.stop="emit('delete')">{{ $t('common.delete') }}</button>
          </div>
        </div>
      </div>

      <div class="info-section">
        <div class="info-item info-item--toggle">
          <span class="info-label">{{ $t('common.enabled') }}</span>
          <label class="toggle">
            <input type="checkbox" :checked="agent.enabled" @change="emit('toggle-enabled', agent)" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="info-item info-item--stacked">
          <span class="info-label">{{ $t('agent.description') }}</span>
          <span class="info-value description-text">{{ agent.description || '-' }}</span>
        </div>
      </div>

      <div class="skills-section">
        <span class="section-label">{{ $t('agent.skills') }}</span>
        <div class="skills-tags">
          <span v-for="skill in visibleSkills" :key="skill" class="skill-tag">{{ skill }}</span>
          <span v-if="visibleSkills.length === 0" class="no-items-hint">-</span>
        </div>
      </div>

      <div class="skills-section">
        <span class="section-label">{{ $t('agent.mcpServers') }}</span>
        <div class="skills-tags">
          <span v-for="name in visibleMcpServers" :key="name" class="skill-tag mcp-tag">{{ name }}</span>
          <span v-if="visibleMcpServers.length === 0" class="no-items-hint">-</span>
        </div>
      </div>

      <div class="skills-section">
        <span class="section-label">{{ $t('agent.env') }}</span>
        <div class="skills-tags">
          <span v-for="(value, key) in visibleEnv" :key="key" class="skill-tag env-tag">{{ key }}={{ value }}</span>
          <span v-if="Object.keys(visibleEnv).length === 0" class="no-items-hint">-</span>
        </div>
      </div>

      <div v-if="agent.executorType === 'CLAUDE_CODE' && agent.settingsPath" class="skills-section">
        <span class="section-label">{{ $t('agent.settingsPath') }}</span>
        <div class="skills-tags">
          <span class="skill-tag env-tag">{{ agent.settingsPath }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getRoleConfig } from '../../constants/agent'

const props = defineProps({
  agent: { type: Object, required: true },
  skills: { type: Array, default: () => [] },
  mcpServers: { type: Array, default: () => [] },
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['edit', 'delete', 'toggle-enabled'])

const { t, locale } = useI18n()

const visibleSkills = computed(() => {
  const skills = Array.isArray(props.agent?.skills) ? props.agent.skills : []
  return skills.map(skillId => {
    const skill = props.skills.find(s => s.id === skillId)
    return skill ? skill.name : null
  }).filter(name => name !== null)
})

const visibleMcpServers = computed(() => {
  const servers = Array.isArray(props.agent?.mcpServers) ? props.agent.mcpServers : []
  return servers.map(id => {
    const server = props.mcpServers.find(s => s.id === id)
    return server ? server.name : null
  }).filter(name => name !== null)
})

const visibleEnv = computed(() => {
  return props.agent?.env && typeof props.agent.env === 'object' ? props.agent.env : {}
})
</script>

<style scoped>
.agent-detail-panel {
  flex: 1;
  min-width: 0;
  background: var(--panel-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.agent-detail-panel.has-chat {
  flex: 1.5;
}

.detail-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.agent-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.title-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.role-badge-inline {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-color-strong, var(--accent-color));
  background: var(--accent-color-soft, rgba(37, 198, 201, 0.12));
  border: 1px solid transparent;
  letter-spacing: 0.02em;
}

.executor-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tertiary, rgba(31, 41, 55, 0.04));
  border: 1px solid var(--border-color);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  letter-spacing: 0;
}

.info-section {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item--toggle {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-item--stacked {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.info-item--stacked .info-label {
  width: auto;
}

.info-item--stacked .info-value {
  width: 100%;
}

.info-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.description-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.skills-section {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.skills-section:last-child {
  border-bottom: none;
}

.section-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-tag {
  background: rgba(31, 41, 55, 0.04);
  color: rgba(75, 85, 99, 0.88);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid rgba(31, 41, 55, 0.06);
  transition: all 0.18s ease;
}

.skill-tag:hover {
  background: rgba(31, 41, 55, 0.06);
  border-color: rgba(31, 41, 55, 0.1);
}

.skill-tag.mcp-tag {
  background: rgba(37, 198, 201, 0.08);
  color: var(--accent-color-strong, #1EA9AC);
  border-color: rgba(37, 198, 201, 0.16);
}

.skill-tag.env-tag {
  background: rgba(139, 92, 246, 0.08);
  color: #7c3aed;
  border-color: rgba(139, 92, 246, 0.16);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
}

.no-items-hint {
  color: var(--text-muted, var(--text-secondary));
  font-size: 12px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
  flex-shrink: 0;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  transition: 0.2s;
  border-radius: 22px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

.toggle input:checked + .slider {
  background-color: var(--accent-color);
}

.toggle input:checked + .slider:before {
  transform: translateX(16px);
}
</style>
