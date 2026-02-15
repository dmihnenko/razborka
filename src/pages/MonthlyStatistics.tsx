import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { TrendingUp } from 'lucide-react'

export default function MonthlyStatistics() {
  const { data: profile } = useUserProfile()

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Статистика по всем месяцам
  const { data: monthlyStats, isLoading } = useQuery({
    queryKey: ['monthly-statistics', profile?.sto_company_id, profile?.id, isStoOwner],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('closed_date, parts_cost, total_work_cost')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .not('closed_date', 'is', null)

      // Если работник - фильтруем только по его заявкам
      if (!isStoOwner && profile?.id) {
        query = query.eq('assigned_to', profile.id)
      }

      const { data } = await query.order('closed_date', { ascending: true })

      if (!data || data.length === 0) return []

      // Группируем по месяцам
      const monthlyData: Record<string, { 
        count: number
        parts: number
        work: number
        total: number
      }> = {}

      data.forEach((appointment: any) => {
        const date = new Date(appointment.closed_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { 
            count: 0, 
            parts: 0, 
            work: 0, 
            total: 0
          }
        }

        monthlyData[monthKey].count++
        const parts = appointment.parts_cost || 0
        const work = appointment.total_work_cost || 0
        monthlyData[monthKey].parts += parts
        monthlyData[monthKey].work += work
        monthlyData[monthKey].total += parts + work
      })

      // Преобразуем в массив и форматируем
      return Object.entries(monthlyData)
        .sort(([a], [b]) => b.localeCompare(a)) // Сортируем от новых к старым
        .map(([month, stats]) => {
          const [year, monthNum] = month.split('-')
          const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
          
          return {
            monthKey: month,
            month: `${monthNames[parseInt(monthNum) - 1]} ${year}`,
            count: stats.count,
            parts: Math.round(stats.parts),
            work: Math.round(stats.work),
            total: Math.round(stats.total)
          }
        })
    },
    enabled: !!profile?.sto_company_id || !!profile?.id,
  })

  return (
    <div className="container-mobile">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-primary flex-shrink-0" />
        <h1 className="heading-mobile-1">Статистика по месяцам</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : monthlyStats && monthlyStats.length > 0 ? (
        <>
          {/* Desktop таблица */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                  {monthlyStats.map((stat: any) => (
                    <tr key={stat.monthKey} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stat.month}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        {stat.count}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        ₴{stat.parts.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        ₴{stat.work.toLocaleString('ru-RU')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold text-primary">
                        ₴{stat.total.toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile карточки */}
          <div className="md:hidden space-y-3">
            {monthlyStats.map((stat: any) => (
              <div key={stat.monthKey} className="card-mobile">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">{stat.month}</h3>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {stat.count} {stat.count === 1 ? 'заявка' : stat.count < 5 ? 'заявки' : 'заявок'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-mobile-sm text-gray-600">Запчасти:</span>
                    <span className="text-mobile-base font-semibold text-green-700">
                      ₴{stat.parts.toLocaleString('ru-RU')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-mobile-sm text-gray-600">Работы:</span>
                    <span className="text-mobile-base font-semibold text-purple-700">
                      ₴{stat.work.toLocaleString('ru-RU')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-mobile-base font-medium text-gray-900">Итого:</span>
                    <span className="text-lg font-bold text-primary">
                      ₴{stat.total.toLocaleString('ru-RU')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-mobile-base">
            Нет данных для отображения статистики
          </p>
          <p className="text-gray-400 text-mobile-sm mt-2">
            Закройте первую заявку, чтобы увидеть статистику
          </p>
        </div>
      )}
    </div>
  )
}
