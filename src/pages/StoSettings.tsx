import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { Settings as SettingsIcon, Wrench } from 'lucide-react'

export default function StoSettings() {
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()

  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Загружаем настройки СТО
  const { data: stoCompany, isLoading } = useQuery({
    queryKey: ['sto_company_settings', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies')
        .select('id, name, services_menu_enabled')
        .eq('id', profile.sto_company_id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id && isStoOwner,
  })

  // Переключение меню услуг для работников
  const toggleServicesMenuMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('sto_companies')
        .update({ services_menu_enabled: enabled })
        .eq('id', profile?.sto_company_id)
      if (error) throw error
    },
    onSuccess: () => {
      // Инвалидируем все связанные запросы
      queryClient.invalidateQueries({ queryKey: ['sto_company_settings'] })
      queryClient.invalidateQueries({ queryKey: ['sto_company'] })
      // Важно: сбрасываем кэш для всех компонентов, использующих настройки СТО
      queryClient.refetchQueries({ queryKey: ['sto_company'] })
      toast.success('Настройки обновлены')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Ошибка при обновлении настроек')
    }
  })

  if (!isStoOwner) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-center text-gray-500">
          Доступ запрещен. Только владелец СТО может управлять настройками.
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const servicesMenuEnabled = stoCompany?.services_menu_enabled ?? true

  return (
    <div className="container-mobile">
      <div className="mb-4 sm:mb-6">
        <h1 className="heading-mobile-1">Настройки СТО</h1>
        {stoCompany?.name && (
          <p className="text-mobile-sm text-gray-500 mt-1">{stoCompany.name}</p>
        )}
      </div>

      <div className="space-y-4">
        {/* Меню услуг */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-mobile-lg font-semibold text-gray-900">
                  Меню услуг для работников
                </h2>
              </div>
              <p className="text-mobile-sm text-gray-600 mb-4">
                Разрешить работникам использовать справочник услуг при создании заявок. 
                Когда выключено, работники не будут видеть кнопку "Добавить из справочника".
              </p>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleServicesMenuMutation.mutate(!servicesMenuEnabled)}
                  disabled={toggleServicesMenuMutation.isPending}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    servicesMenuEnabled ? 'bg-blue-700' : 'bg-gray-300'
                  } ${toggleServicesMenuMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      servicesMenuEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-mobile-base font-medium ${
                  servicesMenuEnabled ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {servicesMenuEnabled ? 'Включено' : 'Выключено'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Информация */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <SettingsIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-mobile-sm text-blue-900">
              <p className="font-medium mb-1">Совет:</p>
              <p>
                Отключите меню услуг, если вы хотите, чтобы работники вводили услуги вручную 
                без использования готового справочника. Это может быть полезно для большей гибкости 
                при описании выполненных работ.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
