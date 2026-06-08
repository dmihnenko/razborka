import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { Settings as SettingsIcon, Wrench, Trash2, ChevronRight, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'
import { updateStoLaborRate } from '@/services/stoService'

export default function StoSettings() {
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()

  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const { data: stoCompany, isLoading } = useQuery({
    queryKey: ['sto_company_settings', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies')
        .select('id, name, services_menu_enabled, labor_rate')
        .eq('id', profile?.sto_company_id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id && isStoOwner,
  })

  // Ставка нормо-часа
  const [laborRate, setLaborRate] = useState('')
  useEffect(() => {
    if (stoCompany) setLaborRate(stoCompany.labor_rate != null ? String(stoCompany.labor_rate) : '')
  }, [stoCompany])

  const saveLaborRateMutation = useMutation({
    mutationFn: () => updateStoLaborRate(profile!.sto_company_id!, Number(laborRate) || 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sto_company_settings'] })
      queryClient.invalidateQueries({ queryKey: ['sto-labor-rate'] })
      queryClient.invalidateQueries({ queryKey: ['service-catalog'] })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      toast.success('Ставка сохранена')
    },
    onError: (error: any) => toast.error(error.message || 'Ошибка сохранения ставки'),
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
        <Spinner size="lg" />
      </div>
    )
  }

  const servicesMenuEnabled = stoCompany?.services_menu_enabled ?? true

  return (
    <div className="container-mobile">
      <PageHeader title="Настройки СТО" subtitle={stoCompany?.name || undefined} />

      <div className="space-y-4">

        <div className="card p-4 sm:p-6">
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

        {/* Ставка нормо-часа */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Clock className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="text-mobile-lg font-semibold text-gray-900">Ставка нормо-часа</h2>
          </div>
          <p className="text-mobile-sm text-gray-600 mb-4">
            Стоимость работ в каталоге рассчитывается как <b>нормо-часы × ставка</b>. Та же ставка
            применяется к записям (работы = нормо-часы × ставку).
          </p>
          <div className="flex items-center gap-2 max-w-xs">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                value={laborRate}
                onChange={e => setLaborRate(e.target.value)}
                placeholder="0"
                className="form-input pr-16 text-right"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₴/н·ч</span>
            </div>
            <button
              onClick={() => saveLaborRateMutation.mutate()}
              disabled={saveLaborRateMutation.isPending || laborRate === (stoCompany?.labor_rate != null ? String(stoCompany.labor_rate) : '')}
              className="btn-primary btn-sm"
            >
              {saveLaborRateMutation.isPending ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>

        {/* Корзина */}
        <Link
          to="/sto/trash"
          className="card p-4 sm:p-6 flex items-center gap-4 hover:bg-gray-50 transition-colors"
        >
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-mobile-base font-semibold text-gray-900">Корзина</h2>
            <p className="text-mobile-sm text-gray-500 mt-0.5">
              Удалённые объекты хранятся 7 дней с возможностью восстановления
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </Link>

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
