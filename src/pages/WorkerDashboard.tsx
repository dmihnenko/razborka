import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { FileText, Calendar, CheckCircle, Clock } from 'lucide-react'

interface MonthlyStats {
  month: string
  appointments_count: number
}

export default function WorkerDashboard() {
  const { data: currentUser } = useUserProfile()

  // Загрузка записей работника
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['worker_appointments', currentUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(name), vehicles(brand, model, license_plate)')
        .eq('assigned_to', currentUser?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Appointments error:', error)
        return []
      }
      return data
    },
    enabled: !!currentUser?.id
  })

  // Группировка по месяцам
  const monthlyStats: MonthlyStats[] = []
  const monthsMap = new Map<string, MonthlyStats>()

  appointments.forEach(appointment => {
    const date = new Date(appointment.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, {
        month: monthKey,
        appointments_count: 0
      })
    }
    
    const stats = monthsMap.get(monthKey)!
    stats.appointments_count++
  })

  monthsMap.forEach(value => monthlyStats.push(value))
  monthlyStats.sort((a, b) => b.month.localeCompare(a.month))

  const totalAppointments = appointments.length
  const completedAppointments = appointments.filter(a => a.status === 'completed').length
  const inProgressAppointments = appointments.filter(a => a.status === 'in_progress').length
  const pendingAppointments = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  }

  if (appointmentsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Моя статистика</h1>
        <p className="text-sm text-gray-600 mt-1">Добро пожаловать, {currentUser?.full_name || currentUser?.username}</p>
      </div>

      {/* Общая статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего записей</p>
              <p className="text-2xl font-bold text-gray-900">{totalAppointments}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Завершено</p>
              <p className="text-2xl font-bold text-green-600">{completedAppointments}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">В работе</p>
              <p className="text-2xl font-bold text-orange-600">{inProgressAppointments}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ожидают</p>
              <p className="text-2xl font-bold text-purple-600">{pendingAppointments}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Статистика по месяцам */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Calendar className="w-6 h-6 text-primary mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Статистика по месяцам</h2>
          </div>
        </div>

        {monthlyStats.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">У вас пока нет записей</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Месяц
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Количество записей
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyStats.map((stat) => (
                  <tr key={stat.month} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {getMonthName(stat.month)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="text-sm text-gray-900">{stat.appointments_count}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    ИТОГО
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary">
                    {totalAppointments}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Последние записи */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Последние записи</h2>
        </div>
        
        {appointments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">У вас пока нет записей</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Автомобиль</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Описание</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {appointments.slice(0, 10).map((appointment) => {
                  const getStatusBadge = (status: string) => {
                    const badges: Record<string, { text: string; class: string }> = {
                      pending: { text: 'Ожидает', class: 'bg-yellow-100 text-yellow-800' },
                      confirmed: { text: 'Подтверждена', class: 'bg-blue-100 text-blue-800' },
                      in_progress: { text: 'В работе', class: 'bg-orange-100 text-orange-800' },
                      completed: { text: 'Завершена', class: 'bg-green-100 text-green-800' },
                      cancelled: { text: 'Отменена', class: 'bg-red-100 text-red-800' }
                    }
                    return badges[status] || badges.pending
                  }
                  const badge = getStatusBadge(appointment.status)
                  
                  return (
                    <tr key={appointment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(appointment.appointment_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.customers?.name || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {appointment.vehicles ? `${appointment.vehicles.brand} ${appointment.vehicles.model}` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.class}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {appointment.description || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
