import { createContext, useContext, useState, ReactNode } from 'react'
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Подтверждение</h3>
                <p className="text-gray-700 text-base leading-relaxed">
                  {confirm.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                {confirm.cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
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
