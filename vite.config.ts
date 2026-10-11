import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png'],
  manifest: {
    name: 'LANKA — Piyasa Duvarları',
    short_name: 'LANKA',
    description:
      'Orderbook duvarlarını gerçek zamanlı izleyen, coin bazlı öğrenen mobil öncelikli piyasa ekranı',
    lang: 'tr',
    theme_color: '#0b0f14',
    background_color: '#0b0f14',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => /api\.binance\.com|data-api\.binance\.com/.test(url.hostname),
        handler: 'NetworkFirst',
        method: 'GET',
        options: {
          cacheName: 'binance-rest',
          networkTimeoutSeconds: 2,
          expiration: { maxEntries: 64, maxAgeSeconds: 3600 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
})

const analyze = process.env.ANALYZE === '1'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwa,
    ...(analyze ? [visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true })] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    sourcemap: true,
    target: 'es2020',
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/vite-env.d.ts',
        'src/app/**',
        'src/shared/ui/**',
        'src/features/*/ui/**',
        'src/shared/workers/**',
        'src/shared/styles/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
      },
    },
  },
})
