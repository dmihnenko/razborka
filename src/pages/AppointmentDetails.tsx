import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { ArrowLeft, Calendar, User, Car, Phone, FileText, Package, Wrench, DollarSign, Pencil, UserCog } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import ReassignWorkerModal from '@/components/appointments/ReassignWorkerModal'
import { toast } from 'sonner'

export default function AppointmentDetails() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [paymentConfirmModal, setPaymentConfirmModal] = useState<{
    isOpen: boolean
    type: 'parts' | 'work'
    currentValue: boolean
  } | null>(null)
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean
    appointmentId: string
    currentWorkerId: string | null
    customerName: string
    vehicleName: string
  } | null>(null)
  const { data: profile } = useUserProfile()

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
    enabled: !!profile?.sto_company_id && isStoOwner
  })

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          customers(name, phone),
          vehicles(brand, model, license_plate, vin),
          appointment_parts(id, description, quantity, store_cost, client_cost, created_at),
          appointment_services(id, description, cost, created_at),
          created_by_profile:user_profiles!created_by(full_name, email),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)
        `)
        .eq('id', appointmentId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!appointmentId
  })

  // Мутация для обновления статуса оплаты
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ type, value }: { type: 'parts' | 'work', value: boolean }) => {
      const field = type === 'parts' ? 'parts_paid' : 'work_paid'
      const { error } = await supabase
        .from('appointments')
        .update({ [field]: value })
        .eq('id', appointmentId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      toast.success('Статус оплаты обновлен')
    },
    onError: () => {
      toast.error('Ошибка при обновлении статуса оплаты')
    }
  })

  const handlePaymentChange = (type: 'parts' | 'work', currentValue: boolean) => {
    setPaymentConfirmModal({
      isOpen: true,
      type,
      currentValue
    })
  }

  const confirmPaymentChange = () => {
    if (paymentConfirmModal) {
      updatePaymentMutation.mutate({
        type: paymentConfirmModal.type,
        value: !paymentConfirmModal.currentValue
      })
      setPaymentConfirmModal(null)
    }
  }

  const statusColors = {
    scheduled: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-blue-100 text-blue-800',
    ready: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    archived: 'bg-gray-200 text-gray-600'
  }

  const statusLabels = {
    scheduled: 'Запланирована',
    in_progress: 'В работе',
    ready: 'Готова',
    completed: 'Выполнена',
    cancelled: 'Отменена',
    archived: 'Архив'
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Заявка не найдена</h2>
          <button
            onClick={() => navigate('/appointments')}
            className="text-primary hover:underline"
          >
            Вернуться к списку заявок
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Хедер с кнопкой назад */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Назад
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Заявка {appointment.request_number || `#${appointment.id.slice(0, 8)}`}
            </h1>
            <p className="text-gray-500 mt-1">
              Создана {new Date(appointment.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 text-sm font-semibold rounded-full ${statusColors[appointment.status as keyof typeof statusColors]}`}>
              {statusLabels[appointment.status as keyof typeof statusLabels]}
            </span>
            {isStoOwner && workersCount > 1 && (
              <button
                onClick={() => setReassignModal({
                  isOpen: true,
                  appointmentId: appointment.id,
                  currentWorkerId: appointment.assigned_to,
                  customerName: appointment.customers?.name || 'Неизвестно',
                  vehicleName: `${appointment.vehicles?.brand || ''} ${appointment.vehicles?.model || ''}`.trim(),
                })}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-600 hover:border-blue-800 rounded-md transition-colors"
              >
                <UserCog className="w-5 h-5" />
                Переназначить
              </button>
            )}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-md transition-colors"
            >
              <Pencil className="w-5 h-5" />
              Редактировать
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          {/* Клиент и автомобиль */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Информация о клиенте</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <User className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Клиент</p>
                  <p className="text-gray-900 font-medium">{appointment.customers?.name}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Phone className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Телефон</p>
                  <p className="text-gray-900 font-medium">{appointment.customers?.phone}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Car className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Автомобиль</p>
                  <p className="text-gray-900 font-medium">
                    {appointment.vehicles?.brand} {appointment.vehicles?.model}
                  </p>
                  <p className="text-sm text-gray-500">{appointment.vehicles?.license_plate}</p>
                </div>
              </div>
              
              {appointment.vehicles?.vin && (
                <div className="flex items-start">
                  <FileText className="w-5 h-5 text-gray-400 mt-1 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">VIN</p>
                    <p className="text-gray-900 font-mono text-sm">{appointment.vehicles.vin}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Запчасти */}
          {appointment.appointment_parts && appointment.appointment_parts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Запчасти ({appointment.appointment_parts.length})
              </h2>
              <div className="space-y-3">
                {appointment.appointment_parts.map((part: any) => (
                  <div key={part.id} className="flex items-start justify-between border-b border-gray-100 pb-2">
                    <p className="text-gray-900 flex-1">{part.description}</p>
                    {part.store_cost !== null && part.store_cost > 0 && (
                      <span className="text-gray-900 font-medium ml-4">₴{(part.store_cost * (part.quantity || 1)).toFixed(2)}</span>
                    )}
                  </div>
                ))}
                {appointment.appointment_parts.some((p: any) => p.store_cost) && (
                  <div className="pt-2 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Итого запчасти:</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₴{appointment.appointment_parts.reduce((sum: number, p: any) => 
                          sum + ((p.store_cost || 0) * (p.quantity || 1)), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Работы */}
          {appointment.appointment_services && appointment.appointment_services.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Wrench className="w-5 h-5 mr-2" />
                Работы ({appointment.appointment_services.length})
              </h2>
              <div className="space-y-3">
                {appointment.appointment_services.map((service: any) => (
                  <div key={service.id} className="flex items-start justify-between border-b border-gray-100 pb-2">
                    <p className="text-gray-900 flex-1">{service.description}</p>
                    {service.cost !== null && service.cost > 0 && (
                      <span className="text-gray-900 font-medium ml-4">₴{service.cost.toFixed(2)}</span>
                    )}
                  </div>
                ))}
                {appointment.appointment_services.some((s: any) => s.cost) && (
                  <div className="pt-2 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Итого работы:</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₴{appointment.appointment_services.reduce((sum: number, s: any) => 
                          sum + (s.cost || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          {/* Даты и время */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Даты
            </h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Запланирована</p>
                <p className="text-gray-900 font-medium">
                  {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                  {appointment.scheduled_time && ` ${appointment.scheduled_time}`}
                </p>
              </div>
              
              {appointment.completed_at && (
                <div>
                  <p className="text-sm text-gray-500">Выполнена</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(appointment.completed_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Работник */}
          {(appointment.assigned_to_profile || appointment.assigned_to_name) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Wrench className="w-5 h-5 mr-2" />
                Работник
              </h2>
              <p className="text-gray-900 font-medium">
                {appointment.assigned_to_name || appointment.assigned_to_profile?.full_name || appointment.assigned_to_profile?.email}
              </p>
            </div>
          )}

          {/* Финансы */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <DollarSign className="w-6 h-6 mr-2" />
              Оплата
            </h2>
            
            <div className="space-y-3">
              {/* Запчасти */}
              {appointment.appointment_parts && appointment.appointment_parts.length > 0 && (() => {
                const calculatedPartsCost = appointment.appointment_parts.reduce((sum: number, p: any) => 
                  sum + ((p.store_cost || 0) * (p.quantity || 1)), 0);
                const partsCost = appointment.parts_cost || calculatedPartsCost;
                
                return (
                  <div className="pb-3 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <span className="text-base font-semibold text-gray-900">Запчасти</span>
                        {isStoOwner ? (
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={appointment.parts_paid}
                                onChange={() => handlePaymentChange('parts', appointment.parts_paid)}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 border-2 rounded border-gray-300 peer-checked:bg-green-600 peer-checked:border-green-600 transition-all flex items-center justify-center">
                                {appointment.parts_paid && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 group-hover:text-gray-900">Оплачено</span>
                          </label>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded inline-block ${appointment.parts_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {appointment.parts_paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">₴{partsCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Работы */}
              {appointment.appointment_services && appointment.appointment_services.length > 0 && (() => {
                const calculatedServicesCost = appointment.appointment_services.reduce((sum: number, s: any) => 
                  sum + (s.cost || 0), 0);
                const workCost = appointment.total_work_cost || calculatedServicesCost;
                
                return (
                  <div className="pb-3 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <span className="text-base font-semibold text-gray-900">Работы</span>
                        {isStoOwner ? (
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={appointment.work_paid}
                                onChange={() => handlePaymentChange('work', appointment.work_paid)}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 border-2 rounded border-gray-300 peer-checked:bg-green-600 peer-checked:border-green-600 transition-all flex items-center justify-center">
                                {appointment.work_paid && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 group-hover:text-gray-900">Оплачено</span>
                          </label>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded inline-block ${appointment.work_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {appointment.work_paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">₴{workCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Итого */}
              {(() => {
                const calculatedPartsCost = appointment.appointment_parts?.reduce((sum: number, p: any) => 
                  sum + ((p.store_cost || 0) * (p.quantity || 1)), 0) || 0;
                const calculatedServicesCost = appointment.appointment_services?.reduce((sum: number, s: any) => 
                  sum + (s.cost || 0), 0) || 0;
                const totalCost = (appointment.parts_cost || calculatedPartsCost) + (appointment.total_work_cost || calculatedServicesCost);
                
                return totalCost > 0 && (
                  <div className="pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Итого</span>
                      <span className="text-3xl font-bold text-primary">
                        ₴{totalCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Дополнительная информация */}
          {appointment.ready_for_pickup && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">✓ Готово к выдаче</p>
            </div>
          )}
        </div>
      </div>

      {/* Модалки */}
      <AppointmentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        appointmentId={appointment.id}
      />

      {reassignModal && (
        <ReassignWorkerModal
          isOpen={reassignModal.isOpen}
          onClose={() => setReassignModal(null)}
          appointmentId={reassignModal.appointmentId}
          currentWorkerId={reassignModal.currentWorkerId}
          customerName={reassignModal.customerName}
          vehicleName={reassignModal.vehicleName}
        />
      )}

      {/* Модалка подтверждения оплаты */}
      {paymentConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Подтверждение изменения статуса оплаты
            </h3>
            <p className="text-gray-600 mb-6">
              {paymentConfirmModal.currentValue 
                ? `Вы уверены, что хотите отметить ${paymentConfirmModal.type === 'parts' ? 'запчасти' : 'работы'} как неоплаченные?`
                : `Вы уверены, что хотите отметить ${paymentConfirmModal.type === 'parts' ? 'запчасти' : 'работы'} как оплаченные?`
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPaymentConfirmModal(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmPaymentChange}
                disabled={updatePaymentMutation.isPending}
                className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
              >
                {updatePaymentMutation.isPending ? 'Обновление...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
