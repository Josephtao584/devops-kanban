<template>
  <div class="notification-bell" :class="{ 'sidebar-collapsed': sidebarCollapsed }" ref="bellRef">
    <button class="bell-btn" @click.stop="togglePanel" :title="$t('notification.title')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span v-if="permission !== 'granted' && enabled" class="bell-badge"></span>
    </button>

    <Teleport to="body">
      <div v-if="showPanel" ref="panelRef" class="notification-panel" :style="panelStyle" @click.stop>
        <div class="panel-header">{{ $t('notification.title') }}</div>

        <!-- 权限状态 -->
        <div class="panel-section">
          <div class="section-label">{{ $t('notification.permission') }}</div>
          <div class="permission-row">
            <span class="permission-status" :class="permission">{{ permissionText }}</span>
            <button
              v-if="permission === 'default'"
              class="permission-btn"
              @click="handleRequestPermission"
            >{{ $t('notification.requestPermission') }}</button>
            <span v-else-if="permission === 'denied'" class="permission-hint">{{ $t('notification.permissionDeniedHint') }}</span>
          </div>
        </div>

        <!-- 全局开关 -->
        <div class="panel-section">
          <div class="toggle-row">
            <span>{{ $t('notification.enabled') }}</span>
            <label class="toggle">
              <input type="checkbox" :checked="enabled" @change="toggleEnabled" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- 事件类型 -->
        <div class="panel-section">
          <div class="section-label">{{ $t('notification.events') }}</div>
          <label class="checkbox-row">
            <input type="checkbox" :checked="events.workflowSuspended" @change="toggleEvent('workflowSuspended')" />
            <span>{{ $t('notification.workflowSuspended') }}</span>
          </label>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useBrowserNotifications } from '../composables/notifications/useBrowserNotifications'
import { useNotificationSettings } from '../composables/notifications/useNotificationSettings'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  sidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const { t } = useI18n()
const { permission, requestPermission } = useBrowserNotifications()
const { enabled, events, updateSettings } = useNotificationSettings()

const showPanel = ref(false)
const bellRef = ref(null)
const panelRef = ref(null)
const panelStyle = ref({})

const permissionText = computed(() => {
  const map = {
    granted: t('notification.permissionGranted'),
    denied: t('notification.permissionDenied'),
    default: t('notification.permissionDefault')
  }
  return map[permission.value] || permission.value
})

function updatePanelPosition() {
  if (!bellRef.value) return
  const rect = bellRef.value.getBoundingClientRect()
  if (props.sidebarCollapsed) {
    // 收起时：面板在铃铛右侧，从底部对齐向上生长
    panelStyle.value = {
      position: 'fixed',
      left: `${rect.right + 8}px`,
      bottom: `${window.innerHeight - rect.bottom}px`
    }
  } else {
    // 展开时：面板在铃铛正上方
    panelStyle.value = {
      position: 'fixed',
      left: `${rect.left}px`,
      bottom: `${window.innerHeight - rect.top + 8}px`
    }
  }
}

async function togglePanel() {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    await nextTick()
    updatePanelPosition()
  }
}

async function handleRequestPermission() {
  await requestPermission()
}

function toggleEnabled(e) {
  updateSettings({ enabled: e.target.checked })
}

function toggleEvent(eventType) {
  updateSettings({ events: { [eventType]: !events.value[eventType] } })
}

function handleClickOutside(e) {
  const clickedBell = bellRef.value && bellRef.value.contains(e.target)
  const clickedPanel = panelRef.value && panelRef.value.contains(e.target)
  if (!clickedBell && !clickedPanel) {
    showPanel.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.notification-bell {
  position: relative;
}

.bell-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 10px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  transition: all 0.2s ease;
}

.bell-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.bell-badge {
  position: absolute;
  top: 8px;
  right: calc(50% - 14px);
  width: 8px;
  height: 8px;
  background: var(--warning-strong);
  border-radius: 50%;
}
</style>

<style>
/* Teleported panel needs global (unscoped) styles since it's in <body> */
.notification-panel {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 16px;
  width: 260px;
  z-index: 9999;
}

.notification-panel .panel-header {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.notification-panel .panel-section {
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.notification-panel .panel-section:last-child {
  border-bottom: none;
}

.notification-panel .section-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.notification-panel .permission-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notification-panel .permission-status {
  font-size: 13px;
}

.notification-panel .permission-status.granted { color: var(--success-strong); }
.notification-panel .permission-status.denied { color: var(--danger-strong); }
.notification-panel .permission-status.default { color: var(--warning-strong); }

.notification-panel .permission-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.notification-panel .permission-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--accent-color);
  background: transparent;
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.notification-panel .permission-btn:hover {
  background: var(--accent-color);
  color: white;
}

.notification-panel .toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.notification-panel .toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.notification-panel .toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.notification-panel .slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--border-color);
  transition: 0.2s;
  border-radius: 20px;
}

.notification-panel .slider::before {
  content: '';
  position: absolute;
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

.notification-panel .toggle input:checked + .slider {
  background-color: var(--accent-color);
}

.notification-panel .toggle input:checked + .slider::before {
  transform: translateX(16px);
}

.notification-panel .checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.notification-panel .checkbox-row input[type="checkbox"] {
  accent-color: var(--accent-color);
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
