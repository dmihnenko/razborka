import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { Plus, Archive, List, TrendingUp, Check, History } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import ReassignWorkerModal from '@/components/appointments/ReassignWorkerModal'
import { useNavigate } from 'react-router-dom'
import MyVehicles from './MyVehicles'
import MonthlyStatistics from './MonthlyStatistics'

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean
    appointmentId: string
    currentWorkerId: string | null
    customerName: string
    vehicleName: string
  } | null>(null)
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  // Проверяем активную роль для админа или primary роль
  const primaryRole = profile?.roles?.find((role: any) => role.is_primary)
  let activeRole = primaryRole?.name
  
  if (primaryRole?.name === 'admin') {
    activeRole = localStorage.getItem('activeRole') || 'user'
  }
  
  // Если активная роль user, показываем страницу "Мои автомобили"
  if (activeRole === 'user') {
    return <MyVehicles />
  }

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Если работник, показываем статистику
  if (!isStoOwner) {
    return <MonthlyStatistics />
  }

  // Получаем количество работников СТО
  const { data: workersCount = 0 } = useQuery({
    queryKey: ['sto_workers_count', profile?.sto_company_id],
    queryFn: async () => {
      const { data: workerRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (!workerRole) return 0

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', workerRole.id)

      if (!userRoles) return 0

      const { count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('is_active', true)
        .in('id', userRoles.map(ur => ur.user_id))

      return count || 0
    },
    enabled: !!profile?.sto_company_id && isStoOwner,
  })

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', profile?.id, showArchived],
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Запись удалена')
    },
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {showArchived ? 'Архив заявок' : 'Записи на обслуживание'}
          {appointments && appointments.length > 0 && (
            <span className="ml-3 text-2xl font-normal text-gray-500">({appointments.length})</span>
          )}
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showArchived ? (
              <>
                <List className="w-5 h-5 mr-2" />
                Активные заявки
              </>
            ) : (
              <>
                <Archive className="w-5 h-5 mr-2" />
                Архив
              </>
            )}
          </button>
          {isStoOwner && (
            <>
              <button
                onClick={() => navigate('/appointments/statistics')}
                className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Статистика
              </button>
              <button
                onClick={() => navigate('/history')}
                className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <History className="w-5 h-5 mr-2" />
                История
              </button>
            </>
          )}
          {!showArchived && (
            <button
              onClick={() => {
                setEditingAppointment(null)
                setIsModalOpen(true)
              }}
              className="flex items-center px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90"
            >
              <Plus className="w-5 h-5 mr-2" />
              Новая запись
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Номер / Дата
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Автомобиль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                {(!isStoOwner || workersCount > 1) && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {isStoOwner ? 'Назначено' : 'Сумма'}
                  </th>
                )}
                {!showArchived && (
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {appointment.request_number && (
                      <div className="text-gray-900 font-medium">{appointment.request_number}</div>
                    )}
                    <div className="text-gray-500">
                      {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                      {appointment.scheduled_time && ` ${appointment.scheduled_time}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{appointment.customers?.name}</div>
                    <div className="text-sm text-gray-500">{appointment.customers?.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(() => {
                      const brand = appointment.vehicles?.brand || ''
                      const model = appointment.vehicles?.model || ''
                      
                      // Если модель равна бренду или модель начинается с бренда, показываем только модель
                      if (model.toLowerCase() === brand.toLowerCase() || 
                          model.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
                        return model
                      }
                      
                      // Иначе показываем бренд + модель
                      return `${brand} ${model}`.trim()
                    })()}
                    <div className="text-sm text-gray-500">{appointment.vehicles?.license_plate}</div>
                    {appointment.vehicles?.vin && (
                      <div 
                        className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer mt-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(appointment.vehicles.vin)
                          toast.success('VIN скопирован', { duration: 500 })
                        }}
                        title="Нажмите чтобы скопировать"
                      >
                        {appointment.vehicles.vin}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[appointment.status as keyof typeof statusColors]}`}>
                      {statusLabels[appointment.status as keyof typeof statusLabels]}
                    </span>
                  </td>
                  {(!isStoOwner || workersCount > 1) && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isStoOwner ? (
                        appointment.assigned_to_profile || appointment.assigned_to_name ? (
                          <div>
                            <div className="text-gray-900 font-medium">
                              {appointment.assigned_to_name || appointment.assigned_to_profile?.full_name || appointment.assigned_to_profile?.email}
                            </div>
                            <div className="text-xs text-gray-500">Работник</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Не назначено</span>
                        )
                      ) : (
                        <div className="text-gray-900">
                          ₴{((appointment.total_work_cost || 0) + (appointment.total_parts_cost || 0)).toFixed(2)}
                        </div>
                      )}
                    </td>
                  )}
                  {!showArchived && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
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
      )}

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

      {reassignModal && (
        <ReassignWorkerModal
          isOpen={reassignModal.isOpen}
          onClose={() => setReassignModal(null)}
          appointmentId={reassignModal.appointmentId}
          currentWorkerId={reassignModal.currentWorkerId}
          appointmentInfo={{
            customerName: reassignModal.customerName,
            vehicleName: reassignModal.vehicleName,
          }}
        />
      )}
    </div>
  )
}
