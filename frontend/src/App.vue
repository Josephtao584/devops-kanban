<template>
  <div id="app" :class="themeClass">
    <nav class="navbar">
      <div class="nav-links">
        <router-link to="/">{{ $t('nav.kanban') }}</router-link>
        <router-link to="/task-sources">{{ $t('nav.taskSources') }}</router-link>
        <router-link to="/agents">{{ $t('nav.agents') }}</router-link>
        <router-link to="/prompt-templates">{{ $t('nav.promptTemplates') }}</router-link>
        <router-link to="/phase-transitions">{{ $t('phaseTransition.navTitle') }}</router-link>
      </div>
      <div class="nav-actions">
        <button @click="toggleTheme" class="theme-toggle" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
          <svg v-if="isDark" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
        <select v-model="currentLocale" @change="changeLocale" class="locale-select">
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, getLocale } from './locales'
import { useThemeStore } from './stores/theme'

const { locale } = useI18n()
const themeStore = useThemeStore()
const currentLocale = ref('en')

const isDark = computed(() => themeStore.isDark)
const themeClass = computed(() => themeStore.themeClass)

const toggleTheme = () => {
  themeStore.toggleTheme()
}

onMounted(() => {
  currentLocale.value = getLocale()
  themeStore.initTheme()
})

const changeLocale = () => {
  setLocale(currentLocale.value)
}
</script>

<style>
/* Theme variables are defined in src/styles/theme-variables.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Microsoft YaHei', sans-serif;
  min-height: 100vh;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: var(--navbar-bg);
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s, border-color 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.nav-links {
  display: flex;
  gap: 6px;
}

.navbar a {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 10px 18px;
  border-radius: 10px;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
}

.navbar a:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.navbar a.router-link-active {
  background: linear-gradient(135deg, #6366f1 0%, #5c5cff 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(92, 92, 255, 0.25);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-toggle {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--accent-color);
  transform: rotate(15deg);
}

.locale-select {
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--input-bg);
  color: var(--input-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6,9 12,15 18,9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.locale-select:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-color);
}

.locale-select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(92, 92, 255, 0.1);
}

.main-content {
  height: calc(100vh - 53px);
  overflow: hidden;
}

/* Global scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
</style>
