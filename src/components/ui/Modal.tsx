import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { useBlockScroll } from '@/hooks/useBlockScroll'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  /** Иконка-бейдж слева в шапке (например, цветной кружок с lucide-иконкой) */
  icon?: ReactNode
  size?: ModalSize
  /** Контент липкого футера (обычно кнопки действий) */
  footer?: ReactNode
  children: ReactNode
  /** Закрывать по клику на фон (по умолчанию true) */
  closeOnOverlay?: boolean
  /** Закрывать по Escape (по умолчанию true) */
  closeOnEsc?: boolean
  /** Скрыть крестик закрытия */
  hideClose?: boolean
  /** Убрать внутренние отступы тела (для своей вёрстки) */
  bare?: boolean
  className?: string
}

const SIZE: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
}

/**
 * Единая модалка проекта.
 * Мобайл — bottom-sheet (выезжает снизу, есть «ручка», свайп-зона),
 * десктоп — карточка по центру с лёгким pop-in.
 * Блокирует скролл фона, закрывается по Escape и клику на фон.
 */
export default function Modal({
  isOpen, onClose, title, subtitle, icon, size = 'md', footer, children,
  closeOnOverlay = true, closeOnEsc = true, hideClose = false, bare = false, className = '',
}: ModalProps) {
  useBlockScroll(isOpen)

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeOnEsc, onClose])

  if (!isOpen) return null

  const hasHeader = title || subtitle || icon || !hideClose

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4 animate-fade-in"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={`relative bg-white w-full ${SIZE[size]} rounded-t-3xl sm:rounded-2xl shadow-2xl
          max-h-[92dvh] flex flex-col overflow-hidden animate-slide-up sm:animate-modal-pop ${className}`}
      >
        {/* Ручка — только мобиль */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" />

        {/* Шапка */}
        {hasHeader && (
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
            {icon && <div className="flex-shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              {title && (
                <h2 className="text-base font-bold text-gray-900 leading-tight truncate">{title}</h2>
              )}
              {subtitle && (
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{subtitle}</p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Тело */}
        <div className={`flex-1 overflow-y-auto overscroll-contain ${bare ? '' : 'px-5 py-4'}`}>
          {children}
        </div>

        {/* Футер */}
        {footer && (
          <div
            className="flex-shrink-0 border-t border-gray-100 px-5 py-3.5 bg-white"
            style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
