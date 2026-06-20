import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App.tsx'
// Inter Variable бандлится: на Windows/Android заменяет Segoe UI/Roboto (чище и легче).
// На Apple-устройствах первым в стеке остаётся системный SF Pro.
import '@fontsource-variable/inter'
// Montserrat 700 — только для логотипа-эмблемы (вордмарк «RAZBORKA»).
import '@fontsource/montserrat/700.css'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Регистрация Service Worker только для production.
// НЕ авто-применяем обновление (updateSW(true) перезагружал страницу при каждом
// обновлении SW, в т.ч. при возврате на вкладку). Обновление предлагает
// VersionChecker тостом «Обновить» — применяется только по клику пользователя.
if (import.meta.env.PROD) {
  registerSW({
    onOfflineReady() {},
  })
}

// Подавляем безопасные AbortError от Supabase в режиме разработки
// Это известная проблема с React StrictMode и Navigator Locks API
if (import.meta.env.DEV) {
  const originalError = console.error
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('AbortError') &&
      args[0].includes('signal is aborted without reason')
    ) {
      return
    }
    originalError.apply(console, args)
  }
}

// ── Восстановление при ошибке загрузки JS-чанков ──────────────────────────────
// После нового деплоя браузер/SW может ссылаться на старые хеши файлов, которых
// уже нет → бесконечный спиннер. Логика самолечения:
//  1) первая ошибка — обычная перезагрузка (подтянет свежие файлы);
//  2) повтор в течение 25с (значит SW отдаёт «битый» кэш) — жёстко: снимаем SW
//     и чистим кэши, затем перезагружаем. Это разрывает цикл «спиннер/перезагрузка».
const CHUNK_KEY = 'tsp_chunk_recover_ts'
let chunkRecovering = false

async function recoverFromChunkFailure() {
  if (chunkRecovering) return
  chunkRecovering = true
  const now = Date.now()
  const last = Number(sessionStorage.getItem(CHUNK_KEY) || 0)
  const looping = now - last < 25_000

  if (looping) {
    // Жёсткое лечение: снять service worker и почистить кэши приложения
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(
          keys.filter(k => !k.includes('google-fonts') && !k.includes('imgbb')).map(k => caches.delete(k))
        )
      }
    } catch { /* ignore */ }
    sessionStorage.removeItem(CHUNK_KEY)
  } else {
    sessionStorage.setItem(CHUNK_KEY, String(now))
  }
  // Сбрасываем счётчик «успешной» загрузки через 30с, чтобы единичные ошибки не копились
  window.location.reload()
}

window.addEventListener('vite:preloadError', (e: any) => {
  e?.preventDefault?.()
  recoverFromChunkFailure()
})
if (import.meta.env.PROD) {
  window.addEventListener('error', (event) => {
    const m = event.message || ''
    if (m.includes('Failed to fetch dynamically imported module') ||
        m.includes('Importing a module script failed') ||
        m.includes('error loading dynamically imported module')) {
      recoverFromChunkFailure()
    }
  })
  window.addEventListener('unhandledrejection', (event) => {
    const m = String((event as any)?.reason?.message || (event as any)?.reason || '')
    if (/dynamically imported module|module script failed|ChunkLoadError/i.test(m)) {
      recoverFromChunkFailure()
    }
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24ч — чтобы кэш переживал выгрузку и сохранялся
      retry: 1,
      refetchOnWindowFocus: false, // Отключаем перезагрузку при возврате на вкладку
      refetchOnMount: false, // Отключаем перезагрузку при монтировании если данные есть
    },
  },
})

// Сохраняем кэш react-query в localStorage — при повторном открытии/«пробуждении»
// PWA данные показываются мгновенно из кэша, без полной перезагрузки контекста.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'tsp_rq_cache',
  throttleTime: 1000,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24ч
        // При новой версии сборки сбрасываем persist-кэш, чтобы не показывать
        // устаревший профиль/роли (старое меню) после обновления.
        buster: import.meta.env.VITE_BUILD_HASH || 'dev',
        dehydrateOptions: {
          // Главное — мгновенно показать ОФОРМЛЕНИЕ (оболочка, навигация, профиль,
          // компании, роли), а тяжёлые списки (запчасти, авто, заказы, клиенты)
          // грузить в фоне. Поэтому персистим только лёгкие запросы, а большие
          // НЕ кладём в localStorage (не раздувают хранилище и не блокируют старт).
          shouldDehydrateQuery: (q) => {
            if (q.state.status !== 'success') return false
            const key = String(q.queryKey?.[0] ?? '')
            const heavy = [
              'parts-inventory', 'parts-vehicles', 'parts-orders', 'parts-customers',
            ]
            return !heavy.some(h => key.startsWith(h))
          },
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
