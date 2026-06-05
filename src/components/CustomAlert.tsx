import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import Modal from './ui/Modal'

type AlertType = 'success' | 'error' | 'info'

interface AlertData {
  message: string
  type: AlertType
}

interface ConfirmData {
  message: string
  onConfirm: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void
  showConfirm: (message: string, onConfirm: () => void, options?: { onCancel?: () => void, confirmText?: string, cancelText?: string }) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertData | null>(null)
  const [confirm, setConfirm] = useState<ConfirmData | null>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  const showAlert = (message: string, type: AlertType = 'info') => {
    setAlert({ message, type })
  }

  const showConfirm = (
    message: string, 
    onConfirm: () => void, 
    options?: { onCancel?: () => void, confirmText?: string, cancelText?: string }
  ) => {
    setConfirm({
      message,
      onConfirm,
      onCancel: options?.onCancel,
      confirmText: options?.confirmText || 'Да',
      cancelText: options?.cancelText || 'Отмена',
    })
  }

  const closeAlert = () => {
    setAlert(null)
  }

  const handleConfirm = () => {
    if (confirm) {
      confirm.onConfirm()
      setConfirm(null)
    }
  }

  const handleCancel = () => {
    if (confirm?.onCancel) {
      confirm.onCancel()
    }
    setConfirm(null)
  }

  useEffect(() => {
    if (confirm) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50)
    }
  }, [confirm])

  useEffect(() => {
    if (!confirm) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { confirm.onConfirm(); setConfirm(null) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [confirm])

  const alertIcon = () => {
    switch (alert?.type) {
      case 'success': return { Icon: CheckCircle, cls: 'bg-green-100 text-green-600' }
      case 'error':   return { Icon: AlertCircle,  cls: 'bg-red-100 text-red-600' }
      default:        return { Icon: Info,         cls: 'bg-blue-100 text-blue-600' }
    }
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Alert */}
      {alert && (() => {
        const { Icon, cls } = alertIcon()
        return (
          <Modal
            isOpen
            onClose={closeAlert}
            size="sm"
            icon={<div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls}`}><Icon className="w-5 h-5" /></div>}
            title={alert.type === 'success' ? 'Готово' : alert.type === 'error' ? 'Ошибка' : 'Уведомление'}
            footer={
              <button
                onClick={closeAlert}
                className="w-full py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                OK
              </button>
            }
          >
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{alert.message}</p>
          </Modal>
        )
      })()}

      {/* Confirm */}
      {confirm && (
        <Modal
          isOpen
          onClose={handleCancel}
          size="sm"
          hideClose
          icon={<div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>}
          title="Подтвердите действие"
          footer={
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {confirm.cancelText}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={handleConfirm}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {confirm.confirmText}
              </button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{confirm.message}</p>
        </Modal>
      )}
    </AlertContext.Provider>
  )
}
