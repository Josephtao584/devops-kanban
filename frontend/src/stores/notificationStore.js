import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as notificationApi from '../api/notification.js'
import { useApiErrorHandler } from '../composables/useApiErrorHandler.js'

export const useNotificationStore = defineStore('notification', () => {
  const loading = ref(false)
  const error = ref(null)
  const apiError = useApiErrorHandler({ showMessage: false, defaultMessage: '操作失败' })

  async function getNotificationConfig() {
    loading.value = true
    try {
      const response = await notificationApi.getNotificationConfig()
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '获取通知配置失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function saveNotificationConfig(data) {
    loading.value = true
    try {
      const response = await notificationApi.saveNotificationConfig(data)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '保存通知配置失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function sendNotification(content) {
    loading.value = true
    try {
      const response = await notificationApi.sendNotification(content)
      return response
    } catch (err) {
      error.value = apiError.handleError(err, '发送通知失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return { loading, error, getNotificationConfig, saveNotificationConfig, sendNotification }
})
