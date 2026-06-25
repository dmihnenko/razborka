import { useEffect } from 'react'

// ============================================================================
// usePageMeta — клиентское обновление <title> и <meta name="description">
// при SPA-навигации. Согласовано с edge-мета из worker/index.js (computeMeta):
// edge ставит мета для краулеров на первом ответе, этот хук — для UX вкладки
// браузера и для Googlebot при клиентских переходах. Без внешних зависимостей.
// ============================================================================

/**
 * Обновляет document.title и meta[name="description"] при изменении аргументов.
 * Пустые/undefined значения не трогают соответствующий тег.
 */
export function usePageMeta(title?: string, description?: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return

    if (title) {
      document.title = title
    }

    if (description) {
      let tag = document.querySelector('meta[name="description"]')
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', 'description')
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', description)
    }
  }, [title, description])
}

export default usePageMeta
