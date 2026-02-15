import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

const CURRENT_VERSION = '1.0.1'
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000 // 5 минут

export default function VersionChecker() {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    const checkVersion = () => {
      const storedVersion = localStorage.getItem('app_version')
      
      // Если версия изменилась
      if (storedVersion && storedVersion !== CURRENT_VERSION) {
        setHasUpdate(true)
        showUpdateNotification()
      }
      
      // Сохраняем текущую версию
      localStorage.setItem('app_version', CURRENT_VERSION)
    }

    const showUpdateNotification = () => {
      toast.info(
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-semibold">Доступно обновление!</p>
            <p className="text-sm text-gray-600">Перезагрузите страницу для применения изменений</p>
          </div>
        </div>,
        {
          duration: 10000,
          action: {
            label: 'Обновить',
            onClick: () => window.location.reload()
          }
        }
      )
    }

    // Проверяем версию при загрузке
    checkVersion()

    // Периодическая проверка обновлений
    const interval = setInterval(() => {
      fetch('/version.json?' + Date.now())
        .then(res => res.json())
        .then(data => {
          if (data.version !== CURRENT_VERSION) {
            setHasUpdate(true)
            showUpdateNotification()
          }
        })
        .catch(() => {
          // Игнорируем ошибки проверки версии
        })
    }, VERSION_CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  // Показываем кнопку обновления если есть обновление
  if (hasUpdate) {
    return (
      <button
        onClick={() => window.location.reload()}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Обновить приложение
      </button>
    )
  }

  return null
}
