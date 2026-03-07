import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', () => {
  // State
  const isDark = ref(localStorage.getItem('theme') !== 'light')

  // Getters
  const themeClass = computed(() => isDark.value ? 'theme-dark' : 'theme-light')

  // Actions
  function applyTheme() {
    if (isDark.value) {
      document.documentElement.classList.remove('theme-light')
      document.documentElement.classList.add('theme-dark')
    } else {
      document.documentElement.classList.remove('theme-dark')
      document.documentElement.classList.add('theme-light')
    }
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function initTheme() {
    applyTheme()
  }

  return {
    // State
    isDark,
    // Getters
    themeClass,
    // Actions
    toggleTheme,
    applyTheme,
    initTheme
  }
})
