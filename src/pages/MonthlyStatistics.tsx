import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import { Plus, Archive, List, TrendingUp, Check } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'

export default function MonthlyStatistics() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Заявки работника
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['worker-appointments', profile?.id, showArchived],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          customers(name, phone),
          vehicles(brand, model, license_plate, vin),
          appointment_parts(id, description, created_at),
          created_by_profile:user_profiles!created_by(full_name, email),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)
        `)

      // Фильтруем по СТО пользователя
      if (profile?.sto_company_id) {
        query = query.eq('sto_company_id', profile.sto_company_id)
      }

      // Фильтруем по архиву
      if (showArchived) {
        query = query.eq('status', 'archived')
      } else {
        query = query.neq('status', 'archived')
      }

      // Если пользователь - работник (не владелец), показываем только его заявки
      if (!isStoOwner && profile?.id) {
        query = query.eq('assigned_to', profile.id)
      }

      const { data, error } = await query.order('scheduled_date', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  // Статистика по месяцам для архивных заявок
  const { data: monthlyStats, isLoading: statsLoading } = useQuery({
    queryKey: ['monthly-statistics', profile?.sto_company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('closed_date, parts_cost, total_work_cost, parts_paid, work_paid')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .not('closed_date', 'is', null)
        .order('closed_date', { ascending: true })

      if (!data || data.length === 0) return []

      // Группируем по месяцам
      const monthlyData: Record<string, { 
        count: number
        parts: number
        work: number
        total: number
        partsPaidCount: number
        workPaidCount: number
      }> = {}

      data.forEach((appointment: any) => {
        const date = new Date(appointment.closed_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { 
            count: 0, 
            parts: 0, 
            work: 0, 
            total: 0,
            partsPaidCount: 0,
            workPaidCount: 0
          }
        }

        monthlyData[monthKey].count++
        const parts = appointment.parts_cost || 0
        const work = appointment.total_work_cost || 0
        monthlyData[monthKey].parts += parts
        monthlyData[monthKey].work += work
        monthlyData[monthKey].total += parts + work
        
        if (appointment.parts_paid) monthlyData[monthKey].partsPaidCount++
        if (appointment.work_paid) monthlyData[monthKey].workPaidCount++
      })

      // Преобразуем в массив и форматируем
      return Object.entries(monthlyData)
        .sort(([a], [b]) => b.localeCompare(a)) // Сортируем от новых к старым
        .slice(0, 12) // Последние 12 месяцев
        .map(([month, stats]) => {
          const [year, monthNum] = month.split('-')
          const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
          
          return {
            monthKey: month,
            month: `${monthNames[parseInt(monthNum) - 1]} ${year}`,
            count: stats.count,
            parts: Math.round(stats.parts),
            work: Math.round(stats.work),
            total: Math.round(stats.total),
            partsPaidCount: stats.partsPaidCount,
            workPaidCount: stats.workPaidCount,
            partsAllPaid: stats.partsPaidCount === stats.count,
            workAllPaid: stats.workPaidCount === stats.count,
          }
        })
    },
    enabled: !!profile?.sto_company_id,
  })

  const statusColors = {
    scheduled: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-orange-100 text-orange-800',
    ready: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-800',
    pending_deletion: 'bg-red-100 text-red-800',
    deleted: 'bg-gray-200 text-gray-600',
  }

  const statusLabels = {
    scheduled: 'Запланирована',
    in_progress: 'В работе',
    ready: 'Готова',
    completed: 'Завершена',
    archived: 'Архив',
    cancelled: 'Отменена',
    pending_deletion: 'Ожидает удаления',
    deleted: 'Удалена',
  }

  return (
    <div className="container-mobile">
      {/* Заявки работника */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <h1 className="heading-mobile-1">
            {showArchived ? 'Архив заявок' : 'Последние записи'}
            {appointments && appointments.length > 0 && (
              <span className="ml-2 text-lg sm:text-xl md:text-2xl font-normal text-gray-500">({appointments.length})</span>
            )}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
            >
              {showArchived ? (
                <>
                  <List className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Активные</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Архив</span>
                </>
              )}
            </button>
            {!showArchived && (
              <button
                onClick={() => {
                  setEditingAppointment(null)
                  setIsModalOpen(true)
                }}
                className="btn-touch-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Новая</span>
              </button>
            )}
          </div>
        </div>

        {appointmentsLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Desktop таблица */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Дата
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Клиент
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Автомобиль
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Статус
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Сумма
                      </th>
                      {!showArchived && (
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Оплаты
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {appointments?.map((appointment: any) => (
                      <tr 
                        key={appointment.id}
                        onClick={() => navigate(`/sto/appointments/${appointment.id}`)}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="text-gray-500">
                            {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                            {appointment.scheduled_time && ` ${appointment.scheduled_time}`}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{appointment.customers?.name}</div>
                          <div className="text-sm text-gray-500">{appointment.customers?.phone}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {(() => {
                            const brand = appointment.vehicles?.brand || ''
                            const model = appointment.vehicles?.model || ''
                            
                            if (model.toLowerCase() === brand.toLowerCase() || 
                                model.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
                              return model
                            }
                            
                            return `${brand} ${model}`.trim()
                          })()}
                          <div className="text-sm text-gray-500">{appointment.vehicles?.license_plate}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[appointment.status as keyof typeof statusColors]}`}>
                            {statusLabels[appointment.status as keyof typeof statusLabels]}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="text-gray-900">
                            ₴{(appointment.total_cost || appointment.total_parts_cost + appointment.total_work_cost || 0).toFixed(2)}
                          </div>
                        </td>
                        {!showArchived && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Запчасти:</span>
                                {appointment.parts_paid ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-600">Работы:</span>
                                {appointment.work_paid ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile карточки */}
            <div className="md:hidden space-y-3">
              {appointments?.map((appointment: any) => (
                <div
                  key={appointment.id}
                  onClick={() => navigate(`/sto/appointments/${appointment.id}`)}
                  className="card-mobile-hover active:scale-98 transition-transform"
                >
                  {/* Клиент и автомобиль */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-mobile-base mb-1 truncate">
                        {appointment.customers?.name}
                      </h3>
                      <p className="text-mobile-sm text-gray-600 truncate">
                        {(() => {
                          const brand = appointment.vehicles?.brand || ''
                          const model = appointment.vehicles?.model || ''
                          
                          if (model.toLowerCase() === brand.toLowerCase() || 
                              model.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
                            return model
                          }
                          
                          return `${brand} ${model}`.trim()
                        })()}
                        {appointment.vehicles?.license_plate && (
                          <span className="ml-2 text-gray-500">
                            {appointment.vehicles.license_plate}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    {/* Статус */}
                    <span className={`badge-mobile flex-shrink-0 ${statusColors[appointment.status as keyof typeof statusColors]}`}>
                      {statusLabels[appointment.status as keyof typeof statusLabels]}
                    </span>
                  </div>

                  {/* Дополнительная информация */}
                  <div className="flex items-center justify-between text-mobile-sm text-gray-500 mt-2">
                    <span>
                      {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                      {appointment.scheduled_time && ` в ${appointment.scheduled_time}`}
                    </span>
                    
                    {(appointment.total_cost || appointment.total_parts_cost + appointment.total_work_cost) > 0 && (
                      <span className="font-semibold text-primary text-mobile-base">
                        ₴{(appointment.total_cost || appointment.total_parts_cost + appointment.total_work_cost || 0).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* Оплаты (если не архив) */}
                  {!showArchived && (appointment.parts_paid || appointment.work_paid) && (
                    <div className="mt-2 flex gap-2 text-mobile-sm">
                      {appointment.parts_paid && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-3 h-3" />
                          <span>Запчасти</span>
                        </div>
                      )}
                      {appointment.work_paid && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="w-3 h-3" />
                          <span>Работы</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {appointments?.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Заявок нет
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Статистика по месяцам */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Статистика по месяцам</h2>
      </div>

      {/* Таблица статистики */}
      {statsLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : monthlyStats && monthlyStats.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Архивные заявки по месяцам</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Месяц
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Заявок
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Запчасти
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Работы
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Оплаты
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Всего
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyStats.map((stat) => (
                  <tr 
                    key={stat.monthKey} 
                    onClick={() => navigate(`/appointments/month/${stat.monthKey}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                        {stat.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      ₴{stat.parts.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      ₴{stat.work.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Запчасти:</span>
                          {stat.partsAllPaid ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-500">{stat.partsPaidCount}/{stat.count}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Работы:</span>
                          {stat.workAllPaid ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-500">{stat.workPaidCount}/{stat.count}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                      ₴{stat.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    Итого
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-200 text-blue-900">
                      {monthlyStats.reduce((sum, s) => sum + s.count, 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    ₴{monthlyStats.reduce((sum, s) => sum + s.parts, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    ₴{monthlyStats.reduce((sum, s) => sum + s.work, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">Запчасти:</span>
                        <span className="text-xs text-gray-600">
                          {monthlyStats.reduce((sum, s) => sum + s.partsPaidCount, 0)}/{monthlyStats.reduce((sum, s) => sum + s.count, 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">Работы:</span>
                        <span className="text-xs text-gray-600">
                          {monthlyStats.reduce((sum, s) => sum + s.workPaidCount, 0)}/{monthlyStats.reduce((sum, s) => sum + s.count, 0)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-primary">
                    ₴{monthlyStats.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center">Нет данных для отображения статистики</p>
        </div>
      )}

      {/* Модальное окно для создания/редактирования заявки */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingAppointment(null)
        }}
        appointmentId={editingAppointment?.id}
        onSuccess={() => {
          setIsModalOpen(false)
          setEditingAppointment(null)
        }}
      />
    </div>
  )
}
