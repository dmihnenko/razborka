import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Check } from 'lucide-react'

export default function MonthlyStatistics() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

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

  return (
    <div className="container-mobile">
      <h1 className="heading-mobile-1 mb-4 sm:mb-6">Статистика по месяцам</h1>

      {/* Статистика по месяцам */}
      {!statsLoading && monthlyStats && monthlyStats.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            <h2 className="heading-mobile-3">Архивные заявки по месяцам</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Месяц
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Заявок
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Запчасти
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Работы
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Оплаты
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-base font-medium text-gray-900">
                      {stat.month}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-mobile-sm font-semibold bg-blue-100 text-blue-800">
                        {stat.count}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-sm text-gray-900 text-right font-medium">
                      ₴{stat.parts.toLocaleString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-sm text-gray-900 text-right font-medium">
                      ₴{stat.work.toLocaleString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-sm text-gray-700">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Запчасти:</span>
                          {stat.partsAllPaid ? (
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-500">{stat.partsPaidCount}/{stat.count}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">Работы:</span>
                          {stat.workAllPaid ? (
                            <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-gray-500">{stat.workPaidCount}/{stat.count}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-base text-right font-bold text-gray-900">
                      ₴{stat.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-base font-bold text-gray-900">
                    Итого
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-mobile-sm font-bold bg-blue-200 text-blue-900">
                      {monthlyStats.reduce((sum, s) => sum + s.count, 0)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-sm text-right font-bold text-gray-900">
                    ₴{monthlyStats.reduce((sum, s) => sum + s.parts, 0).toLocaleString()}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-sm text-right font-bold text-gray-900">
                    ₴{monthlyStats.reduce((sum, s) => sum + s.work, 0).toLocaleString()}
                  </td>
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-sm text-gray-700">
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
                  <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-mobile-base text-right font-bold text-primary">
                    ₴{monthlyStats.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : statsLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-mobile-base text-gray-500 text-center">Нет данных для отображения статистики</p>
        </div>
      )}
    </div>
  )
}
