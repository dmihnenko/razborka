import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const VERSION_KEY    = 'tsp_app_version'
const INTERVAL_MS    = 12 * 60 * 60 * 1000  // 12 ч (реже бьём origin; обновление ловится по visibilitychange + ручная кнопка в кабинете)
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

// ── Показать маленький toast обновления ───────────────────────────────────────
// Версия применяется автоматически (skipWaiting+clientsClaim) при следующей
// навигации; тост лишь уведомляет «Update #ver» и даёт применить сразу по тапу.
function showUpdateToast(ver: string) {
  if (updateShown) return
  updateShown = true

  toast(`Обновлено · #${ver}`, {
    duration: 2500,
    position: 'bottom-right',
    onDismiss: () => {
      // Пользователь закрыл — дать возможность показать снова через 5 мин
      setTimeout(() => { updateShown = false }, REDISPLAY_MS)
    },
  })
}

// ── Проверка версии по version.json ──────────────────────────────────────────
/** Тянет актуальный hash версии (или '' при ошибке/без сети). */
async function fetchVersionHash(): Promise<string> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data?.hash || data?.version || ''
  } catch { return '' }
}

async function checkVersion(): Promise<void> {
  if (isChecking) return
  isChecking = true
  try {
    const newHash = await fetchVersionHash()
    if (!newHash) return
    const stored = localStorage.getItem(VERSION_KEY)
    if (!stored) {
      // Первый запуск — запомнить текущую версию, не показывать toast
      localStorage.setItem(VERSION_KEY, newHash)
      return
    }
    if (newHash !== stored && newHash !== pendingHash) {
      // Новая версия: пишем сразу (чтобы не спамить) + pendingHash против повторного toast
      pendingHash = newHash
      localStorage.setItem(VERSION_KEY, newHash)
      showUpdateToast(newHash)
    }
  } finally {
    isChecking = false
  }
}

/** Ручная проверка из кабинета (кнопка). Возвращает 'updated' | 'current'. */
export async function manualVersionCheck(): Promise<'updated' | 'current'> {
  const newHash = await fetchVersionHash()
  if (!newHash) return 'current' // нет сети/ошибка — трактуем как «актуально»
  const stored = localStorage.getItem(VERSION_KEY)
  if (stored && newHash !== stored) {
    localStorage.setItem(VERSION_KEY, newHash)
    // Ручная проверка — пользователь сам нажал, применяем сразу (перезагрузка из сети).
    await reloadApp()
    return 'updated'
  }
  if (!stored) localStorage.setItem(VERSION_KEY, newHash)
  return 'current'
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

    // 4. Service Worker обновился и взял контроль над страницей.
    //    ВАЖНО: в памяти окна всё ещё СТАРЫЙ бандл. Пассивный тост его не сменит —
    //    установленный PWA может навсегда застрять на старой версии (а при рассинхроне
    //    старый фронт + новый бэкенд/RLS запросы падают → выброс в «Выберите
    //    направление»). Поэтому при смене контроллера ОДИН раз перезагружаемся на
    //    свежую версию через reloadApp() (снимает SW-кэш данных, грузит из сети).
    //    Guard hadController исключает лишнюю перезагрузку при ПЕРВОЙ установке SW —
    //    тогда старого кода ещё нет и перезагружаться незачем.
    const hadController = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller
    let swControlled = false
    const onControllerChange = () => {
      if (swControlled) return
      swControlled = true
      if (!hadController) return // первая установка SW на этой странице — reload не нужен
      pendingHash = ''
      updateShown = false
      toast('Обновление…', { duration: 1500, position: 'bottom-right' })
      setTimeout(() => { void reloadApp() }, 800)
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
