import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, DollarSign, Check } from 'lucide-react'

export default function MonthlyDetails() {
  const { month } = useParams<{ month: string }>()
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  // Получаем заявки за выбранный месяц
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['monthly-appointments', profile?.sto_company_id, month],
    queryFn: async () => {
      if (!month) return []

      const [year, monthNum] = month.split('-')
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59)

      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          customers(name, phone),
          vehicles(brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)
        `)
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .gte('closed_date', startDate.toISOString())
        .lte('closed_date', endDate.toISOString())
        .order('closed_date', { ascending: false })

      return data || []
    },
    enabled: !!profile?.sto_company_id && !!month,
  })

  // Статистика по месяцу
  const stats = appointments ? {
    count: appointments.length,
    totalParts: appointments.reduce((sum, a) => sum + (a.parts_cost || 0), 0),
    totalWork: appointments.reduce((sum, a) => sum + (a.total_work_cost || 0), 0),
    partsPaidCount: appointments.filter(a => a.parts_paid).length,
    workPaidCount: appointments.filter(a => a.work_paid).length,
  } : null

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const [year, monthNum] = (month || '').split('-')
  const monthName = monthNum ? `${monthNames[parseInt(monthNum) - 1]} ${year}` : ''

  const statusColors = {
    scheduled: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-orange-100 text-orange-800',
    ready: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-800',
  }

  const statusLabels = {
    scheduled: 'Запланирована',
    in_progress: 'В работе',
    ready: 'Готова',
    completed: 'Завершена',
    archived: 'Архив',
    cancelled: 'Отменена',
  }

  return (
    <div className="container-mobile">
      {/* Шапка */}
      <div className="mb-4 sm:mb-6">
        <Link
          to="/statistics"
          className="inline-flex items-center text-mobile-sm text-gray-600 hover:text-gray-900 mb-3 sm:mb-4"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
          Назад к статистике
        </Link>
        <h1 className="heading-mobile-1">
          Детали за {monthName}
        </h1>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 lg:grid-cols-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
              <div className="bg-blue-500 p-2 sm:p-3 rounded-lg self-start">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="sm:ml-3 md:ml-4">
                <p className="text-mobile-sm font-medium text-gray-600">Всего заявок</p>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">{stats.count}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
              <div className="bg-orange-500 p-2 sm:p-3 rounded-lg self-start">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="sm:ml-3 md:ml-4">
                <p className="text-mobile-sm font-medium text-gray-600">Запчасти</p>
                <p className="text-sm sm:text-lg md:text-2xl font-semibold text-gray-900">₴{Math.round(stats.totalParts).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
              <div className="bg-green-500 p-2 sm:p-3 rounded-lg self-start">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="sm:ml-3 md:ml-4">
                <p className="text-mobile-sm font-medium text-gray-600">Работы</p>
                <p className="text-sm sm:text-lg md:text-2xl font-semibold text-gray-900">₴{Math.round(stats.totalWork).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
              <div className="bg-purple-500 p-2 sm:p-3 rounded-lg self-start">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="sm:ml-3 md:ml-4">
                <p className="text-mobile-sm font-medium text-gray-600">Итого</p>
                <p className="text-sm sm:text-lg md:text-2xl font-semibold text-gray-900">
                  ₴{Math.round(stats.totalParts + stats.totalWork).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Таблица заявок */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Desktop таблица */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Заявки ({appointments?.length || 0})
              </h2>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Клиент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Автомобиль
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Работник
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Запчасти
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Работы
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Оплаты
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Сумма
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments?.map((appointment: any) => (
                  <tr 
                    key={appointment.id}
                    onClick={() => navigate(`/sto/appointments/${appointment.id}`)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{appointment.customers?.name}</div>
                      <div className="text-sm text-gray-500">{appointment.customers?.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.vehicles?.brand} {appointment.vehicles?.model}
                      <div className="text-sm text-gray-500">{appointment.vehicles?.license_plate}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {appointment.assigned_to_name || appointment.assigned_to_profile?.full_name || 
                       appointment.assigned_to_profile?.email || 
                       <span className="text-gray-400 italic">Не назначено</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      ₴{(appointment.parts_cost || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      ₴{(appointment.total_work_cost || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex flex-col gap-1 items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">З:</span>
                          {appointment.parts_paid ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Р:</span>
                          {appointment.work_paid ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                      ₴{((appointment.parts_cost || 0) + (appointment.total_work_cost || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              {stats && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      Итого
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                      ₴{Math.round(stats.totalParts).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                      ₴{Math.round(stats.totalWork).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex flex-col gap-1 items-center">
                        <span className="text-xs text-gray-600">{stats.partsPaidCount}/{stats.count}</span>
                        <span className="text-xs text-gray-600">{stats.workPaidCount}/{stats.count}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-primary">
                      ₴{Math.round(stats.totalParts + stats.totalWork).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Mobile карточки */}
        <div className="md:hidden space-y-3">
          {appointments?.map((appointment: any) => (
            <Link
              key={appointment.id}
              to={`/sto/appointments/${appointment.id}`}
              className="card-mobile block hover:shadow-md transition-shadow"
            >
              {/* Клиент и авто */}
              <div className="mb-3">
                <h3 className="text-mobile-base font-semibold text-gray-900 mb-1">
                  {appointment.customers?.name}
                </h3>
                <p className="text-mobile-sm text-gray-600">
                  {appointment.vehicles?.brand} {appointment.vehicles?.model}
                </p>
                <p className="text-mobile-sm text-gray-500">
                  {appointment.vehicles?.license_plate}
                </p>
              </div>

              {/* Работник */}
              {appointment.assigned_to_profile && (
                <div className="mb-3 pb-3 border-b border-gray-100">
                  <span className="text-mobile-sm text-gray-600">Работник: </span>
                  <span className="text-mobile-sm text-gray-900">
                    {appointment.assigned_to_profile?.full_name || appointment.assigned_to_profile?.email}
                  </span>
                </div>
              )}

              {/* Суммы */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-mobile-sm text-gray-600">Запчасти:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-mobile-base font-semibold text-gray-900">
                      ₴{(appointment.parts_cost || 0).toLocaleString()}
                    </span>
                    {appointment.parts_paid && <Check className="w-4 h-4 text-green-600" />}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-mobile-sm text-gray-600">Работы:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-mobile-base font-semibold text-gray-900">
                      ₴{(appointment.total_work_cost || 0).toLocaleString()}
                    </span>
                    {appointment.work_paid && <Check className="w-4 h-4 text-green-600" />}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-mobile-base font-medium text-gray-900">Итого:</span>
                  <span className="text-lg font-bold text-primary">
                    ₴{((appointment.parts_cost || 0) + (appointment.total_work_cost || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </>
      )}
    </div>
  )
}
