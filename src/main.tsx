import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import App from './App.tsx'
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

// Авто-перезагрузка при ошибке загрузки JS-чанков после нового деплоя
// Браузер кеширует старые хеши файлов, которых уже нет на сервере
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})
// Fallback для браузеров без vite:preloadError
if (import.meta.env.PROD) {
  window.addEventListener('error', (event) => {
    const isChunkError =
      event.message?.includes('Failed to fetch dynamically imported module') ||
      event.message?.includes('Importing a module script failed')
    if (isChunkError) {
      const reloadKey = 'chunk_reload_ts'
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0)
      if (Date.now() - lastReload > 10_000) {
        sessionStorage.setItem(reloadKey, String(Date.now()))
        window.location.reload()
      }
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
        dehydrateOptions: {
          // Сохраняем только успешные запросы
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
)
