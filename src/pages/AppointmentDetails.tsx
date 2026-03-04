import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { ArrowLeft, Calendar, User, Car, Phone, FileText, Package, Wrench, DollarSign, UserCog } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import ReassignWorkerModal from '@/components/appointments/ReassignWorkerModal'
import { toast } from 'sonner'

export default function AppointmentDetails() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [paymentConfirmModal, setPaymentConfirmModal] = useState<{
    isOpen: boolean
    type: 'parts' | 'work'
    currentValue: boolean
  } | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
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
      
      // Получаем текущие данные заявки
      const { data: current } = await supabase
        .from('appointments')
        .select('parts_paid, work_paid, parts_cost, total_parts_cost, total_work_cost, status')
        .eq('id', appointmentId)
        .single()
      
      if (!current) throw new Error('Appointment not found')
      
      // Обновляем поле оплаты
      const updatedData: any = { [field]: value }
      
      // Проверяем, должны ли мы архивировать заявку
      const hasParts = ((current.parts_cost || current.total_parts_cost) || 0) > 0
      const hasWork = (current.total_work_cost || 0) > 0
      
      const willBePartsPaid = type === 'parts' ? value : current.parts_paid
      const willBeWorkPaid = type === 'work' ? value : current.work_paid
      
      const shouldArchive = 
        (current.status === 'completed' || current.status === 'ready') &&
        (!hasParts || willBePartsPaid) &&
        (!hasWork || willBeWorkPaid)
      
      if (shouldArchive) {
        updatedData.status = 'archived'
        updatedData.closed_date = new Date().toISOString()
        // Если запчастей/работ нет — авто-отмечаем как оплачено
        if (!hasParts) updatedData.parts_paid = true
        if (!hasWork) updatedData.work_paid = true
      }
      
      const { error } = await supabase
        .from('appointments')
        .update(updatedData)
        .eq('id', appointmentId)
      
      if (error) throw error
      
      return { archived: shouldArchive }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      
      if (result.archived) {
        toast.success('Оплата подтверждена. Заявка отправлена в архив')
      } else {
        toast.success('Статус оплаты обновлен')
      }
    },
    onError: () => {
      toast.error('Ошибка при обновлении статуса оплаты')
    }
  })

  // Мутация для обновления статуса заявки
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const isUnarchiving = appointment?.status === 'archived'
      const isArchiving = status === 'archived'
      const updateData: any = { status }
      // При возврате из архива — сбрасываем дату закрытия и оплаты
      if (isUnarchiving) {
        updateData.closed_date = null
        updateData.parts_paid = false
        updateData.work_paid = false
      }
      // При архивировании вручную — авто-оплачиваем то, чего нет
      if (isArchiving) {
        const hasParts = ((appointment?.parts_cost || appointment?.total_parts_cost) || 0) > 0
        const hasWork = (appointment?.total_work_cost || 0) > 0
        updateData.closed_date = new Date().toISOString()
        if (!hasParts) updateData.parts_paid = true
        if (!hasWork) updateData.work_paid = true
      }
      const { data, error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .select()
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success('Статус заявки обновлен')
      setShowStatusDropdown(false)
    },
    onError: (error: any) => {
      console.error('Update status error:', error)
      toast.error(`Ошибка при обновлении статуса: ${error.message || 'Неизвестная ошибка'}`)
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

  // Мутация для exclude_from_stats
  const updateExcludeFromStatsMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase
        .from('appointments')
        .update({ exclude_from_stats: value })
        .eq('id', appointmentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success(appointment?.exclude_from_stats ? 'Включена в статистику' : 'Исключена из статистики')
    },
    onError: () => {
      toast.error('Ошибка при обновлении')
    }
  })

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'archived') {
      setShowStatusDropdown(false)
      setShowArchiveConfirm(true)
      return
    }
    updateStatusMutation.mutate(newStatus)
  }

  const availableStatuses = appointment?.status === 'archived'
    ? (isStoOwner ? [
        { value: 'in_progress', label: 'В работе' },
        { value: 'completed', label: 'Готова' },
      ] : [])
    : appointment?.status === 'pending_deletion'
    ? (isStoOwner ? [
        { value: 'in_progress', label: 'Отклонить удаление' },
      ] : [])
    : [
        { value: 'scheduled', label: 'Запланирована' },
        { value: 'in_progress', label: 'В работе' },
        { value: 'completed', label: 'Готова' },
        ...(!isStoOwner ? [{ value: 'pending_deletion', label: 'Запрос на удаление' }] : []),
        ...(isStoOwner ? [{ value: 'archived', label: 'В архив' }] : []),
      ]

  const statusColors = {
    scheduled: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    archived: 'bg-gray-200 text-gray-600',
    pending_deletion: 'bg-red-200 text-red-900',
  }

  const statusLabels = {
    scheduled: 'Запланирована',
    in_progress: 'В работе',
    completed: 'Готова',
    cancelled: 'Отменена',
    archived: 'Архив',
    pending_deletion: 'Запрос на удаление',
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
      <div className="p-4 sm:p-6 lg:p-8">
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Хедер с кнопкой назад */}
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => location.state?.from ? navigate(location.state.from) : navigate(-1)}
          className="flex items-center text-mobile-base text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Назад
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-mobile-1">Заявка</h1>
            <p className="text-mobile-sm text-gray-500 mt-1">
              Создана {new Date(appointment.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Статус с выпадающим списком */}
            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                disabled={(appointment.status === 'archived' && !isStoOwner) || (appointment.status === 'pending_deletion' && !isStoOwner)}
                className={`px-4 py-2 text-sm font-semibold rounded ${statusColors[appointment.status as keyof typeof statusColors]} ${((appointment.status !== 'archived' && appointment.status !== 'pending_deletion') || isStoOwner) ? 'hover:opacity-80 transition-opacity cursor-pointer' : 'cursor-default'}`}
              >
                {statusLabels[appointment.status as keyof typeof statusLabels]}
              </button>
              {showStatusDropdown && availableStatuses.length > 0 && (
                <div className="absolute right-0 z-10 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200">
                  {availableStatuses.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => handleStatusChange(status.value)}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Кнопка переназначения */}
            {isStoOwner && workersCount > 1 && (
              <button
                onClick={() => setReassignModal({
                  isOpen: true,
                  appointmentId: appointment.id,
                  currentWorkerId: appointment.assigned_to,
                  customerName: appointment.customers?.name || 'Неизвестно',
                  vehicleName: `${appointment.vehicles?.brand || ''} ${appointment.vehicles?.model || ''}`.trim(),
                })}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded ${statusColors[appointment.status as keyof typeof statusColors]} hover:opacity-80 transition-opacity"
              >
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="hidden sm:inline">Переназначить</span>
              </button>
            )}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className={`px-4 py-2 text-sm font-semibold rounded ${statusColors[appointment.status as keyof typeof statusColors]} hover:opacity-80 transition-opacity`}
            >
              Изменить
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Клиент и автомобиль */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="heading-mobile-2 mb-4">Информация о клиенте</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-1 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <p className="text-mobile-sm text-gray-500">Клиент</p>
                  <p className="text-mobile-base text-gray-900 font-medium">{appointment.customers?.name}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-1 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <p className="text-mobile-sm text-gray-500">Телефон</p>
                  <p className="text-mobile-base text-gray-900 font-medium">{appointment.customers?.phone}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Car className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-1 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <p className="text-mobile-sm text-gray-500">Автомобиль</p>
                  <p className="text-mobile-base text-gray-900 font-medium">
                    {appointment.vehicles?.brand} {appointment.vehicles?.model}
                  </p>

                </div>
              </div>
              
              {appointment.vehicles?.vin && (
                <div className="flex items-start">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-1 mr-2 sm:mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-mobile-sm text-gray-500">VIN</p>
                    <p 
                      className="text-mobile-sm text-gray-900 font-mono cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(appointment.vehicles.vin)
                        toast.success('VIN скопирован', { duration: 500 })
                      }}
                      title="Нажмите, чтобы скопировать"
                    >
                      {appointment.vehicles.vin}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Запчасти */}
          {(() => {
            const hasOldParts = appointment.appointment_parts && appointment.appointment_parts.length > 0
            const hasNewParts = appointment.part_items && appointment.part_items.length > 0
            const hasCost = (appointment.parts_cost || appointment.total_parts_cost) && (appointment.parts_cost || appointment.total_parts_cost) > 0
            const partsCost = appointment.parts_cost || appointment.total_parts_cost || 0
            
            if (!hasOldParts && !hasNewParts && !hasCost) return null
            
            return (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="heading-mobile-2 mb-4 flex items-center">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                  Запчасти {(hasOldParts || hasNewParts) && `(${(appointment.appointment_parts?.length || 0) + (appointment.part_items?.length || 0)})`}
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  {/* Старый формат - appointment_parts */}
                  {hasOldParts && appointment.appointment_parts.map((part: any) => (
                    <div key={part.id} className="flex items-start justify-between border-b border-gray-100 pb-2">
                      <p className="text-mobile-base text-black flex-1">{part.description}</p>
                      {part.store_cost !== null && part.store_cost > 0 && (
                        <span className="text-mobile-base text-black font-medium ml-4">₴{(part.store_cost * (part.quantity || 1)).toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                  
                  {/* Новый формат - part_items */}
                  {hasNewParts && appointment.part_items.map((part: any, index: number) => (
                    <div key={`part-${index}`} className="flex items-start justify-between border-b border-gray-100 pb-2">
                      <div className="flex-1">
                        <p className="text-mobile-base text-black">{part.name}</p>
                        {part.quantity > 1 && (
                          <p className="text-mobile-sm text-gray-500">Количество: {part.quantity}</p>
                        )}
                      </div>
                      <span className="text-mobile-base text-black font-medium ml-4">₴{part.totalPrice.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  {!hasOldParts && !hasNewParts && hasCost && (
                    <p className="text-mobile-sm text-gray-500 italic">Детали не указаны</p>
                  )}
                  
                  {hasCost && (
                    <div className="pt-2 border-t-2 border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-mobile-base font-semibold text-black">Итого запчасти:</span>
                        <span className="text-mobile-lg font-bold text-black">
                          ₴{partsCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Работы */}
          {(() => {
            const hasOldServices = appointment.appointment_services && appointment.appointment_services.length > 0
            const hasNewServices = appointment.work_items && appointment.work_items.length > 0
            const hasCost = appointment.total_work_cost && appointment.total_work_cost > 0
            
            if (!hasOldServices && !hasNewServices && !hasCost) return null
            
            return (
              <div className="bg-white rounded-lg shadow p-4 sm:p-6">
                <h2 className="heading-mobile-2 mb-4 flex items-center">
                  <Wrench className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                  Работы {(hasOldServices || hasNewServices) && `(${(appointment.appointment_services?.length || 0) + (appointment.work_items?.length || 0)})`}
                </h2>
                <div className="space-y-2 sm:space-y-3">
                  {/* Старый формат - appointment_services */}
                  {hasOldServices && appointment.appointment_services.map((service: any) => (
                    <div key={service.id} className="flex items-start justify-between border-b border-gray-100 pb-2">
                      <p className="text-mobile-base text-black flex-1">{service.description}</p>
                      {service.cost !== null && service.cost > 0 && (
                        <span className="text-mobile-base text-black font-medium ml-4">₴{service.cost.toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                  
                  {/* Новый формат - work_items */}
                  {hasNewServices && appointment.work_items.map((work: any, index: number) => (
                    <div key={`work-${index}`} className="flex items-start justify-between border-b border-gray-100 pb-2">
                      <p className="text-mobile-base text-black flex-1">{work.name}</p>
                      <span className="text-mobile-base text-black font-medium ml-4">₴{work.price.toFixed(2)}</span>
                    </div>
                  ))}
                  
                  {!hasOldServices && !hasNewServices && hasCost && (
                    <p className="text-mobile-sm text-gray-500 italic">Детали не указаны</p>
                  )}
                  
                  {hasCost && (
                    <div className="pt-2 border-t-2 border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-mobile-base font-semibold text-black">Итого работы:</span>
                        <span className="text-mobile-lg font-bold text-black">
                          ₴{appointment.total_work_cost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Боковая панель */}
        <div className="space-y-4 sm:space-y-6">
          {/* Даты и время */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="heading-mobile-3 mb-4 flex items-center">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              Даты
            </h2>
            
            <div className="space-y-3">
              <div>
                <p className="text-mobile-sm text-gray-500">Запланирована</p>
                <p className="text-mobile-base text-gray-900 font-medium">
                  {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                  {appointment.scheduled_time && ` ${appointment.scheduled_time}`}
                </p>
              </div>
              
              {appointment.completed_at && (
                <div>
                  <p className="text-mobile-sm text-gray-500">Выполнена</p>
                  <p className="text-mobile-base text-gray-900 font-medium">
                    {new Date(appointment.completed_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Работник */}
          {isStoOwner && workersCount > 1 && (appointment.assigned_to_profile || appointment.assigned_to_name) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="heading-mobile-3 mb-4 flex items-center">
                <Wrench className="w-5 h-5 mr-2" />
                Работник
              </h2>
              <p className="text-mobile-base text-gray-900 font-medium">
                {appointment.assigned_to_name || appointment.assigned_to_profile?.full_name || appointment.assigned_to_profile?.email}
              </p>
            </div>
          )}

          {/* Финансы */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="heading-mobile-2 mb-4 sm:mb-6 flex items-center">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 mr-2 flex-shrink-0" />
              Оплата
            </h2>
            
            <div className="space-y-3">
              {/* Запчасти */}
              {(() => {
                // Старый формат
                const hasOldParts = appointment.appointment_parts && appointment.appointment_parts.length > 0
                const calculatedOldPartsCost = hasOldParts 
                  ? appointment.appointment_parts.reduce((sum: number, p: any) => sum + ((p.store_cost || 0) * (p.quantity || 1)), 0)
                  : 0
                
                // Новый формат
                const hasNewParts = appointment.part_items && appointment.part_items.length > 0
                const calculatedNewPartsCost = hasNewParts
                  ? appointment.part_items.reduce((sum: number, p: any) => sum + (p.totalPrice || 0), 0)
                  : 0
                
                const partsCost = appointment.parts_cost || appointment.total_parts_cost || calculatedOldPartsCost || calculatedNewPartsCost
                
                if (!hasOldParts && !hasNewParts && partsCost === 0) return null
                
                return (
                  <div className="pb-3 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <span className="text-mobile-base font-semibold text-black">Запчасти</span>
                        {isStoOwner ? (
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={appointment.parts_paid}
                                onChange={() => handlePaymentChange('parts', appointment.parts_paid)}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 border-2 rounded border-gray-300 peer-checked:bg-green-700 peer-checked:border-green-600 transition-all flex items-center justify-center">
                                {appointment.parts_paid && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-mobile-sm text-gray-600 group-hover:text-gray-900">Оплачено</span>
                          </label>
                        ) : (
                          <span className={`text-mobile-sm px-2 py-1 rounded inline-block ${appointment.parts_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {appointment.parts_paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-mobile-lg font-bold text-black">₴{partsCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Работы */}
              {(() => {
                // Старый формат
                const hasOldServices = appointment.appointment_services && appointment.appointment_services.length > 0
                const calculatedOldServicesCost = hasOldServices
                  ? appointment.appointment_services.reduce((sum: number, s: any) => sum + (s.cost || 0), 0)
                  : 0
                
                // Новый формат
                const hasNewServices = appointment.work_items && appointment.work_items.length > 0
                const calculatedNewServicesCost = hasNewServices
                  ? appointment.work_items.reduce((sum: number, w: any) => sum + (w.price || 0), 0)
                  : 0
                
                const workCost = appointment.total_work_cost || calculatedOldServicesCost || calculatedNewServicesCost
                
                if (!hasOldServices && !hasNewServices && workCost === 0) return null
                
                return (
                  <div className="pb-3 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <span className="text-mobile-base font-semibold text-black">Работы</span>
                        {isStoOwner ? (
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={appointment.work_paid}
                                onChange={() => handlePaymentChange('work', appointment.work_paid)}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 border-2 rounded border-gray-300 peer-checked:bg-green-700 peer-checked:border-green-600 transition-all flex items-center justify-center">
                                {appointment.work_paid && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-mobile-sm text-gray-600 group-hover:text-gray-900">Оплачено</span>
                          </label>
                        ) : (
                          <span className={`text-mobile-sm px-2 py-1 rounded inline-block ${appointment.work_paid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {appointment.work_paid ? 'Оплачено' : 'Не оплачено'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-mobile-lg font-bold text-black">₴{workCost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Итого */}
              {(() => {
                // Считаем общую сумму из всех возможных источников
                const oldPartsCost = appointment.appointment_parts?.reduce((sum: number, p: any) => 
                  sum + ((p.store_cost || 0) * (p.quantity || 1)), 0) || 0
                const newPartsCost = appointment.part_items?.reduce((sum: number, p: any) => 
                  sum + (p.totalPrice || 0), 0) || 0
                const oldServicesCost = appointment.appointment_services?.reduce((sum: number, s: any) => 
                  sum + (s.cost || 0), 0) || 0
                const newServicesCost = appointment.work_items?.reduce((sum: number, w: any) => 
                  sum + (w.price || 0), 0) || 0
                
                const totalParts = appointment.parts_cost || appointment.total_parts_cost || oldPartsCost || newPartsCost
                const totalWork = appointment.total_work_cost || oldServicesCost || newServicesCost
                const totalCost = totalParts + totalWork
                
                return totalCost > 0 && (
                  <div className="pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-mobile-lg font-bold text-black">Итого</span>
                      <span className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">
                        ₴{totalCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Исключить из статистики (только для владельца, только для архивных) */}
          {isStoOwner && appointment.status === 'archived' && (
            <div className="bg-white rounded-lg shadow p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={!!appointment.exclude_from_stats}
                    onChange={() => updateExcludeFromStatsMutation.mutate(!appointment.exclude_from_stats)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 rounded border-gray-300 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center">
                    {appointment.exclude_from_stats && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-mobile-sm font-medium text-gray-900">Исключить из статистики</p>
                  <p className="text-xs text-gray-500">Не учитывать в отчётах за месяц</p>
                </div>
              </label>
            </div>
          )}

          {/* Дополнительная информация */}
          {appointment.ready_for_pickup && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-mobile-base text-green-800 font-medium">✓ Готово к выдаче</p>
            </div>
          )}

          {/* Блок подтверждения удаления (для владельца) */}
          {isStoOwner && appointment.status === 'pending_deletion' && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-900 mb-1">🗑️ Работник запросил удаление</p>
              <p className="text-xs text-red-700 mb-3">Действие необратимо. Только вы можете подтвердить удаление.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatusMutation.mutate('deleted')}
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Подтвердить удаление
                </button>
                <button
                  onClick={() => updateStatusMutation.mutate('in_progress')}
                  disabled={updateStatusMutation.isPending}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Отклонить
                </button>
              </div>
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
          appointmentInfo={{
            customerName: reassignModal.customerName,
            vehicleName: reassignModal.vehicleName
          }}
        />
      )}

      {/* Модалка подтверждения архивирования */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full mx-4">
            <h3 className="heading-mobile-3 mb-4">Перенести в архив?</h3>
            <p className="text-mobile-base text-gray-600 mb-6">
              Заявка будет перенесена в архив и попадёт в статистику текущего месяца.
              Вернуть её из архива можно будет позже.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => { updateStatusMutation.mutate('archived'); setShowArchiveConfirm(false) }}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-gray-700 text-white hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'Обновление...' : 'В архив'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка подтверждения оплаты */}
      {paymentConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full mx-4">
            <h3 className="heading-mobile-3 mb-4">
              Подтверждение изменения статуса оплаты
            </h3>
            <p className="text-mobile-base text-gray-600 mb-6">
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
