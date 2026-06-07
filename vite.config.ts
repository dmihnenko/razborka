import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
/// <reference types="vitest" />

// Build hash: prefer git SHA from Netlify CI, fallback to timestamp
const buildHash = (process.env.COMMIT_REF ?? '').slice(0, 8) || Date.now().toString(36)

// Plugin: write /version.json into the output bundle
const versionJsonPlugin = {
  name: 'version-json',
  generateBundle() {
    // @ts-ignore
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ hash: buildHash }),
    })
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    versionJsonPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'CRM',
        short_name: 'CRM СТО',
        description: 'Система управления автосервисом: клиенты, заявки, склад, сотрудники',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        // Offline SPA: все navigate-запросы → index.html,
        // кроме API, version.json и статических файлов из /public/
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/version\.json/, /^\/public\//],

        runtimeCaching: [
          // ── Supabase Auth / Storage / Realtime ───────────────────────────────
          // Критичные эндпоинты: всегда NetworkFirst, не кешировать долго
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/(auth|storage|realtime)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-critical',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5  // 5 минут
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Supabase REST API (запросы данных) ────────────────────────────────
          // StaleWhileRevalidate: мгновенный ответ из кеша + тихое обновление.
          // Подходит для списков/справочников где небольшая задержка обновления ок.
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-rest',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 5  // 5 минут — данные не устаревают надолго
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Supabase Functions (Edge Functions) ───────────────────────────────
          // NetworkFirst: вычисляемые результаты, кеш только для offline
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-functions',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 2  // 2 минуты
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Изображения ImgBB ─────────────────────────────────────────────────
          // CacheFirst: загруженные фото не меняются — агрессивный кеш
          {
            urlPattern: /^https?:\/\/(i\.ibb\.co|imgbb\.com|image\.ibb\.co)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'imgbb-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7  // 7 дней
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          },

          // ── Google Fonts ──────────────────────────────────────────────────────
          // CacheFirst: шрифты версионированы по URL, безопасно кешировать год
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365  // 1 год
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Генерируем хеши для файлов чтобы браузер загружал новые версии
    rollupOptions: {
      output: {
        // Добавляем хеш к именам файлов
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/utils/**', 'src/services/**', 'src/hooks/**', 'src/components/**'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/utils/imageStorage.ts',
        'src/utils/imgbbKey.ts',
        'src/services/imgbbService.ts',
        'src/services/personalVehicles.ts',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
