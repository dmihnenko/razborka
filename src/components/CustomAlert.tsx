import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

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
    const handleKey = (e: KeyboardEvent) => {
      if (!confirm) return
      if (e.key === 'Escape') {
        if (confirm.onCancel) confirm.onCancel()
        setConfirm(null)
      }
      if (e.key === 'Enter') {
        confirm.onConfirm()
        setConfirm(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [confirm])

  const getIcon = () => {
    switch (alert?.type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />
      default:
        return <Info className="w-6 h-6 text-blue-600" />
    }
  }

  const getColors = () => {
    switch (alert?.type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* Alert Modal */}
      {alert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className={`bg-white rounded-lg shadow-xl max-w-md w-full p-6 border-2 ${getColors()}`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-base leading-relaxed">
                  {alert.message}
                </p>
              </div>
              <button
                onClick={closeAlert}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={closeAlert}
                className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-2 rounded-full flex-shrink-0 bg-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Подтвердите действие</h3>
                <p className="text-sm text-gray-600">{confirm.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {confirm.cancelText}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-red-600 hover:bg-red-700"
              >
                {confirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  )
}
