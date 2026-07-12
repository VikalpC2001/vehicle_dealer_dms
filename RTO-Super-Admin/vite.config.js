/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://192.168.0.145:4002'
  const apiProxy = {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
      secure: false,
    },
    // Serve uploaded files same-origin (the backend static /uploads route), so
    // <img>/fetch don't hit the backend cross-origin (which isn't always reachable).
    '/uploads': {
      target: apiProxyTarget,
      changeOrigin: true,
      secure: false,
    },
  }

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: apiProxy,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    proxy: apiProxy,
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
        storybookTest({
          configDir: path.join(__dirname, '.storybook'),
        }),
      ],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{ browser: 'chromium' }],
        },
      },
    }],
  },
  }
})
