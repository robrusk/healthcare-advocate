import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Shown in the footer. Bump "version" in package.json: 1.50.0 → "v1.50", 1.50.1 → "v1.50.1"
const APP_VERSION = 'v' + pkg.version.replace(/\.0$/, '')

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    cssMinify: 'esbuild',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon.svg'],
      manifest: {
        name: 'Healthcare Advocate',
        short_name: 'HealthcareAdvocate',
        description: 'Fight insurance denials. Free, private, and on your side.',
        theme_color: '#00e5a0',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,md}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
})
