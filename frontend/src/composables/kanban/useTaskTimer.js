import { ref, onUnmounted } from 'vue'

// Store running task timers globally
const taskTimers = new Map() // taskId -> { startTime, elapsed, intervalId }

export function useTaskTimer() {
  const runningTasks = ref(new Set())

  const isTaskRunning = (taskId) => {
    return runningTasks.value.has(taskId)
  }

  const startTaskTimer = (taskId) => {
    if (taskTimers.has(taskId)) {
      // Timer already running
      return
    }

    const timerData = {
      startTime: Date.now(),
      elapsed: 0,
      intervalId: null
    }

    timerData.intervalId = setInterval(() => {
      timerData.elapsed = Date.now() - timerData.startTime
    }, 1000)

    taskTimers.set(taskId, timerData)
    runningTasks.value.add(taskId)
  }

  const stopTaskTimer = (taskId) => {
    const timerData = taskTimers.get(taskId)
    if (timerData) {
      if (timerData.intervalId) {
        clearInterval(timerData.intervalId)
      }
      taskTimers.delete(taskId)
      runningTasks.value.delete(taskId)
    }
  }

  const formatTaskElapsedTime = (taskId) => {
    const timerData = taskTimers.get(taskId)
    if (!timerData) {
      return '00:00:00'
    }

    const totalMs = timerData.elapsed
    const seconds = Math.floor(totalMs / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const cleanup = () => {
    taskTimers.forEach((timerData) => {
      if (timerData.intervalId) {
        clearInterval(timerData.intervalId)
      }
    })
    taskTimers.clear()
    runningTasks.value.clear()
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    runningTasks,
    isTaskRunning,
    startTaskTimer,
    stopTaskTimer,
    formatTaskElapsedTime,
    cleanup
  }
}
