import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, Calendar, Users, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function Analytics() {
  const { data: profile } = useUserProfile()

  // Статистика по месяцам для закрытых заявок
  const { data: monthlyStats } = useQuery({
    queryKey: ['analytics-monthly-stats', profile?.sto_company_id],
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
        partsPaid: number
        workPaid: number
        totalPaid: number
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
            partsPaid: 0,
            workPaid: 0,
            totalPaid: 0
          }
        }

        monthlyData[monthKey].count++
        const parts = appointment.parts_cost || 0
        const work = appointment.total_work_cost || 0
        monthlyData[monthKey].parts += parts
        monthlyData[monthKey].work += work
        monthlyData[monthKey].total += parts + work

        if (appointment.parts_paid) {
          monthlyData[monthKey].partsPaid += parts
          monthlyData[monthKey].totalPaid += parts
        }
        if (appointment.work_paid) {
          monthlyData[monthKey].workPaid += work
          monthlyData[monthKey].totalPaid += work
        }
      })

      // Преобразуем в массив и форматируем
      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12) // Последние 12 месяцев
        .map(([month, stats]) => {
          const [year, monthNum] = month.split('-')
          const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
          
          return {
            month: `${monthNames[parseInt(monthNum) - 1]} ${year}`,
            count: stats.count,
            parts: Math.round(stats.parts),
            work: Math.round(stats.work),
            total: Math.round(stats.total),
            partsPaid: Math.round(stats.partsPaid),
            workPaid: Math.round(stats.workPaid),
            totalPaid: Math.round(stats.totalPaid),
            unpaid: Math.round(stats.total - stats.totalPaid),
          }
        })
    },
    enabled: !!profile?.sto_company_id,
  })

  // Общая статистика
  const { data: overallStats } = useQuery({
    queryKey: ['analytics-overall-stats', profile?.sto_company_id],
    queryFn: async () => {
      const { data: allAppointments } = await supabase
        .from('appointments')
        .select('status, parts_cost, total_work_cost, parts_paid, work_paid, closed_date, created_at')
        .eq('sto_company_id', profile?.sto_company_id)
        .not('status', 'in', '(pending_deletion,deleted)')

      if (!allAppointments) return null

      const completed = allAppointments.filter(a => a.status === 'archived')
      const inProgress = allAppointments.filter(a => a.status === 'in_progress')
      const scheduled = allAppointments.filter(a => a.status === 'scheduled')
      const cancelled = allAppointments.filter(a => a.status === 'cancelled')

      const totalRevenue = completed.reduce((sum, a) => sum + (a.parts_cost || 0) + (a.total_work_cost || 0), 0)
      const paidRevenue = completed.reduce((sum, a) => {
        let paid = 0
        if (a.parts_paid) paid += (a.parts_cost || 0)
        if (a.work_paid) paid += (a.total_work_cost || 0)
        return sum + paid
      }, 0)

      // Средний чек
      const avgCheck = completed.length > 0 ? totalRevenue / completed.length : 0

      // Среднее время выполнения
      const completedWithDates = completed.filter(a => a.closed_date && a.created_at)
      const avgDays = completedWithDates.length > 0
        ? completedWithDates.reduce((sum, a) => {
            const created = new Date(a.created_at).getTime()
            const closed = new Date(a.closed_date!).getTime()
            return sum + (closed - created) / (1000 * 60 * 60 * 24)
          }, 0) / completedWithDates.length
        : 0

      return {
        total: allAppointments.length,
        completed: completed.length,
        inProgress: inProgress.length,
        scheduled: scheduled.length,
        cancelled: cancelled.length,
        totalRevenue: Math.round(totalRevenue),
        paidRevenue: Math.round(paidRevenue),
        unpaidRevenue: Math.round(totalRevenue - paidRevenue),
        avgCheck: Math.round(avgCheck),
        avgDays: Math.round(avgDays * 10) / 10,
      }
    },
    enabled: !!profile?.sto_company_id,
  })

  // Данные для круговой диаграммы статусов
  const statusData = overallStats ? [
    { name: 'Завершено', value: overallStats.completed, color: '#10b981' },
    { name: 'В работе', value: overallStats.inProgress, color: '#3b82f6' },
    { name: 'Запланировано', value: overallStats.scheduled, color: '#f59e0b' },
    { name: 'Отменено', value: overallStats.cancelled, color: '#ef4444' },
  ].filter(item => item.value > 0) : []

  // Данные для круговой диаграммы оплат
  const paymentData = overallStats ? [
    { name: 'Оплачено', value: overallStats.paidRevenue, color: '#10b981' },
    { name: 'Не оплачено', value: overallStats.unpaidRevenue, color: '#ef4444' },
  ].filter(item => item.value > 0) : []

  const statCards = [
    { name: 'Всего заявок', value: overallStats?.total || 0, icon: Calendar, color: 'bg-blue-500' },
    { name: 'Завершено', value: overallStats?.completed || 0, icon: CheckCircle, color: 'bg-green-500' },
    { name: 'В работе', value: overallStats?.inProgress || 0, icon: Clock, color: 'bg-orange-500' },
    { name: 'Отменено', value: overallStats?.cancelled || 0, icon: XCircle, color: 'bg-red-500' },
  ]

  const revenueCards = [
    { name: 'Общий доход', value: `₴${overallStats?.totalRevenue || 0}`, icon: DollarSign, color: 'bg-blue-500' },
    { name: 'Оплачено', value: `₴${overallStats?.paidRevenue || 0}`, icon: CheckCircle, color: 'bg-green-500' },
    { name: 'К оплате', value: `₴${overallStats?.unpaidRevenue || 0}`, icon: Clock, color: 'bg-orange-500' },
    { name: 'Средний чек', value: `₴${overallStats?.avgCheck || 0}`, icon: TrendingUp, color: 'bg-purple-500' },
  ]

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Аналитика</h1>

      {/* Статистика заявок */}
      <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Финансовая статистика */}
      <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        {revenueCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Дополнительные метрики */}
      {overallStats && (
        <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-2">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Среднее время выполнения</h3>
            </div>
            <p className="text-4xl font-bold text-blue-600">{overallStats.avgDays} дней</p>
            <p className="text-sm text-gray-600 mt-2">от создания до закрытия заявки</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-2">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Процент оплаты</h3>
            </div>
            <p className="text-4xl font-bold text-green-600">
              {overallStats.totalRevenue > 0 
                ? Math.round((overallStats.paidRevenue / overallStats.totalRevenue) * 100)
                : 0}%
            </p>
            <p className="text-sm text-gray-600 mt-2">от общего дохода оплачено</p>
          </div>
        </div>
      )}

      {/* Круговые диаграммы */}
      {(statusData.length > 0 || paymentData.length > 0) && (
        <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-2">
          {/* Распределение по статусам */}
          {statusData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Распределение заявок по статусам</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Распределение по оплатам */}
          {paymentData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Статус оплаты</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ₴${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₴${value}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Графики по месяцам */}
      {monthlyStats && monthlyStats.length > 0 && (
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* График количества заявок */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Динамика закрытых заявок</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Заявок закрыто" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* График доходов */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Динамика доходов по месяцам</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                <YAxis />
                <Tooltip formatter={(value) => `₴${value}`} />
                <Legend />
                <Line type="monotone" dataKey="parts" stroke="#f59e0b" strokeWidth={2} name="Запчасти" />
                <Line type="monotone" dataKey="work" stroke="#10b981" strokeWidth={2} name="Работы" />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} name="Всего" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* График оплат */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Оплата vs Начислено</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" style={{ fontSize: '12px' }} />
                <YAxis />
                <Tooltip formatter={(value) => `₴${value}`} />
                <Legend />
                <Bar dataKey="total" fill="#3b82f6" name="Начислено" />
                <Bar dataKey="totalPaid" fill="#10b981" name="Оплачено" />
                <Bar dataKey="unpaid" fill="#ef4444" name="К оплате" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(!monthlyStats || monthlyStats.length === 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center">Недостаточно данных для отображения графиков. Закройте несколько заявок для получения статистики.</p>
        </div>
      )}
    </div>
  )
}
