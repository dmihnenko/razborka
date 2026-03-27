import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, History, User, FileText, Car, Settings, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function ActivityHistory() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  // Получаем логи изменений
  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('sto_company_id', profile?.sto_company_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id,
  })

  const getIconByEntityType = (entityType: string) => {
    switch (entityType) {
      case 'appointment':
        return <FileText className="w-5 h-5" />
      case 'customer':
        return <User className="w-5 h-5" />
      case 'vehicle':
        return <Car className="w-5 h-5" />
      case 'user':
        return <Settings className="w-5 h-5" />
      default:
        return <History className="w-5 h-5" />
    }
  }

  const getColorByActionType = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return 'bg-green-100 text-green-800'
      case 'updated':
        return 'bg-blue-100 text-blue-800'
      case 'deleted':
        return 'bg-red-100 text-red-800'
      case 'archived':
        return 'bg-gray-100 text-gray-800'
      case 'status_changed':
        return 'bg-purple-100 text-purple-800'
      case 'assigned':
        return 'bg-orange-100 text-orange-800'
      case 'payment_updated':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return 'Создано'
      case 'updated':
        return 'Обновлено'
      case 'deleted':
        return 'Удалено'
      case 'archived':
        return 'В архив'
      case 'restored':
        return 'Восстановлено'
      case 'status_changed':
        return 'Статус изменен'
      case 'assigned':
        return 'Назначено'
      case 'payment_updated':
        return 'Оплата'
      default:
        return actionType
    }
  }

  const getEntityLabel = (entityType: string) => {
    switch (entityType) {
      case 'appointment':
        return 'Заявка'
      case 'customer':
        return 'Клиент'
      case 'vehicle':
        return 'Автомобиль'
      case 'user':
        return 'Пользователь'
      case 'service':
        return 'Услуга'
      case 'part':
        return 'Запчасть'
      default:
        return entityType
    }
  }

  return (
    <div>
      {/* Шапка */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Назад к главной
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <History className="w-8 h-8 mr-3 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">История изменений</h1>
              <p className="text-sm text-gray-500 mt-1">
                Логирование всех действий с заявками и клиентами (хранятся 60 дней)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Список логов */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200">
            {logs.map((log: any) => (
              <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Иконка */}
                  <div className={`p-3 rounded-lg ${getColorByActionType(log.action_type)}`}>
                    {getIconByEntityType(log.entity_type)}
                  </div>

                  {/* Основная информация */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getColorByActionType(log.action_type)}`}>
                        {getActionLabel(log.action_type)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getEntityLabel(log.entity_type)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-900 font-medium mb-2">
                      {log.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{log.user_name}</span>
                      </div>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </span>
                      <span>•</span>
                      <span className="text-gray-400">
                        {new Date(log.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Детали изменений (если есть) */}
                    {(log.old_value || log.new_value) && (
                      <details className="mt-3">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                          Показать детали изменений
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                          {log.old_value && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">
                                Было:
                              </p>
                              <pre className="text-xs text-gray-600 overflow-x-auto">
                                {JSON.stringify(log.old_value, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">
                                Стало:
                              </p>
                              <pre className="text-xs text-gray-600 overflow-x-auto">
                                {JSON.stringify(log.new_value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <History className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">История изменений пуста</p>
          <p className="text-gray-400 text-sm mt-2">
            Все действия с заявками и клиентами будут отображаться здесь
          </p>
        </div>
      )}

      {/* Информационный блок внизу */}
      {logs && logs.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Trash2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Автоматическое удаление
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Записи истории автоматически удаляются через 60 дней. 
                Данные клиентов, автомобилей и заявок не затрагиваются.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
