<template>
  <div id="app" :class="themeClass">
    <!-- 左侧边栏 -->
    <aside class="sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
      <!-- Logo/品牌区域 -->
      <div class="sidebar-header">
        <span v-if="!isSidebarCollapsed" class="brand-text">DevOps Kanban</span>
        <button @click="toggleSidebar" class="sidebar-toggle" :title="isSidebarCollapsed ? 'Expand' : 'Collapse'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline v-if="isSidebarCollapsed" points="9 18 15 12 9 6"></polyline>
            <polyline v-else points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :title="$t('nav.projects')">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.projects') }}</span>
        </router-link>

        <router-link to="/kanban" class="nav-item" :class="{ 'router-link-active': $route.path.startsWith('/kanban') }" :title="$t('nav.kanban')">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.kanban') }}</span>
        </router-link>

        <router-link to="/task-sources" class="nav-item" :title="$t('nav.taskSources')">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.taskSources') }}</span>
        </router-link>

        <router-link to="/agents" class="nav-item" :title="$t('nav.agents')">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="10" rx="2"></rect>
            <circle cx="12" cy="5" r="2"></circle>
            <path d="M12 7v4"></path>
            <line x1="8" y1="16" x2="8" y2="16"></line>
            <line x1="16" y1="16" x2="16" y2="16"></line>
          </svg>
          <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.agents') }}</span>
        </router-link>

        <router-link to="/prompt-templates" class="nav-item" :title="$t('nav.promptTemplates')">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.promptTemplates') }}</span>
        </router-link>

        <router-link to="/phase-transitions" class="nav-item" :title="$t('phaseTransition.navTitle')">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
          <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('phaseTransition.navTitle') }}</span>
        </router-link>
      </nav>

      <!-- 底部操作区 -->
      <div class="sidebar-footer">
        <!-- 主题切换 -->
        <button @click="toggleTheme" class="footer-btn" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
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
          <span v-if="!isSidebarCollapsed" class="btn-text">{{ isDark ? $t('theme.light') : $t('theme.dark') }}</span>
        </button>

        <!-- 语言选择 -->
        <div v-if="!isSidebarCollapsed" class="locale-wrapper">
          <select v-model="currentLocale" @change="changeLocale" class="locale-select">
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
        <button v-else @click="toggleLocale" class="footer-btn" :title="currentLocale === 'en' ? 'Switch to 中文' : 'Switch to English'">
          <span class="locale-icon">{{ currentLocale === 'en' ? 'EN' : '中' }}</span>
        </button>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { setLocale, getLocale } from './locales'
import { useThemeStore } from './stores/theme'

const route = useRoute()
const { locale, t } = useI18n()
const themeStore = useThemeStore()
const currentLocale = ref('en')
const isSidebarCollapsed = ref(true) // 默认收起

const isDark = computed(() => themeStore.isDark)
const themeClass = computed(() => themeStore.themeClass)

const toggleTheme = () => {
  themeStore.toggleTheme()
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const toggleLocale = () => {
  currentLocale.value = currentLocale.value === 'en' ? 'zh' : 'en'
  changeLocale()
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
  display: flex;
}

/* Sidebar styles */
.sidebar {
  width: 220px;
  height: 100vh;
  background: var(--navbar-bg);
  border-right: 1px solid var(--border-color);
  transition: width 0.3s ease, background-color 0.3s, border-color 0.3s;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.sidebar.collapsed {
  width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  min-height: 56px;
}

.brand-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-toggle {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 16px 10px;
}

/* Navigation styles */
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 10px;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 12px 0;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.router-link-active {
  background: linear-gradient(135deg, #6366f1 0%, #5c5cff 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(92, 92, 255, 0.25);
}

/* Footer styles */
.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  font-size: 14px;
  width: 100%;
}

.sidebar.collapsed .footer-btn {
  justify-content: center;
  padding: 10px 0;
}

.footer-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.locale-wrapper {
  padding: 0 4px;
}

.locale-select {
  width: 100%;
  padding: 10px 12px;
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

.locale-icon {
  font-size: 12px;
  font-weight: 600;
}

/* Main content */
.main-content {
  margin-left: 220px;
  flex: 1;
  height: 100vh;
  overflow: hidden;
  transition: margin-left 0.3s ease;
}

.sidebar.collapsed + .main-content {
  margin-left: 60px !important;
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