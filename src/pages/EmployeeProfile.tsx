import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, FileText, CheckCircle, Clock, Calendar } from 'lucide-react'

interface Appointment {
  id: string
  created_at: string
  appointment_date: string
  status: string
  description: string | null
  customer_id: string
  vehicle_id: string
  customers: { name: string }
  vehicles: { brand: string; model: string; license_plate: string }
}

export default function EmployeeProfile() {
  const { employeeId } = useParams()

  // Загрузка данных работника
  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', employeeId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!employeeId
  })

  // Загрузка записей работника
  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['employee_appointments', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(name), vehicles(brand, model, license_plate)')
        .eq('assigned_to', employeeId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Appointments error:', error)
        return []
      }
      return data as Appointment[]
    },
    enabled: !!employeeId
  })

  const inProgressAppointments = appointments.filter(a => a.status === 'in_progress')
  const completedAppointments = appointments.filter(a => a.status === 'completed')
  const pendingAppointments = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed')

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

  if (employeeLoading || appointmentsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Работник не найден</p>
        <Link to="/sto/employees" className="text-primary hover:underline mt-4 inline-block">
          Вернуться к списку
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            to="/sto/employees"
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {employee.full_name || employee.username}
            </h1>
            <p className="text-sm text-gray-600 mt-1">Работник СТО</p>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Всего записей</p>
              <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">В работе</p>
              <p className="text-2xl font-bold text-orange-600">{inProgressAppointments.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Завершено</p>
              <p className="text-2xl font-bold text-green-600">{completedAppointments.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ожидают</p>
              <p className="text-2xl font-bold text-purple-600">{pendingAppointments.length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Записи */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Записи</h2>
        </div>
        
        {appointments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">У работника пока нет записей</p>
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
                {appointments.map((appointment) => {
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
                        {appointment.vehicles ? `${appointment.vehicles.brand} ${appointment.vehicles.model} (${appointment.vehicles.license_plate})` : '—'}
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
