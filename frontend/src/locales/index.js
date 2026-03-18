import { createI18n } from 'vue-i18n'
import zh from './zh.js'

const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'zh',
  messages: {
    zh
  }
})

export default i18n

export const getLocale = () => 'zh'

export const t = (key, params) => i18n.global.t(key, params)
