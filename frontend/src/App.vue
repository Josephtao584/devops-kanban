<template>
  <div id="app">
    <!-- 左侧边栏 -->
    <aside class="sidebar" :class="{ 'collapsed': isSidebarCollapsed }">
      <!-- Logo/品牌区域 -->
      <div class="sidebar-header">
        <span v-if="!isSidebarCollapsed" class="brand-text">Coplat</span>
        <button @click="toggleSidebar" class="sidebar-toggle" :title="isSidebarCollapsed ? 'Expand' : 'Collapse'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline v-if="isSidebarCollapsed" points="9 18 15 12 9 6"></polyline>
            <polyline v-else points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <div class="nav-group">
          <div class="nav-group-label">
            <span v-if="!isSidebarCollapsed">{{ $t('nav.groupWorkspace') }}</span>
            <div v-else class="nav-group-divider"></div>
          </div>
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
        </div>

        <div class="nav-group">
          <div class="nav-group-label has-divider">
            <span v-if="!isSidebarCollapsed">{{ $t('nav.groupPlatformConfig') }}</span>
            <div v-else class="nav-group-divider"></div>
          </div>
          <router-link to="/workflow-template" class="nav-item" :title="$t('nav.workflowTemplate')">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-90deg)">
              <circle cx="4" cy="4" r="2"></circle>
              <circle cx="20" cy="4" r="2"></circle>
              <circle cx="4" cy="20" r="2"></circle>
              <circle cx="20" cy="20" r="2"></circle>
              <polyline points="4 6 4 4 20 4 20 20 4 20 4 18"></polyline>
            </svg>
            <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.workflowTemplate') }}</span>
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

          <router-link to="/skills" class="nav-item" :class="{ 'router-link-active': $route.path.startsWith('/skills') }" :title="$t('nav.skills')">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.skills') }}</span>
          </router-link>

          <router-link to="/mcp-servers" class="nav-item" :class="{ 'router-link-active': $route.path.startsWith('/mcp-servers') }" :title="$t('nav.mcpServers')">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path>
              <path d="M2 12h20"></path>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span v-if="!isSidebarCollapsed" class="nav-text">{{ $t('nav.mcpServers') }}</span>
          </router-link>
        </div>
      </nav>

      <!-- 底部操作区 -->
      <div class="sidebar-footer">
        <SchedulerConfig :sidebar-collapsed="isSidebarCollapsed" />
        <NotificationBell :sidebar-collapsed="isSidebarCollapsed" />
      </div>
    </aside>

    <!-- 主内容区域 -->
    <main class="main-content">
      <keep-alive include="AgentConfig">
        <router-view />
      </keep-alive>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import NotificationBell from './components/NotificationBell.vue'
import SchedulerConfig from './components/SchedulerConfig.vue'

const isSidebarCollapsed = ref(true)

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<style>
/* Light theme only */

