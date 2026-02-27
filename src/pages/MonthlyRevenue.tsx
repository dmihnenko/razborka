import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Wrench, EyeOff, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function MonthlyRevenue() {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['monthly-appointments', profile?.sto_company_id, profile?.id, year, month],
    queryFn: async () => {
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0, 23, 59, 59)

      let query = supabase
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
        .lte('closed_date', lastDay.toISOString())

      // Если не владелец - показываем только заявки работника
      if (!isStoOwner) {
        query = query.eq('assigned_to', profile?.id)
      }

      const { data, error } = await query.order('closed_date', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id,
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

  const included = appointments?.filter(a => !a.exclude_from_stats) || []
  const excluded = isStoOwner ? (appointments?.filter(a => a.exclude_from_stats) || []) : []

  const includedTotal = included.reduce((sum, a) => 
    sum + ((a.parts_cost || a.total_parts_cost) || 0) + (a.total_work_cost || 0), 0
  )

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]

  return (
    <div className="container-mobile">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Закрытые заявки - {monthNames[month - 1]} {year}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Учитываемые заявки */}
          {included.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Учитывается в статистике
                </h2>
                <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded">
                  {includedTotal.toLocaleString('ru-RU')} ₴
                </span>
              </div>
              <div className="space-y-3">
                {included.map((appointment) => {
                  const partsCost = (appointment.parts_cost || appointment.total_parts_cost) || 0
                  const workCost = appointment.total_work_cost || 0
                  const total = partsCost + workCost

                  return (
                    <div
                      key={appointment.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 mb-1">
                            {appointment.customers?.name || <span className="text-gray-400 italic">Клиент не указан</span>}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            {appointment.vehicles
                              ? <>{appointment.vehicles.brand} {appointment.vehicles.model}{appointment.vehicles.license_plate && <span className="ml-2 text-gray-500">{appointment.vehicles.license_plate}</span>}</>
                              : <span className="text-gray-400 italic">Авто не указано</span>}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            {partsCost > 0 && (
                              <div className="flex items-center gap-1.5 text-green-700">
                                <Package className="w-4 h-4" />
                                <span className="font-medium">{partsCost.toLocaleString('ru-RU')} ₴</span>
                              </div>
                            )}
                            {workCost > 0 && (
                              <div className="flex items-center gap-1.5 text-purple-700">
                                <Wrench className="w-4 h-4" />
                                <span className="font-medium">{workCost.toLocaleString('ru-RU')} ₴</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xl font-bold text-gray-900">
                            {total.toLocaleString('ru-RU')} ₴
                          </span>
                          {isStoOwner && (
                            <button
                              onClick={() => toggleExcludeMutation.mutate({ 
                                id: appointment.id, 
                                exclude: true 
                              })}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            >
                              <EyeOff className="w-4 h-4" />
                              Исключить
                            </button>
                          )}
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
            <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-600 mb-4">
                Исключено из статистики
              </h2>
              <div className="space-y-3">
                {excluded.map((appointment) => {
                  const partsCost = (appointment.parts_cost || appointment.total_parts_cost) || 0
                  const workCost = appointment.total_work_cost || 0
                  const total = partsCost + workCost

                  return (
                    <div
                      key={appointment.id}
                      className="bg-white border border-gray-300 rounded-lg p-4 opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 mb-1">
                            {appointment.customers?.name || <span className="text-gray-400 italic">Клиент не указан</span>}
                          </p>
                          <p className="text-sm text-gray-500 mb-2">
                            {appointment.vehicles
                              ? <>{appointment.vehicles.brand} {appointment.vehicles.model}{appointment.vehicles.license_plate && <span className="ml-2">{appointment.vehicles.license_plate}</span>}</>
                              : <span className="text-gray-400 italic">Авто не указано</span>}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            {partsCost > 0 && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Package className="w-4 h-4" />
                                <span className="font-medium">{partsCost.toLocaleString('ru-RU')} ₴</span>
                              </div>
                            )}
                            {workCost > 0 && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Wrench className="w-4 h-4" />
                                <span className="font-medium">{workCost.toLocaleString('ru-RU')} ₴</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xl font-bold text-gray-600">
                            {total.toLocaleString('ru-RU')} ₴
                          </span>
                          <button
                            onClick={() => toggleExcludeMutation.mutate({ 
                              id: appointment.id, 
                              exclude: false 
                            })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">Нет закрытых заявок за этот месяц</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
