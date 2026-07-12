import { useEffect, useRef, useState } from 'react'

interface Options {
  /** Действие обновления (напр. queryClient.invalidateQueries). Промис держит спиннер. */
  onRefresh: () => Promise<unknown> | void
  /**
   * Скролл-контейнер (сам DOM-элемент).
   *  - `undefined` — скролл документа (window);
   *  - `null` — контейнер ещё не смонтирован (жест не вешаем, ждём);
   *  - элемент — вешаем на него.
   */
  scrollEl?: HTMLElement | null
  disabled?: boolean
  /** Порог срабатывания, px (после сопротивления). */
  threshold?: number
}

/**
 * Кастомный pull-to-refresh для тач-устройств. Нативный PTR не работает: кабинет —
 * фиксированной высоты со своим скроллом, PWA standalone гасит браузерный жест.
 * Ловим протяжку вниз у верха контейнера и по отпусканию за порогом зовём onRefresh.
 */
export function usePullToRefresh({ onRefresh, scrollEl, disabled, threshold = 70 }: Options) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  // Жестовое состояние — в ref (обработчики не должны зависеть от ререндеров).
  const st = useRef({ startY: 0, active: false, pulling: false, pull: 0, refreshing: false })
  // scrollEl передаётся аргументом, но берём его признак «оконный» стабильно.
  const useWindowScroll = scrollEl === undefined

  useEffect(() => {
    if (disabled) return
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return
    // Контейнер указан, но ещё не смонтирован — ждём (эффект перезапустится, когда появится).
    if (!useWindowScroll && !scrollEl) return

    const el = scrollEl as HTMLElement | null
    const getScrollTop = () =>
      useWindowScroll ? (window.scrollY || document.documentElement.scrollTop || 0) : (el?.scrollTop ?? 0)
    const target: EventTarget = useWindowScroll ? window : (el as HTMLElement)

    const onStart = (e: TouchEvent) => {
      const s = st.current
      if (s.refreshing) return
      if (getScrollTop() <= 0) {
        s.startY = e.touches[0].clientY
        s.active = true
        s.pulling = false
      } else {
        s.active = false
      }
    }
    const onMove = (e: TouchEvent) => {
      const s = st.current
      if (!s.active || s.refreshing) return
      const dy = e.touches[0].clientY - s.startY
      if (dy <= 0) { if (s.pulling) { s.pulling = false; s.pull = 0; setPull(0) } return }
      if (getScrollTop() > 0) { s.active = false; s.pull = 0; setPull(0); return }
      s.pulling = true
      const dist = Math.min(110, dy * 0.5) // сопротивление
      s.pull = dist
      setPull(dist)
      if (e.cancelable) e.preventDefault() // забираем жест у нативного overscroll
    }
    const finish = () => {
      const s = st.current
      if (!s.active) return
      s.active = false
      if (s.pulling && s.pull >= threshold) {
        s.refreshing = true; setRefreshing(true); s.pull = threshold; setPull(threshold)
        Promise.resolve(onRefresh())
          .catch(() => { /* ignore */ })
          .finally(() => { s.refreshing = false; setRefreshing(false); s.pull = 0; setPull(0) })
      } else {
        s.pull = 0; setPull(0)
      }
      s.pulling = false
    }

    target.addEventListener('touchstart', onStart as EventListener, { passive: true })
    target.addEventListener('touchmove', onMove as EventListener, { passive: false })
    target.addEventListener('touchend', finish as EventListener, { passive: true })
    target.addEventListener('touchcancel', finish as EventListener, { passive: true })
    return () => {
      target.removeEventListener('touchstart', onStart as EventListener)
      target.removeEventListener('touchmove', onMove as EventListener)
      target.removeEventListener('touchend', finish as EventListener)
      target.removeEventListener('touchcancel', finish as EventListener)
    }
  }, [disabled, onRefresh, scrollEl, useWindowScroll, threshold])

  return { pull, refreshing, threshold }
}

export default usePullToRefresh
