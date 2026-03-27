/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'

  return {
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      // No proxy needed in demo mode (mock data)
      ...(isDemo ? {} : {
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true
          }
        }
      })
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    define: {
      global: 'globalThis'
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('element-plus')) {
              return 'vendor-element-plus'
            }

            if (id.includes('@element-plus/icons-vue')) {
              return 'vendor-element-icons'
            }

            if (id.includes('vuedraggable') || id.includes('sortablejs')) {
              return 'vendor-dnd'
            }

            if (id.includes('marked')) {
              return 'vendor-markdown'
            }

            if (
              id.includes('vue-router') ||
              id.includes('vue-i18n') ||
              id.includes('pinia') ||
              id.includes('@vueuse/core') ||
              id.includes('vue/dist') ||
              id.includes('/vue/')
            ) {
              return 'vendor-vue'
            }

            if (id.includes('axios') || id.includes('sockjs-client') || id.includes('@stomp/stompjs')) {
              return 'vendor-network'
            }

            return 'vendor-misc'
          }
        }
      }
    },
    test: {
      include: [
        'tests/**/*.{test,spec}.js',
        'src/**/*.{test,spec}.js'
      ],
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html']
      }
    }
  }
})

