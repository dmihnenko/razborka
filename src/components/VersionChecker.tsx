import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const VERSION_KEY    = 'tsp_app_version'
const INTERVAL_MS    = 15 * 60 * 1000  // 15 мин
const REVISIT_GAP_MS =  5 * 60 * 1000  // минимум между проверками при visibilitychange
const REDISPLAY_MS   =  5 * 60 * 1000  // переспросить если пользователь закрыл toast

// Модульные флаги — живут на протяжении всей сессии
let isChecking   = false
let updateShown  = false
let pendingHash  = ''   // новый hash, ещё не принятый пользователем

// ── Перезагрузка ──────────────────────────────────────────────────────────────
async function reloadApp(): Promise<void> {
  try {
    // Снимаем service worker, чтобы перезагрузка пошла из СЕТИ (свежий бандл),
    // а не через старый SW.
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      // ВАЖНО: НЕ удаляем workbox-precache (и шрифты/imgbb). Иначе если снимаемый
      // SW успеет обработать навигацию перезагрузки, его navigateFallback
      // '/index.html' упрётся в пустой precache → ERR_FAILED (а refresh «чинит»,
      // т.к. обходит SW). Чистим только runtime-кэши данных Supabase.
      await Promise.all(
        keys.filter(k => k.includes('supabase')).map(k => caches.delete(k))
      )
    }
  } catch { /* нет доступа к SW/кешу */ }

  localStorage.removeItem('tsp_profile_cache')
  // Версию не сбрасываем — она уже записана в checkVersion
  window.location.href = window.location.pathname + '?v=' + Date.now()
}

// ── Показать toast обновления ─────────────────────────────────────────────────
function showUpdateToast() {
  if (updateShown) return
  updateShown = true

  toast('Доступно обновление', {
    description: 'Новая версия приложения готова к установке',
    duration: Infinity,
    action: {
      label: 'Обновить',
      onClick: reloadApp,
    },
    onDismiss: () => {
      // Пользователь закрыл — дать возможность показать снова через 5 мин
      setTimeout(() => { updateShown = false }, REDISPLAY_MS)
    },
  })
}

// ── Проверка версии по version.json ──────────────────────────────────────────
async function checkVersion(): Promise<void> {
  if (isChecking) return
  isChecking = true

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    if (!res.ok) return

    const data = await res.json()
    const newHash: string = data?.hash || data?.version || ''
    if (!newHash) return

    const stored = localStorage.getItem(VERSION_KEY)

    if (!stored) {
      // Первый запуск — запомнить текущую версию, не показывать toast
      localStorage.setItem(VERSION_KEY, newHash)
      return
    }

    if (newHash !== stored && newHash !== pendingHash) {
      // Новая версия обнаружена:
      // - записываем в localStorage сразу (чтобы не спамить при следующих проверках)
      // - держим pendingHash чтобы не показывать toast дважды если
      //   пользователь закрыл его, а следующая проверка вернёт тот же hash
      pendingHash = newHash
      localStorage.setItem(VERSION_KEY, newHash)
      showUpdateToast()
    }
  } catch { /* нет сети — ок */ } finally {
    isChecking = false
  }
}

// ── Компонент ─────────────────────────────────────────────────────────────────
export default function VersionChecker() {
  const lastVisibilityCheck = useRef(0)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    // 1. Проверка при старте
    checkVersion()

    // 2. Периодический интервал — 15 мин
    const interval = setInterval(checkVersion, INTERVAL_MS)

    // 3. При возврате на вкладку — не чаще раза в 5 мин
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastVisibilityCheck.current > REVISIT_GAP_MS) {
        lastVisibilityCheck.current = now
        checkVersion()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // 4. Service Worker обновился и взял контроль над страницей →
    //    гарантированно новая версия активна, показываем toast напрямую
    //    (не делаем fetch version.json — SW уже сменился)
    let swControlled = false
    const onControllerChange = () => {
      if (swControlled) return
      swControlled = true
      // Небольшая задержка чтобы новый SW успел полностью инициализироваться
      setTimeout(() => {
        // Сбрасываем pendingHash: controllerchange — это свежий сигнал
        pendingHash = ''
        updateShown = false
        showUpdateToast()
      }, 500)
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    }

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      }
    }
  }, [])

  return null
}
