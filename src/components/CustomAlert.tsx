import { createContext, useContext, useState, ReactNode } from 'react'
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'

type AlertType = 'success' | 'error' | 'info'

interface AlertData {
  message: string
  type: AlertType
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void
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

  const showAlert = (message: string, type: AlertType = 'info') => {
    setAlert({ message, type })
  }

  const closeAlert = () => {
    setAlert(null)
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
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      
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
    </AlertContext.Provider>
  )
}
