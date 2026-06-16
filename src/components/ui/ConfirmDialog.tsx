import { useEffect, useRef } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import Modal from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  /** Блокирует кнопки во время выполнения */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title = 'Подтвердите действие',
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) setTimeout(() => confirmRef.current?.focus(), 60)
  }, [isOpen])

  // Enter → подтвердить (Escape обрабатывает Modal)
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') onConfirm() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onConfirm])

  const Icon = danger ? AlertTriangle : HelpCircle

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      hideClose
      icon={
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-100' : 'bg-slate-100'}`}>
          <Icon className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-slate-700'}`} />
        </div>
      }
      title={title}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          {danger ? (
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Подождите…' : confirmText}
            </button>
          ) : (
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="cab-btn cab-btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {loading ? 'Подождите…' : confirmText}
            </button>
          )}
        </div>
      }
    >
      <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
    </Modal>
  )
}
