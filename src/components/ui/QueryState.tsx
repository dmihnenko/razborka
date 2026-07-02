import { ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface QueryStateProps {
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  onRetry?: () => void
  /** Слот загрузки (скелетон). Если не передан — компактный спиннер. */
  loading?: ReactNode
  /** Слот пустого состояния (обычно <EmptyState/>). */
  empty?: ReactNode
  children: ReactNode
}

/**
 * Единый гейт состояний запроса для экранов ядра: загрузка → ошибка (с «Повторить»)
 * → пусто → контент. Ink & Signal: карточка, без заливок, цвет — мелким сигналом.
 */
export function QueryState({
  isLoading, isError, isEmpty, onRetry, loading, empty, children,
}: QueryStateProps) {
  if (isError) {
    return (
      <div className="card flex flex-col items-center text-center gap-3 py-8">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--cab-surface-2)]">
          <AlertTriangle className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--cab-danger)' }} />
        </span>
        <div>
          <p className="font-semibold text-gray-900">Не удалось загрузить данные</p>
          <p className="text-sm text-gray-500 mt-0.5">Проверьте соединение и попробуйте снова.</p>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="btn-secondary btn-sm">
            <RefreshCw className="w-4 h-4" strokeWidth={1.5} /> Повторить
          </button>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <>
        {loading ?? (
          <div className="flex items-center justify-center py-12">
            <span className="w-6 h-6 rounded-full border-2 border-[var(--cab-border)] border-t-[var(--cab-signal)] animate-spin" aria-label="Загрузка" />
          </div>
        )}
      </>
    )
  }

  if (isEmpty) return <>{empty}</>

  return <>{children}</>
}

export default QueryState
