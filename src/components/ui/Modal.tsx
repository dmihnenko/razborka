import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  /** Закрывать по клику на фон (по умолчанию false — стандарт: не терять введённые данные) */
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
 * Единая модалка проекта (СТАНДАРТ, spec 4.3).
 * Мобайл — top-sheet (выезжает сверху, отступ + safe-area-top, без «ручки»),
 * десктоп — карточка по центру с лёгким pop-in.
 * При открытии ставит фокус на диалог. Блокирует скролл фона,
 * закрывается по Escape, крестиком и кнопками. По клику на фон НЕ закрывается
 * (стандарт для диалогов с контентом) — включается опцией closeOnOverlay.
 */
export default function Modal({
  isOpen, onClose, title, subtitle, icon, size = 'md', footer, children,
  closeOnOverlay = false, closeOnEsc = true, hideClose = false, bare = false, className = '',
}: ModalProps) {
  useBlockScroll(isOpen)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeOnEsc, onClose])

  // Фокус на модалку при открытии — на поле [autofocus]/[data-autofocus],
  // иначе на сам диалог; + подскролл в зону видимости (особенно мобиль).
  useEffect(() => {
    if (!isOpen) return
    const id = requestAnimationFrame(() => {
      const el = dialogRef.current
      if (!el) return
      const auto = el.querySelector<HTMLElement>('[autofocus],[data-autofocus]')
      ;(auto ?? el).focus({ preventScroll: false })
      el.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  if (!isOpen) return null

  const hasHeader = title || subtitle || icon || !hideClose

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 backdrop-blur-[2px] px-3 py-3 sm:p-4 animate-fade-in"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={`relative bg-white w-full ${SIZE[size]} rounded-2xl shadow-2xl outline-none
          max-h-[calc(100dvh-1.5rem)] sm:max-h-[92dvh] flex flex-col overflow-hidden animate-modal-pop ${className}`}
      >
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
    </div>,
    document.body,
  )
}
