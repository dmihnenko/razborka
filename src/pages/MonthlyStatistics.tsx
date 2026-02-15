import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, 
  FileText, 
  Package, 
  Wrench, 
  Clock, 
  CheckCircle,
  AlertCircle,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'

export default function MonthlyStatistics() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  // Получаем детальную статистику по заявкам работника
  const { data: appointmentsStats, isLoading: statsLoading } = useQuery({
    queryKey: ['worker-appointments-stats', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, status, parts_cost, total_work_cost, parts_paid, work_paid')
        .eq('assigned_to', profile?.id)
      
      if (error) throw error

      // Подсчитываем статистику
      const active = data?.filter(a => a.status !== 'archived' && a.status !== 'deleted') || []
      const scheduled = data?.filter(a => a.status === 'scheduled') || []
      const inProgress = data?.filter(a => a.status === 'in_progress') || []
      const ready = data?.filter(a => a.status === 'ready') || []
      
      // Неоплаченные
      const unpaid = active.filter(a => {
        const hasParts = (a.parts_cost || 0) > 0
        const hasWork = (a.total_work_cost || 0) > 0
        return (hasParts && !a.parts_paid) || (hasWork && !a.work_paid)
      })

      return {
        total: active.length,
        scheduled: scheduled.length,
        inProgress: inProgress.length,
        ready: ready.length,
        unpaid: unpaid.length
      }
    },
    enabled: !!profile?.id,
  })

  // Получаем статистику текущего месяца (доход работника)
  const { data: monthlyStats, isLoading: monthlyLoading } = useQuery({
    queryKey: ['worker-monthly-revenue', profile?.id],
    queryFn: async () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('appointments')
        .select('parts_cost, total_work_cost')
        .eq('assigned_to', profile?.id)
        .eq('status', 'archived')
        .gte('closed_date', firstDay.toISOString())
        .lte('closed_date', lastDay.toISOString())
      
      if (error) throw error

      const totalParts = data?.reduce((sum, app) => sum + (app.parts_cost || 0), 0) || 0
      const totalWork = data?.reduce((sum, app) => sum + (app.total_work_cost || 0), 0) || 0

      return {
        parts: Math.round(totalParts),
        work: Math.round(totalWork),
        total: Math.round(totalParts + totalWork),
        count: data?.length || 0
      }
    },
    enabled: !!profile?.id,
  })

  // Статистика по всем месяцам для таблицы
  const { data: allMonthsStats, isLoading: allMonthsLoading } = useQuery({
    queryKey: ['worker-all-months-stats', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('closed_date, parts_cost, total_work_cost, parts_paid, work_paid')
        .eq('assigned_to', profile?.id)
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
          }
        })
    },
    enabled: !!profile?.id,
  })

  const activeCount = appointmentsStats?.total || 0
  const scheduledCount = appointmentsStats?.scheduled || 0
  const inProgressCount = appointmentsStats?.inProgress || 0
  const readyCount = appointmentsStats?.ready || 0
  const unpaidCount = appointmentsStats?.unpaid || 0

  const partsCost = monthlyStats?.parts || 0
  const workCost = monthlyStats?.work || 0
  const totalCost = monthlyStats?.total || 0
  const completedCount = monthlyStats?.count || 0

  const isLoading = statsLoading || monthlyLoading

  // Получаем название текущего месяца
  const currentMonth = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div className="container-mobile">
      {/* Header с кнопками */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="heading-mobile-1">Моя статистика</h1>
        
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/appointments')}
            className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Мои записи</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-touch bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <span>Новая запись</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Быстрая статистика по заявкам */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Активные заявки */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">Активные</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{activeCount}</p>
              </div>
            </div>

            {/* Запланированные */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">Ожидают</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{scheduledCount}</p>
              </div>
            </div>

            {/* В работе */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">В работе</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{inProgressCount}</p>
              </div>
            </div>

            {/* Готовые */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">Готовые</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{readyCount}</p>
              </div>
            </div>
          </div>

          {/* Алерт о неоплаченных заявках */}
          {unpaidCount > 0 && (
            <div className="card-mobile bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-mobile-base font-semibold text-red-900 mb-1">
                    Требуют оплаты
                  </p>
                  <p className="text-mobile-sm text-red-700">
                    {unpaidCount} {unpaidCount === 1 ? 'заявка' : unpaidCount < 5 ? 'заявки' : 'заявок'} с неоплаченными услугами
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Статистика текущего месяца */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Выручка за {currentMonth}
              </h2>
              <span className="text-mobile-sm text-gray-600">
                Закрыто: {completedCount}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Сумма запчастей */}
              <div className="p-3 sm:p-4 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-green-100">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <p className="text-mobile-sm text-green-700 font-medium">Запчасти</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-green-900">
                  {partsCost.toLocaleString('ru-RU')} ₴
                </p>
              </div>

              {/* Сумма работ */}
              <div className="p-3 sm:p-4 rounded-lg bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-purple-100">
                    <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <p className="text-mobile-sm text-purple-700 font-medium">Работы</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-purple-900">
                  {workCost.toLocaleString('ru-RU')} ₴
                </p>
              </div>

              {/* Общая сумма */}
              <div className="p-3 sm:p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-blue-100">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <p className="text-mobile-sm text-blue-700 font-medium">Всего</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">
                  {totalCost.toLocaleString('ru-RU')} ₴
                </p>
              </div>
            </div>
          </div>

          {/* Статистика по месяцам */}
          {!allMonthsLoading && allMonthsStats && allMonthsStats.length > 0 && (
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                  История по месяцам
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Месяц
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Заявок
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Запчасти
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Работы
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Итого
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allMonthsStats.map((stat: any) => (
                      <tr key={stat.monthKey} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stat.month}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {stat.count}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          ₴{stat.parts.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          ₴{stat.work.toLocaleString()}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                          ₴{stat.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно для создания новой записи */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
