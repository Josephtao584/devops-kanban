<template>
  <div class="notification-bell" :class="{ 'sidebar-collapsed': sidebarCollapsed }" ref="bellRef">
    <button class="bell-btn" @click.stop="togglePanel" :title="$t('notification.title')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="showPanel" ref="panelRef" class="notification-panel" :style="panelStyle" @click.stop>
        <div class="panel-header">{{ $t('notification.title') }}</div>

        <!-- 聊天通知 -->
        <div class="panel-section">
          <div class="toggle-row">
            <span>{{ $t('notification.chatEnabled') }}</span>
            <label class="toggle">
              <input type="checkbox" :checked="chatEnabled" @change="toggleChatEnabled" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- 通知事件 -->
        <div class="panel-section">
          <div class="section-label">{{ $t('notification.events') }}</div>
          <div class="toggle-row">
            <span>{{ $t('notification.workflowSuspended') }}</span>
            <label class="toggle">
              <input type="checkbox" :checked="events.workflowSuspended" @change="toggleEvent('workflowSuspended', $event)" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-row" style="margin-top: 6px">
            <span>{{ $t('notification.workflowCompleted') }}</span>
            <label class="toggle">
              <input type="checkbox" :checked="events.workflowCompleted" @change="toggleEvent('workflowCompleted', $event)" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="toggle-row" style="margin-top: 6px">
            <span>{{ $t('notification.workflowFailed') }}</span>
            <label class="toggle">
              <input type="checkbox" :checked="events.workflowFailed" @change="toggleEvent('workflowFailed', $event)" />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <!-- 调度配置 -->
        <div class="panel-section">
          <div class="section-label">{{ $t('notification.scheduler.title') }}</div>
          <div class="toggle-row">
            <span>{{ $t('notification.scheduler.currentRunning') }}</span>
            <div style="display:flex;align-items:center;gap:6px;">
              <strong>{{ activeWorkflowCount }}</strong>
              <button class="refresh-btn" :disabled="statusLoading" @click="refreshStatus" :title="$t('notification.scheduler.refresh')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </button>
            </div>
          </div>
          <div class="input-row" style="margin-top:6px">
            <label>{{ $t('notification.scheduler.dispatchCron') }}</label>
            <select class="text-input" :value="dispatchCronPreset" @change="onCronPresetChange($event.target.value)">
              <option v-for="p in cronPresets" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
          <div v-if="dispatchCronPreset === '__custom__'" class="input-row">
            <input v-model="customCron" class="text-input" :placeholder="$t('notification.scheduler.customPlaceholder')" @blur="onCustomCronBlur" />
          </div>
          <div class="input-row" style="margin-top:6px">
            <label>{{ $t('notification.scheduler.maxConcurrent') }}</label>
            <input type="number" v-model.number="schedulerConfig['scheduler.max_concurrent_workflows']" class="text-input" min="1" @blur="saveSchedulerConfig" />
          </div>
          <div class="input-row">
            <label>{{ $t('notification.scheduler.maxTasksPerExecution') }}</label>
            <input type="number" v-model.number="schedulerConfig['scheduler.max_tasks_per_execution']" class="text-input" min="1" @blur="saveSchedulerConfig" />
          </div>
          <button class="test-btn" :disabled="triggerLoading" @click="handleTriggerDispatch">
            {{ triggerLoading ? $t('notification.scheduler.triggering') : $t('notification.scheduler.triggerNow') }}
          </button>
        </div>

        <div v-if="chatEnabled" class="panel-section">
          <div class="input-row">
            <label>{{ $t('notification.apiUrl') }}</label>
            <input
              v-model="chatConfig.url"
              class="text-input"
              :placeholder="$t('notification.apiUrlPlaceholder')"
              @blur="saveChatConfig"
            />
          </div>
          <div class="input-row">
            <label>{{ $t('notification.apiReceiver') }}</label>
            <input
              v-model="chatConfig.receiver"
              class="text-input"
              :placeholder="$t('notification.apiReceiverPlaceholder')"
              @blur="saveChatConfig"
            />
          </div>
          <div class="input-row">
            <label>{{ $t('notification.apiAuth') }}</label>
            <input
              v-model="chatConfig.auth"
              class="text-input"
              type="password"
              :placeholder="$t('notification.apiAuthPlaceholder')"
              @blur="saveChatConfig"
            />
          </div>
          <button class="test-btn" :disabled="chatLoading" @click="handleTestSend">
            {{ chatLoading ? $t('notification.sending') : $t('notification.testSend') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useNotificationSettings } from '../composables/notifications/useNotificationSettings'
import { useI18n } from 'vue-i18n'
import { getNotificationConfig, saveNotificationConfig, sendNotification } from '../api/notification.js'
import { getSettings, updateSettings as updateSchedulerSettings, getSchedulerStatus, triggerDispatch } from '../api/settings.js'

const props = defineProps({
  sidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const { t } = useI18n()
const { chatEnabled, updateSettings } = useNotificationSettings()

const showPanel = ref(false)
const bellRef = ref(null)
const panelRef = ref(null)
const panelStyle = ref({})

const chatConfig = ref({ url: '', receiver: '', auth: '' })
const chatLoading = ref(false)
const chatConfigLoaded = ref(false)
const events = ref({
  workflowSuspended: true,
  workflowCompleted: false,
  workflowFailed: false
})

const schedulerLoaded = ref(false)
const activeWorkflowCount = ref(0)
const schedulerConfig = ref({
  'scheduler.workflow_dispatch_cron': '*/5 * * * *',
  'scheduler.max_concurrent_workflows': 3,
  'scheduler.max_tasks_per_execution': 10,
})
const dispatchCronPreset = ref('*/5 * * * *')
const customCron = ref('')
const triggerLoading = ref(false)
const statusLoading = ref(false)

const cronPresets = [
  { label: t('notification.scheduler.minute1'), value: '* * * * *' },
  { label: t('notification.scheduler.minute5'), value: '*/5 * * * *' },
  { label: t('notification.scheduler.minute15'), value: '*/15 * * * *' },
  { label: t('notification.scheduler.minute30'), value: '*/30 * * * *' },
  { label: t('notification.scheduler.hour1'), value: '0 * * * *' },
  { label: t('notification.scheduler.custom'), value: '__custom__' },
]

async function loadChatConfig() {
  if (chatConfigLoaded.value) return
  try {
    const response = await getNotificationConfig()
    if (response.success && response.data) {
      chatConfig.value = {
        url: response.data.url || '',
        receiver: response.data.receiver || '',
        auth: response.data.auth || ''
      }
      if (response.data.events) {
        events.value = { ...events.value, ...response.data.events }
      }
      chatConfigLoaded.value = true
    }
  } catch {
    // Silently fail
  }
}

async function saveChatConfig() {
  if (!chatConfig.value.url) return
  try {
    await saveNotificationConfig({ ...chatConfig.value, events: events.value })
  } catch {
    // Silently fail
  }
}

function toggleEvent(key, e) {
  events.value[key] = e.target.checked
  saveChatConfig()
}

async function handleTestSend() {
  if (!chatConfig.value.url) return
  chatLoading.value = true
  try {
    await sendNotification('通知测试 — 测试消息')
  } finally {
    chatLoading.value = false
  }
}

async function loadSchedulerConfig() {
  if (schedulerLoaded.value) return
  try {
    const [settingsRes, statusRes] = await Promise.all([
      getSettings(),
      getSchedulerStatus(),
    ])
    if (settingsRes.success && settingsRes.data) {
      const data = settingsRes.data
      schedulerConfig.value = {
        'scheduler.workflow_dispatch_cron': data['scheduler.workflow_dispatch_cron'] || '*/5 * * * *',
        'scheduler.max_concurrent_workflows': parseInt(data['scheduler.max_concurrent_workflows'] || '3'),
        'scheduler.max_tasks_per_execution': parseInt(data['scheduler.max_tasks_per_execution'] || '10'),
      }
      const cronVal = schedulerConfig.value['scheduler.workflow_dispatch_cron']
      const preset = cronPresets.find(p => p.value === cronVal)
      dispatchCronPreset.value = preset ? cronVal : '__custom__'
      if (!preset) customCron.value = cronVal
    }
    if (statusRes.success && statusRes.data) {
      activeWorkflowCount.value = statusRes.data.activeCount
    }
    schedulerLoaded.value = true
  } catch { /* silently fail */ }
}

async function refreshStatus() {
  statusLoading.value = true
  try {
    const res = await getSchedulerStatus()
    if (res.success && res.data) {
      activeWorkflowCount.value = res.data.activeCount
    }
  } finally {
    statusLoading.value = false
  }
}

async function saveSchedulerConfig() {
  try {
    const cronVal = dispatchCronPreset.value === '__custom__' ? customCron.value : dispatchCronPreset.value
    await updateSchedulerSettings({
      'scheduler.workflow_dispatch_cron': cronVal,
      'scheduler.max_concurrent_workflows': String(schedulerConfig.value['scheduler.max_concurrent_workflows']),
      'scheduler.max_tasks_per_execution': String(schedulerConfig.value['scheduler.max_tasks_per_execution']),
    })
  } catch { /* silently fail */ }
}

async function handleTriggerDispatch() {
  triggerLoading.value = true
  try {
    await triggerDispatch()
    await refreshStatus()
  } finally {
    triggerLoading.value = false
  }
}

function onCronPresetChange(val) {
  dispatchCronPreset.value = val
  if (val !== '__custom__') {
    schedulerConfig.value['scheduler.workflow_dispatch_cron'] = val
    saveSchedulerConfig()
  }
}

function onCustomCronBlur() {
  if (customCron.value) {
    schedulerConfig.value['scheduler.workflow_dispatch_cron'] = customCron.value
    saveSchedulerConfig()
  }
}

function updatePanelPosition() {
  if (!bellRef.value) return
  const rect = bellRef.value.getBoundingClientRect()
  if (props.sidebarCollapsed) {
    panelStyle.value = {
      position: 'fixed',
      left: `${rect.right + 8}px`,
      bottom: `${window.innerHeight - rect.bottom}px`
    }
  } else {
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
    loadChatConfig()
    loadSchedulerConfig()
  }
}

function toggleChatEnabled(e) {
  updateSettings({ chatEnabled: e.target.checked })
  if (e.target.checked) {
    loadChatConfig()
  }
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

.notification-bell.sidebar-collapsed {
  display: flex;
  justify-content: center;
}

.bell-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  transition: all 0.2s ease;
}

.bell-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
</style>

<style>
.notification-panel {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 16px;
  width: 280px;
  max-height: 90vh;
  overflow-y: auto;
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
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
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

.notification-panel .input-row {
  margin-bottom: 8px;
}

.notification-panel .input-row label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.notification-panel .text-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--input-text);
  outline: none;
  box-sizing: border-box;
}

.notification-panel .text-input:focus {
  border-color: var(--accent-color);
}

.notification-panel .test-btn {
  width: 100%;
  padding: 6px;
  font-size: 12px;
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  background: transparent;
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
}

.notification-panel .test-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
}

.notification-panel .test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notification-panel .refresh-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 2px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.notification-panel .refresh-btn:hover:not(:disabled) {
  color: var(--accent-color);
}

.notification-panel .refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notification-panel select.text-input {
  appearance: auto;
}
</style>
