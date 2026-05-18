import { defineStore } from 'pinia'
import { ref } from 'vue'
import { splitSuggestionsApi } from '../api/splitSuggestions.js'

function createDebouncedFn(fn, wait) {
  let timer = null
  let lastArgs = null
  const debounced = (...args) => {
    clearTimeout(timer)
    lastArgs = args
    timer = setTimeout(() => { timer = null; lastArgs = null; fn(...args) }, wait)
  }
  debounced.flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; await fn(...lastArgs); lastArgs = null }
  }
  return debounced
}

export const useSplitSuggestionsStore = defineStore('splitSuggestions', () => {
  const pendingByTask = ref(new Map())
  const loading = ref(false)

  async function load(taskId) {
    loading.value = true
    try {
      const resp = await splitSuggestionsApi.listByTask(taskId)
      if (resp?.success) {
        // Prefer PENDING, but fall back to CONFIRMED so the user can
        // re-open the dialog to create remaining unchecked tasks.
        const record = resp.data.find(s => s.status === 'PENDING')
          || resp.data.find(s => s.status === 'CONFIRMED')
        if (record) pendingByTask.value.set(taskId, record)
        else pendingByTask.value.delete(taskId)
      }
    } finally {
      loading.value = false
    }
  }

  const debouncedPatch = createDebouncedFn(async (id, suggestions) => {
    await splitSuggestionsApi.update(id, suggestions)
  }, 500)

  function updateSuggestions(taskId, suggestions) {
    const record = pendingByTask.value.get(taskId)
    if (!record) return
    record.suggestions = suggestions
    pendingByTask.value.set(taskId, { ...record })
    debouncedPatch(record.id, suggestions)
  }

  function flushPendingUpdate() {
    debouncedPatch.flush()
  }

  async function doConfirm(taskId) {
    const record = pendingByTask.value.get(taskId)
    if (!record) return null
    // Ensure any pending edits are saved to the backend before confirming,
    // so the confirm reads the user's latest changes, not stale DB data.
    await flushPendingUpdate()
    const resp = await splitSuggestionsApi.confirm(record.id)
    // Don't delete from map — reload so the user can re-open the dialog
    // to create remaining unchecked tasks. The record will now be in
    // CONFIRMED status.
    if (resp?.success) await load(taskId)
    return resp
  }

  async function doDismiss(taskId) {
    const record = pendingByTask.value.get(taskId)
    if (!record) return null
    const resp = await splitSuggestionsApi.dismiss(record.id)
    if (resp?.success) pendingByTask.value.delete(taskId)
    return resp
  }

  return { pendingByTask, loading, load, updateSuggestions, doConfirm, doDismiss }
})
