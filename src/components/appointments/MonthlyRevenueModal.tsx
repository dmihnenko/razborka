import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { X, Package, Wrench, EyeOff, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'

interface MonthlyRevenueModalProps {
  isOpen: boolean
  onClose: () => void
  year: number
  month: number
}

export default function MonthlyRevenueModal({ isOpen, onClose, year, month }: MonthlyRevenueModalProps) {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['monthly-appointments', profile?.sto_company_id, year, month],
    queryFn: async () => {
      const firstDay = new Date(year, month - 1, 1)
      const nextMonth = new Date(year, month, 1)

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          parts_cost,
          total_parts_cost,
          total_work_cost,
          exclude_from_stats,
          closed_date,
          customers(name),
          vehicles(brand, model, license_plate)
        `)
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .gte('closed_date', firstDay.toISOString())
        .lt('closed_date', nextMonth.toISOString())
        .order('closed_date', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: isOpen && !!profile?.sto_company_id,
  })

  const toggleExcludeMutation = useMutation({
    mutationFn: async ({ id, exclude }: { id: string, exclude: boolean }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ exclude_from_stats: exclude })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success('Статус учета обновлен')
    },
    onError: () => {
      toast.error('Ошибка обновления')
    }
  })

  if (!isOpen) return null

  const included = appointments?.filter(a => !a.exclude_from_stats) || []
  const excluded = appointments?.filter(a => a.exclude_from_stats) || []

  const includedTotal = included.reduce((sum, a) => 
    sum + ((a.parts_cost || a.total_parts_cost) || 0) + (a.total_work_cost || 0), 0
  )

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            Закрытые заявки - {monthNames[month - 1]} {year}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Учитываемые заявки */}
              {included.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Учитывается в статистике
                    </h3>
                    <span className="text-sm font-medium text-green-600">
                      {includedTotal.toLocaleString('ru-RU')} ₴
                    </span>
                  </div>
                  <div className="space-y-2">
                    {included.map((appointment) => {
                      const partsCost = (appointment.parts_cost || appointment.total_parts_cost) || 0
                      const workCost = appointment.total_work_cost || 0
                      const total = partsCost + workCost

                      return (
                        <div
                          key={appointment.id}
                          className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">
                                {appointment.customers?.name || <span className="text-gray-400 italic">Клиент не указан</span>}
                              </p>
                              <p className="text-sm text-gray-600">
                                {appointment.vehicles
                                  ? <>{appointment.vehicles.brand} {appointment.vehicles.model}</>
                                  : <span className="text-gray-400 italic">Авто не указано</span>}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-sm">
                                {partsCost > 0 && (
                                  <div className="flex items-center gap-1 text-green-700">
                                    <Package className="w-3 h-3" />
                                    <span>{partsCost.toLocaleString('ru-RU')} ₴</span>
                                  </div>
                                )}
                                {workCost > 0 && (
                                  <div className="flex items-center gap-1 text-purple-700">
                                    <Wrench className="w-3 h-3" />
                                    <span>{workCost.toLocaleString('ru-RU')} ₴</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-lg font-bold text-gray-900">
                                {total.toLocaleString('ru-RU')} ₴
                              </span>
                              <button
                                onClick={() => toggleExcludeMutation.mutate({ 
                                  id: appointment.id, 
                                  exclude: true 
                                })}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              >
                                <EyeOff className="w-3 h-3" />
                                Исключить
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Исключенные заявки */}
              {excluded.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-500 mb-3">
                    Исключено из статистики
                  </h3>
                  <div className="space-y-2">
                    {excluded.map((appointment) => {
                      const partsCost = (appointment.parts_cost || appointment.total_parts_cost) || 0
                      const workCost = appointment.total_work_cost || 0
                      const total = partsCost + workCost

                      return (
                        <div
                          key={appointment.id}
                          className="bg-gray-50 border border-gray-200 rounded-lg p-3 opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-700">
                                {appointment.customers?.name || <span className="text-gray-400 italic">Клиент не указан</span>}
                              </p>
                              <p className="text-sm text-gray-500">
                                {appointment.vehicles
                                  ? <>{appointment.vehicles.brand} {appointment.vehicles.model}</>
                                  : <span className="text-gray-400 italic">Авто не указано</span>}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-sm">
                                {partsCost > 0 && (
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <Package className="w-3 h-3" />
                                    <span>{partsCost.toLocaleString('ru-RU')} ₴</span>
                                  </div>
                                )}
                                {workCost > 0 && (
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <Wrench className="w-3 h-3" />
                                    <span>{workCost.toLocaleString('ru-RU')} ₴</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-lg font-bold text-gray-600">
                                {total.toLocaleString('ru-RU')} ₴
                              </span>
                              <button
                                onClick={() => toggleExcludeMutation.mutate({ 
                                  id: appointment.id, 
                                  exclude: false 
                                })}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Включить
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {appointments?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Нет закрытых заявок за этот месяц
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
