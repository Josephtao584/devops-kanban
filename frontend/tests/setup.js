import { config } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'

// Set up a global Pinia instance for tests
setActivePinia(createPinia())

config.global.plugins = [ElementPlus]