:root {
  --page-bg: #FAFAFA;
  --bg-primary: #ffffff;
  --bg-secondary: #fcfdfd;
  --bg-tertiary: #fafcfc;
  --navbar-bg: #ffffff;
  --panel-bg: #ffffff;
  --message-bg: #fcfdfd;
  --surface-tint: rgba(37, 198, 201, 0.02);
  --surface-tint-strong: rgba(37, 198, 201, 0.05);

  --warning-soft: rgba(234, 180, 69, 0.16);
  --warning-strong: #E2A93B;
  --success-soft: rgba(37, 198, 201, 0.10);
  --success-strong: #1EA9AC;
  --info-soft: rgba(37, 198, 201, 0.08);
  --info-strong: #25C6C9;
  --icon-secondary-soft: rgba(234, 180, 69, 0.16);
  --icon-secondary-strong: #EAB445;
  --todo-soft: rgba(234, 180, 69, 0.14);
  --todo-strong: #B58A2E;
  --done-soft: rgba(37, 198, 201, 0.05);
  --done-strong: #1EA9AC;
  --in-progress-soft: rgba(37, 198, 201, 0.04);
  --in-progress-strong: #25C6C9;
  --requirement-soft: rgba(37, 198, 201, 0.04);
  --requirement-strong: #25C6C9;
  --card-green-soft: rgba(37, 198, 201, 0.025);
  --card-green-mid: rgba(37, 198, 201, 0.045);
  --card-yellow-soft: rgba(234, 180, 69, 0.06);
  --card-yellow-mid: rgba(234, 180, 69, 0.09);
  --green-shadow-soft: rgba(37, 198, 201, 0.22);
  --green-shadow-light: rgba(37, 198, 201, 0.18);
  --yellow-shadow-soft: rgba(234, 180, 69, 0.18);
  --teal-border-soft: rgba(37, 198, 201, 0.24);
  --teal-hover-bg: rgba(37, 198, 201, 0.08);
  --teal-hover-border: rgba(37, 198, 201, 0.26);
  --teal-active-border: rgba(37, 198, 201, 0.28);
  --teal-active-shadow: rgba(37, 198, 201, 0.24);
  --teal-active-line: #25C6C9;
  --green-badge-bg: rgba(37, 198, 201, 0.14);
  --green-badge-text: #25C6C9;
  --yellow-badge-bg: rgba(234, 180, 69, 0.16);
  --yellow-badge-text: #B58A2E;
  --teal-icon-bg: rgba(37, 198, 201, 0.12);
  --yellow-icon-bg: rgba(234, 180, 69, 0.14);
  --teal-chat-bg: rgba(37, 198, 201, 0.08);
  --yellow-chat-bg: rgba(234, 180, 69, 0.14);
  --teal-accent-weak: rgba(37, 198, 201, 0.015);
  --teal-accent-mid: rgba(37, 198, 201, 0.035);
  --teal-accent-strong: rgba(37, 198, 201, 0.06);
  --yellow-accent-weak: rgba(234, 180, 69, 0.06);
  --yellow-accent-mid: rgba(234, 180, 69, 0.08);
  --yellow-accent-strong: rgba(234, 180, 69, 0.12);
  --danger-soft: rgba(239, 68, 68, 0.14);
  --danger-strong: #DC2626;
  --neutral-soft: rgba(107, 114, 128, 0.14);
  --neutral-strong: #6B7280;
  --text-primary: #1f2937;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --border-color: #d7e6de;
  --input-bg: #ffffff;
  --input-text: #1f2937;
  --input-border: #d7e6de;
  --scrollbar-thumb: #d9dde3;
  --scrollbar-thumb-hover: #c8cdd5;
  --accent-color: #25C6C9;
  --accent-color-soft: rgba(37, 198, 201, 0.14);
  --accent-color-strong: #1EA9AC;
  /* Element Plus theme vars — overridden in components.css (loaded after el-plus) */
  --icon-primary: #25C6C9;
  --icon-secondary: #EAB445;
  --primary-color: #25C6C9;
  --primary-hover: #1EA9AC;
  --button-primary-bg: #25C6C9;
  --button-primary-hover: #22B6B9;
  --button-primary-text: #ffffff;
  --button-secondary-bg: #ffffff;
  --button-secondary-border: #d7e6de;
  --button-secondary-text: #4b5563;
  --button-secondary-hover-bg: rgba(37, 198, 201, 0.05);
  --button-secondary-hover-border: rgba(37, 198, 201, 0.24);
  --button-secondary-hover-text: #1EA9AC;
  --hover-bg: rgba(37, 198, 201, 0.08);
  --button-shadow-soft: 0 2px 8px rgba(37, 198, 201, 0.20);
  --button-shadow-hover: 0 4px 10px rgba(37, 198, 201, 0.22);
  --button-danger-bg: rgba(239, 68, 68, 0.06);
  --button-danger-border: rgba(239, 68, 68, 0.14);
  --button-danger-text: #dc2626;
  --button-danger-hover-bg: rgba(239, 68, 68, 0.12);
  --button-danger-hover-border: rgba(239, 68, 68, 0.22);
  --button-danger-hover-text: #b91c1c;
  --button-primary-soft-bg: rgba(37, 198, 201, 0.08);
  --button-primary-soft-border: rgba(37, 198, 201, 0.18);
  --button-primary-soft-text: #1EA9AC;
  --button-primary-soft-hover-bg: rgba(37, 198, 201, 0.14);
  --button-primary-soft-hover-border: rgba(37, 198, 201, 0.24);
  --button-primary-soft-hover-text: #158e90;
  --button-disabled-opacity: 0.55;
  --button-outline-bg: #ffffff;
  --button-outline-border: rgba(37, 198, 201, 0.18);
  --button-outline-text: #1EA9AC;
  --button-outline-hover-bg: rgba(37, 198, 201, 0.08);
  --button-outline-hover-border: rgba(37, 198, 201, 0.28);
  --button-outline-hover-text: #158e90;
  --button-ghost-bg: transparent;
  --button-ghost-hover-bg: rgba(37, 198, 201, 0.06);
  --button-ghost-hover-text: #1EA9AC;
  --button-primary-active-border: #1EA9AC;
  --button-secondary-active-border: rgba(37, 198, 201, 0.22);
  --button-neutral-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  --button-primary-active-shadow: 0 0 0 1px rgba(37, 198, 201, 0.14);
  --button-secondary-active-shadow: 0 0 0 1px rgba(37, 198, 201, 0.10);
  --button-pill-radius: 8px;
  --button-tight-padding-x: 10px;
  --button-tight-padding-y: 4px;
  --button-normal-padding-x: 12px;
  --button-normal-padding-y: 5px;
  --button-font-size: 12px;
  --button-font-weight: 600;
  --button-min-height: 28px;
  --button-compact-height: 30px;
  --button-compact-width: 88px;
  --button-tag-radius: 999px;
  --button-toolbar-gap: 6px;
  --button-inline-gap: 4px;
  --button-section-gap: 8px;
  --button-light-bg: rgba(37, 198, 201, 0.05);
  --button-light-border: rgba(37, 198, 201, 0.14);
  --button-light-text: #1EA9AC;
  --button-light-hover-bg: rgba(37, 198, 201, 0.10);
  --button-light-hover-border: rgba(37, 198, 201, 0.20);
  --button-light-hover-text: #158e90;
  --button-surface-bg: #ffffff;
  --button-surface-border: var(--border-color);
  --button-surface-text: var(--text-secondary);
  --button-surface-hover-bg: rgba(37, 198, 201, 0.05);
  --button-surface-hover-border: rgba(37, 198, 201, 0.20);
  --button-surface-hover-text: #1EA9AC;
  --button-subtle-bg: rgba(31, 41, 55, 0.02);
  --button-subtle-border: rgba(31, 41, 55, 0.06);
  --button-subtle-text: #4b5563;
  --button-subtle-hover-bg: rgba(37, 198, 201, 0.05);
  --button-subtle-hover-border: rgba(37, 198, 201, 0.16);
  --button-subtle-hover-text: #1EA9AC;
  --button-primary-plain-bg: rgba(37, 198, 201, 0.08);
  --button-primary-plain-border: rgba(37, 198, 201, 0.18);
  --button-primary-plain-text: #1EA9AC;
  --button-primary-plain-hover-bg: rgba(37, 198, 201, 0.14);
  --button-primary-plain-hover-border: rgba(37, 198, 201, 0.28);
  --button-primary-plain-hover-text: #158e90;
  --button-focus-ring: 0 0 0 3px rgba(37, 198, 201, 0.12);
  --button-danger-focus-ring: 0 0 0 3px rgba(239, 68, 68, 0.10);
  --button-primary-gradient: #25C6C9;
  --button-primary-gradient-hover: #1EA9AC;
  --button-primary-shadow: none;
  --button-primary-shadow-hover: none;
  --button-primary-soft-gradient: rgba(37, 198, 201, 0.10);
  --button-outline-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  --button-outline-shadow-hover: 0 2px 6px rgba(37, 198, 201, 0.12);
  --button-accent-border: rgba(37, 198, 201, 0.20);
  --button-accent-fill: rgba(37, 198, 201, 0.10);
  --button-accent-text: #1EA9AC;
  --button-accent-fill-hover: rgba(37, 198, 201, 0.16);
  --button-accent-border-hover: rgba(37, 198, 201, 0.28);
  --button-accent-text-hover: #158e90;
  --button-danger-accent-fill: rgba(239, 68, 68, 0.08);
  --button-danger-accent-border: rgba(239, 68, 68, 0.16);
  --button-danger-accent-text: #dc2626;
  --button-danger-accent-fill-hover: rgba(239, 68, 68, 0.14);
  --button-danger-accent-border-hover: rgba(239, 68, 68, 0.24);
  --button-danger-accent-text-hover: #b91c1c;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --page-max-width: 1280px;
  --page-max-width-narrow: 1200px;
  --page-padding: 20px;
  --page-gap: 16px;
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --line-height-tight: 1.4;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.6;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Microsoft YaHei', sans-serif;
  font-size: var(--font-size-md);
  line-height: var(--line-height-base);
  background-color: var(--page-bg);
  color: var(--text-primary);
}

body {
  min-width: 1200px;
}

#app {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  min-height: 100vh;
  background-color: var(--page-bg);
  color: var(--text-primary);
  display: flex;
}

/* Sidebar styles */
.sidebar {
  width: 220px;
  height: 100vh;
  background: var(--navbar-bg);
  border-right: 1px solid var(--border-color);
  transition: width 0.3s ease;
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

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-group-label {
  padding: 8px 12px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  white-space: nowrap;
  overflow: hidden;
}

.nav-group-label.has-divider {
  margin-top: 12px;
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
}

.nav-group-divider {
  height: 1px;
  background: var(--border-color);
  opacity: 0.5;
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
  background: var(--accent-color);
  color: white;
  box-shadow: 0 2px 8px rgba(24, 184, 106, 0.24);
}

/* Footer styles */
.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid var(--border-color);
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

/* Main content */
.main-content {
  margin-left: 220px;
  width: calc(100vw - 220px);
  flex: 1;
  height: 100vh;
  overflow-y: auto;
  transition: margin-left 0.3s ease;
}

.sidebar.collapsed + .main-content {
  margin-left: 60px !important;
  width: calc(100vw - 60px) !important;
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