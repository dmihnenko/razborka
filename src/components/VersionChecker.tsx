import { useEffect } from 'react'
import { toast } from 'sonner'

const CHECK_INTERVAL = 4 * 60 * 60 * 1000 // 4 часа
const VERSION_STORAGE_KEY = 'tsp_app_version'

let isChecking = false
let isReloading = false

async function checkVersion(force = false): Promise<void> {
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
      // Первый запуск — запоминаем версию
      localStorage.setItem(VERSION_STORAGE_KEY, newVersion)
      return
    }

    if (newVersion !== storedVersion || force) {
      if (newVersion === storedVersion && force) return // force check но версия та же

      isReloading = true
      localStorage.setItem(VERSION_STORAGE_KEY, newVersion)

      // Краткое уведомление и автообновление через 0.5с
      toast.success('Обновление...', {
        duration: 500,
        icon: '🔄',
        position: 'top-center',
      })

      setTimeout(() => {
        // Очищаем кэш профиля чтобы загрузить свежие данные
        localStorage.removeItem('tsp_profile_cache')
        window.location.reload()
      }, 500)
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

    // Проверяем сразу при запуске
    checkVersion()

    // Проверяем раз в 4 часа
    const interval = setInterval(() => checkVersion(), CHECK_INTERVAL)

    // Проверяем при возврате на вкладку (но не чаще чем раз в 30 мин)
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
