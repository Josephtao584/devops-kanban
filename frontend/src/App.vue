<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-links">
        <router-link to="/">{{ $t('nav.kanban') }}</router-link>
        <router-link to="/task-sources">{{ $t('nav.taskSources') }}</router-link>
        <router-link to="/agents">{{ $t('nav.agents') }}</router-link>
      </div>
      <div class="nav-actions">
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { setLocale, getLocale } from './locales'

const { locale } = useI18n()
const currentLocale = ref('en')

onMounted(() => {
  currentLocale.value = getLocale()
})

const changeLocale = () => {
  setLocale(currentLocale.value)
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Microsoft YaHei', sans-serif;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 2rem;
  background-color: #2c3e50;
}

.nav-links {
  display: flex;
  gap: 0.5rem;
}

.navbar a {
  color: #ecf0f1;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.navbar a:hover {
  background-color: #34495e;
}

.navbar a.router-link-active {
  background-color: #3498db;
}

.locale-select {
  padding: 0.4rem 0.75rem;
  border: 1px solid #4a5568;
  border-radius: 4px;
  background-color: #4a5568;
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;
}

.locale-select:hover {
  background-color: #5a6578;
}

.locale-select:focus {
  outline: none;
  border-color: #3498db;
}

.main-content {
  padding: 1rem;
}
</style>
