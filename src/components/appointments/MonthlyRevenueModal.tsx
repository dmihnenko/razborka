import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/Spinner'
import { supabase } from '@/lib/supabase'
import { Package, Wrench, EyeOff, Eye, TrendingUp } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { MONTH_NAMES_RU } from '@/utils/status'
import Modal from '@/components/ui/Modal'
import { useToggleAppointmentExclude } from '@/hooks/useToggleAppointmentExclude'

type AppointmentRow = {
  id: string
  parts_cost: number | null
  total_parts_cost: number | null
  total_work_cost: number | null
  exclude_from_stats: boolean | null
  closed_date: string
  customers: { name: string } | null
  vehicles: { brand: string; model: string; license_plate: string | null } | null
}

interface MonthlyRevenueModalProps {
  isOpen: boolean
  onClose: () => void
  year: number
  month: number
}

export default function MonthlyRevenueModal({ isOpen, onClose, year, month }: MonthlyRevenueModalProps) {
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
      return data as unknown as AppointmentRow[]
    },
    enabled: isOpen && !!profile?.sto_company_id,
  })

  const toggleExcludeMutation = useToggleAppointmentExclude()

  const included = appointments?.filter(a => !a.exclude_from_stats) || []
  const excluded = appointments?.filter(a => a.exclude_from_stats) || []

  const includedTotal = included.reduce((sum, a) =>
    sum + ((a.parts_cost || a.total_parts_cost) || 0) + (a.total_work_cost || 0), 0
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      icon={<div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div>}
      title={`Закрытые заявки — ${MONTH_NAMES_RU[month - 1]} ${year}`}
      subtitle={`Учитывается в статистике: ${includedTotal.toLocaleString('ru-RU')} ₴`}
    >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
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
    </Modal>
  )
}
