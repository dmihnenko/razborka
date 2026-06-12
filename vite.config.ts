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
  // Хеш сборки доступен в клиенте — используется как buster persist-кэша, чтобы
  // при обновлении версии не восстанавливался устаревший профиль/роли.
  define: {
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(buildHash),
  },
  plugins: [
    react(),
    versionJsonPlugin,
    VitePWA({
      // 'prompt', не 'autoUpdate': новый SW НЕ активируется и НЕ перезагружает
      // страницу автоматически. Обновление предлагается тостом (VersionChecker),
      // применяется только по клику пользователя. Иначе страница перезагружалась
      // при каждом возврате на вкладку (браузер проверяет SW при фокусе).
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Авторазборка',
        short_name: 'Авторазборка',
        description: 'Авторазборка — учёт авто и запчастей, маркетплейс запчастей, заказы и клиенты',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone'],
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
        // НЕ skipWaiting/clientsClaim: новый SW ждёт, пока пользователь не нажмёт
        // «Обновить» — без принудительной активации и перезагрузки вкладки.

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
          // NetworkFirst: данные меняются мутациями (удаление/создание/продажа),
          // поэтому после изменения рефетч ДОЛЖЕН получить свежий ответ, а не кэш.
          // Кэш — только офлайн-фолбэк. (react-query держит свой память-кэш, так
          // что лишних сетевых запросов немного.)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 30
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
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 30  // 30 дней — фото не меняются
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
        assetFileNames: `assets/[name].[hash].[ext]`,
        // Вендоры в отдельные чанки: их хеши не меняются между деплоями (если
        // не обновляли зависимости), поэтому браузер держит их в кэше как
        // immutable, а каждый релиз заново качает только код приложения.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-dom') || /[\\/]react[\\/]/.test(id) || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('@tanstack')) return 'vendor-query'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'vendor-charts'
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('date-fns')) return 'vendor-date'
          return 'vendor'
        },
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
