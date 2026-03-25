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

