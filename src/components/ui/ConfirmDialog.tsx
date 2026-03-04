import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onConfirm, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-2 rounded-full flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-yellow-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-yellow-600'}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
