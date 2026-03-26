import { Settings as SettingsIcon } from 'lucide-react'

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <SettingsIcon className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Настройки платформы</h1>
          <p className="text-sm text-gray-500">Глобальные параметры администратора</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-500 text-sm">В разработке...</p>
      </div>
    </div>
  )
}

