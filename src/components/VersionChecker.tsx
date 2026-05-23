import { useEffect } from 'react'
import { toast } from 'sonner'

const CHECK_INTERVAL = 4 * 60 * 60 * 1000 // 4 часа
const VERSION_STORAGE_KEY = 'tsp_app_version'

let isChecking = false
let isReloading = false

async function clearSWCacheAndReload(): Promise<void> {
  try {
    // Отписываем все Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(r => r.unregister()))
    }
    // Очищаем все Cache Storage
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {
    // Игнорируем ошибки очистки
  }
  // Очищаем кэш профиля
  localStorage.removeItem('tsp_profile_cache')
  // Hard reload — принудительно загружает с сервера
  window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now()
}

async function checkVersion(): Promise<void> {
  if (isChecking || isReloading) return
  isChecking = true

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return

    const data = await res.json()
    const newVersion: string = data?.version || data?.hash || ''
    if (!newVersion) return

    const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY)

    if (!storedVersion) {
      localStorage.setItem(VERSION_STORAGE_KEY, newVersion)
      return
    }

    if (newVersion !== storedVersion) {
      isReloading = true
      localStorage.setItem(VERSION_STORAGE_KEY, newVersion)

      toast.success('Обновление... 🔄', {
        duration: 500,
        position: 'top-center',
      })

      setTimeout(() => clearSWCacheAndReload(), 500)
    }
  } catch {
    // Игнорируем сетевые ошибки
  } finally {
    isChecking = false
  }
}

export default function VersionChecker() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    checkVersion()

    const interval = setInterval(() => checkVersion(), CHECK_INTERVAL)

    let lastFocusCheck = 0
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocusCheck > 30 * 60 * 1000) {
        lastFocusCheck = now
        checkVersion()
      }
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return null
}
