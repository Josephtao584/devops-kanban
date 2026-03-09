import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import './styles/theme-variables.css'

import App from './App.vue'
import router from './router'
import i18n from './locales'
import { useThemeStore } from './stores/theme'
import api from './api/index.js'

// Setup mock if enabled
if (import.meta.env.VITE_MOCK_ENABLED === 'true') {
  const { setupMock } = await import('./mock/index.js')
  setupMock(api)
  console.log('[Demo Mode] Using mock data - no backend required')
}

const pinia = createPinia()

const app = createApp(App)

// Register Element Plus icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// Configure Element Plus with locale based on i18n
const elementLocale = localStorage.getItem('locale') === 'zh' ? zhCn : en

app.use(router)
app.use(i18n)
app.use(pinia)
app.use(ElementPlus, { locale: elementLocale })

// Initialize theme
const themeStore = useThemeStore()
themeStore.initTheme()

app.mount('#app')
