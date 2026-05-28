import { AlertCircle } from 'lucide-react'

export function PartsAccessDenied() {
  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">У вас нет доступа к разборке</p>
      </div>
    </div>
  )
}
