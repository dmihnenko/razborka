import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Регистрация Service Worker только для production
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('Доступно новое обновление. Обновить приложение?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('Приложение готово к работе оффлайн')
    },
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
      retry: 1,
      refetchOnWindowFocus: false, // Отключаем перезагрузку при возврате на вкладку
      refetchOnMount: false, // Отключаем перезагрузку при монтировании если данные есть
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
