import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Car, Calendar, Receipt } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import MyVehicles from './MyVehicles'

export default function Dashboard() {
  const { data: profile } = useUserProfile()
  
  // Проверяем активную роль для админа или primary роль
  const primaryRole = profile?.roles?.find((role: any) => role.is_primary)
  let activeRole = primaryRole?.name
  
  if (primaryRole?.name === 'admin') {
    activeRole = localStorage.getItem('activeRole') || 'user'
  }
  
  // Всегда вызываем все хуки перед условным возвратом
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', profile?.sto_company_id],
    queryFn: async () => {
      const stoCompanyId = profile?.sto_company_id
      
      const [customers, vehicles, appointments, invoices] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('sto_company_id', stoCompanyId),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('sto_company_id', stoCompanyId),
        supabase.from('appointments').select('id, status', { count: 'exact', head: false }).eq('sto_company_id', stoCompanyId),
        supabase.from('invoices').select('id, total_amount'),
      ])

      const totalRevenue = invoices.data?.reduce((sum, inv) => sum + inv.total_amount, 0) || 0
      const appointmentsInProgress = appointments.data?.filter(a => a.status === 'in_progress' || a.status === 'confirmed').length || 0

      return {
        customers: customers.count || 0,
        vehicles: vehicles.count || 0,
        appointments: appointments.count || 0,
        appointmentsInProgress,
        revenue: totalRevenue,
      }
    },
    enabled: activeRole !== 'user' && !!profile?.sto_company_id,
  })

  const { data: recentAppointments } = useQuery({
    queryKey: ['recent-appointments', profile?.sto_company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          customers(name),
          vehicles(brand, model, license_plate),
          assigned_to_profile:user_profiles!assigned_to(full_name)
        `)
        .eq('sto_company_id', profile?.sto_company_id)
        .order('scheduled_date', { ascending: false })
        .limit(5)

      return data || []
    },
    enabled: activeRole !== 'user' && !!profile?.sto_company_id,
  })
  
  // Если активная роль user, показываем страницу "Мои автомобили"
  if (activeRole === 'user') {
    return <MyVehicles />
  }

  const statCards = [
    { name: 'Клиенты', value: stats?.customers || 0, icon: Users, color: 'bg-blue-500' },
    { name: 'Автомобили', value: stats?.vehicles || 0, icon: Car, color: 'bg-green-500' },
    { name: 'Заявки в работе', value: stats?.appointmentsInProgress || 0, icon: Calendar, color: 'bg-orange-500' },
    { name: 'Всего заявок', value: stats?.appointments || 0, icon: Calendar, color: 'bg-yellow-500' },
  ]

  return (
    <div>
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Панель управления</h1>

      {/* Stats Grid */}
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

      {/* Recent Appointments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Последние записи</h2>
        </div>
        <div className="p-6">
          {recentAppointments && recentAppointments.length > 0 ? (
            <div className="space-y-4">
              {recentAppointments.map((appointment: any) => (
                <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{appointment.customers?.name}</p>
                    <p className="text-sm text-gray-600">
                      {appointment.vehicles?.brand} {appointment.vehicles?.model} ({appointment.vehicles?.license_plate})
                    </p>
                    {appointment.assigned_to_profile && (
                      <p className="text-xs text-blue-600 mt-1">
                        Назначено: {appointment.assigned_to_profile.full_name || appointment.assigned_to_profile.email}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                    </p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                      appointment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      appointment.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
                      appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {appointment.status === 'completed' ? 'Завершено' :
                       appointment.status === 'in_progress' ? 'В работе' :
                       appointment.status === 'confirmed' ? 'Подтверждена' :
                       appointment.status === 'pending' ? 'Ожидает' :
                       'Отменено'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Записей пока нет</p>
          )}
        </div>
      </div>
    </div>
  )
}
