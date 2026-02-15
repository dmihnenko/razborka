import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, UserCog, List, TrendingUp, Check } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import ReassignWorkerModal from '@/components/appointments/ReassignWorkerModal'
import { useNavigate } from 'react-router-dom'

export default function Appointments() {
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

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

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
    <div className="container-mobile">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h1 className="heading-mobile-1">
          {showArchived ? 'Архив заявок' : 'Записи на обслуживание'}
          {appointments && appointments.length > 0 && (
            <span className="ml-2 text-lg sm:text-xl md:text-2xl font-normal text-gray-500">
              ({appointments.length})
            </span>
          )}
        </h1>
        
        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
          >
            {showArchived ? (
              <>
                <List className="w-4 h-4 flex-shrink-0" />
                <span>Активные</span>
              </>
            ) : (
              <span>Архив</span>
            )}
          </button>
          {isStoOwner && (
            <button
              onClick={() => navigate('/appointments/statistics')}
              className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Статистика</span>
            </button>
          )}
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

      {isLoading ? (
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
                      Клиент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Автомобиль
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Статус
                    </th>
                    {!isStoOwner && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Сумма
                      </th>
                    )}
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
                      {!isStoOwner && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="text-gray-900">
                            ₴{(appointment.total_cost || appointment.total_parts_cost + appointment.total_work_cost || 0).toFixed(2)}
                          </div>
                        </td>
                      )}
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
                {!isStoOwner && (appointment.total_cost || appointment.total_parts_cost + appointment.total_work_cost) > 0 && (
                  <div className="flex items-center justify-end text-mobile-sm text-gray-500 mt-2">
                    <span className="font-semibold text-primary text-mobile-base">
                      ₴{(appointment.total_cost || appointment.total_parts_cost + appointment.total_work_cost || 0).toFixed(2)}
                    </span>
                  </div>
                )}

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
                <p>Нет заявок</p>
              </div>
            )}
          </div>
        </>
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
