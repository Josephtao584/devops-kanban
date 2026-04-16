<template>
  <div class="scheduler-config" :class="{ 'sidebar-collapsed': sidebarCollapsed }" ref="btnRef">
    <button class="scheduler-btn" @click.stop="togglePanel" :title="$t('notification.scheduler.title')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      <span v-if="!sidebarCollapsed && activeWorkflowCount > 0" class="scheduler-badge">{{ activeWorkflowCount }}</span>
    </button>

    <Teleport to="body">
      <div v-if="showPanel" ref="panelRef" class="scheduler-panel" :style="panelStyle" @click.stop>
        <div class="panel-header">{{ $t('notification.scheduler.title') }}</div>

        <div class="panel-section">
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
          <button class="trigger-btn" :disabled="triggerLoading" @click="handleTriggerDispatch">
            {{ triggerLoading ? $t('notification.scheduler.triggering') : $t('notification.scheduler.triggerNow') }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElNotification } from 'element-plus'
import { getSettings, updateSettings, getSchedulerStatus, triggerDispatch } from '../api/settings.js'

const props = defineProps({
  sidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const { t } = useI18n()

const showPanel = ref(false)
const btnRef = ref(null)
const panelRef = ref(null)
const panelStyle = ref({})

const loaded = ref(false)
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

async function loadConfig() {
  if (loaded.value) return
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
    loaded.value = true
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
    await updateSettings({
      'scheduler.workflow_dispatch_cron': cronVal,
      'scheduler.max_concurrent_workflows': String(schedulerConfig.value['scheduler.max_concurrent_workflows']),
      'scheduler.max_tasks_per_execution': String(schedulerConfig.value['scheduler.max_tasks_per_execution']),
    })
  } catch { /* silently fail */ }
}

async function handleTriggerDispatch() {
  triggerLoading.value = true
  try {
    const res = await triggerDispatch()
    await refreshStatus()
    if (res.success && res.data) {
      const { dispatched, skipped, eligibleTasks, errors } = res.data
      const hasErrors = errors && errors.length > 0

      if (eligibleTasks === 0) {
        ElNotification({
          type: 'info',
          title: t('notification.scheduler.dispatchResult'),
          message: t('notification.scheduler.noEligibleTasks'),
          duration: 4000,
        })
      } else if (hasErrors) {
        ElNotification({
          type: 'warning',
          title: t('notification.scheduler.dispatchResult'),
          message: h('div', [
            h('p', { style: 'margin: 0 0 6px' }, t('notification.scheduler.dispatchSummary', { dispatched, skipped })),
            h('ul', { style: 'margin: 0; padding-left: 18px; color: #E6A23C' },
              errors.map(e => h('li', e))
            ),
          ]),
          duration: 6000,
        })
      } else {
        ElNotification({
          type: 'success',
          title: t('notification.scheduler.dispatchResult'),
          message: t('notification.scheduler.dispatchSummary', { dispatched, skipped }),
          duration: 4000,
        })
      }
    } else {
      ElNotification({
        type: 'warning',
        title: t('notification.scheduler.dispatchResult'),
        message: res.message || t('notification.scheduler.dispatchFailed'),
        duration: 5000,
      })
    }
  } catch (err) {
    ElNotification({
      type: 'error',
      title: t('notification.scheduler.dispatchResult'),
      message: err.message || t('notification.scheduler.dispatchFailed'),
      duration: 5000,
    })
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
  if (!btnRef.value) return
  const rect = btnRef.value.getBoundingClientRect()
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
    loadConfig()
  }
}

function handleClickOutside(e) {
  const clickedBtn = btnRef.value && btnRef.value.contains(e.target)
  const clickedPanel = panelRef.value && panelRef.value.contains(e.target)
  if (!clickedBtn && !clickedPanel) {
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
.scheduler-config {
  position: relative;
}

.scheduler-config.sidebar-collapsed {
  display: flex;
  justify-content: center;
}

.scheduler-btn {
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
  position: relative;
}

.scheduler-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.scheduler-badge {
  position: absolute;
  top: 2px;
  right: 8px;
  background: var(--accent-color);
  color: white;
  font-size: 10px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
</style>

<style>
.scheduler-panel {
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

.scheduler-panel .panel-header {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.scheduler-panel .panel-section {
  padding: 4px 0;
}

.scheduler-panel .toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.scheduler-panel .input-row {
  margin-bottom: 8px;
}

.scheduler-panel .input-row label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.scheduler-panel .text-input {
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

.scheduler-panel .text-input:focus {
  border-color: var(--accent-color);
}

.scheduler-panel .trigger-btn {
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

.scheduler-panel .trigger-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
}

.scheduler-panel .trigger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scheduler-panel .refresh-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 2px;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.scheduler-panel .refresh-btn:hover:not(:disabled) {
  color: var(--accent-color);
}

.scheduler-panel .refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scheduler-panel select.text-input {
  appearance: auto;
}
</style>
