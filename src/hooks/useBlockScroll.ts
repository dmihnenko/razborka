import { useEffect } from 'react'

/**
 * Хук для блокировки прокрутки страницы
 * Используется в модальных окнах для предотвращения скролла фона
 * @param isBlocked - блокировать ли скролл
 */
export function useBlockScroll(isBlocked: boolean) {
  useEffect(() => {
    if (isBlocked) {
      // Сохраняем текущее значение
      const originalStyle = window.getComputedStyle(document.body).overflow
      
      // Блокируем скролл
      document.body.style.overflow = 'hidden'
      
      // Восстанавливаем при размонтировании
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isBlocked])
}
