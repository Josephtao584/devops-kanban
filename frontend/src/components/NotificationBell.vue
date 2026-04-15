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
      chatConfigLoaded.value = true
    }
  } catch {
    // Silently fail
  }
}

async function saveChatConfig() {
  if (!chatConfig.value.url) return
  try {
    await saveNotificationConfig(chatConfig.value)
  } catch {
    // Silently fail
  }
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
    if (chatEnabled.value) {
      loadChatConfig()
    }
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
