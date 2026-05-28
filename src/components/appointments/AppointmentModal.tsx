import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { AppointmentFormValues } from '@/types/appointments'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { moveToTrash } from '@/services/trashService'
import ClientSelector from './ClientSelector'
import VehicleSelector from './VehicleSelector'
import WorkItemsManager from './WorkItemsManager'
import PartItemsManager from './PartItemsManager'
import AppointmentSummary from './AppointmentSummary'
import DateTimePicker from './DateTimePicker'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentId?: string
  onSuccess?: (id: string) => void
}

const steps = [
  { id: 1, name: 'Клиент', description: 'Выбор клиента' },
  { id: 2, name: 'Авто', description: 'Выбор транспорта' },
  { id: 3, name: 'Дата', description: 'Дата и время' },
  { id: 4, name: 'Работы', description: 'Список работ' },
  { id: 5, name: 'Запчасти', description: 'Список запчастей' },
  { id: 6, name: 'Итог', description: 'Проверка и сохранение' },
]

export default function AppointmentModal({ isOpen, onClose, appointmentId, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AppointmentFormValues>({
    customer_id: '',
    vehicle_id: '',
    scheduledDate: new Date().toISOString().slice(0, 16),
    status: 'in_progress',
    notes: '',
    workItems: [],
    partItems: [],
    parts_paid: false,
    work_paid: false,
  })

  useBlockScroll(isOpen)

  // Проверка роли работника
  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  
  // Загрузка существующей заявки для редактирования
  const { data: existingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(*), vehicles(*)')
        .eq('id', appointmentId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!appointmentId && isOpen,
  })

  // Загрузка данных при редактировании
  useEffect(() => {
    if (existingAppointment && appointmentId) {
      // Обработка даты: если Invalid Date, используем created_at или updated_at
      let scheduledDate = existingAppointment.scheduled_date
      if (!scheduledDate || isNaN(new Date(scheduledDate).getTime())) {
        scheduledDate = existingAppointment.created_at || existingAppointment.updated_at || new Date().toISOString()
      }
      // Преобразуем в формат datetime-local
      scheduledDate = new Date(scheduledDate).toISOString().slice(0, 16)
      
      setFormData({
        customer_id: existingAppointment.customer_id,
        vehicle_id: existingAppointment.vehicle_id,
        scheduledDate,
        status: existingAppointment.status,
        notes: existingAppointment.notes || '',
        workItems: existingAppointment.work_items || [],
        partItems: existingAppointment.part_items || [],
        selectedClient: existingAppointment.customers,
        selectedVehicle: existingAppointment.vehicles,
        assigned_to: existingAppointment.assigned_to,
        parts_paid: existingAppointment.parts_paid || false,
        work_paid: existingAppointment.work_paid || false,
      })
      // При редактировании начинаем с шага 4 (работы)
      setCurrentStep(4)
    } else {
      // Сбросить форму при создании новой заявки
      setFormData({
        customer_id: '',
        vehicle_id: '',
        scheduledDate: new Date().toISOString().slice(0, 16),
        status: 'in_progress',
        notes: '',
        workItems: [],
        partItems: [],
        parts_paid: false,
        work_paid: false,
      })
      setCurrentStep(1)
    }
  }, [existingAppointment, appointmentId, isOpen, isStoWorker, isStoOwner])

  const createMutation = useMutation({
    mutationFn: async (data: AppointmentFormValues) => {
      const totalWork = data.workItems.reduce((sum, item) => sum + item.price, 0)
      const totalParts = data.partItems.reduce((sum, item) => sum + item.totalPrice, 0)

      if (appointmentId) {
        // Обновление существующей заявки
        const { data: appointment, error } = await supabase
          .from('appointments')
          .update({
            customer_id: data.customer_id,
            vehicle_id: data.vehicle_id,
            scheduled_date: data.scheduledDate,
            status: data.status,
            notes: data.notes || null,
            work_items: data.workItems,
            part_items: data.partItems,
            total_work_cost: totalWork,
            total_parts_cost: totalParts,
            total_cost: totalWork + totalParts,
            assigned_to: data.assigned_to || null,
            parts_paid: data.parts_paid || false,
            work_paid: data.work_paid || false,
          })
          .eq('id', appointmentId)
          .select()
          .single()

        if (error) {
          console.error('Supabase update error:', error)
          throw error
        }
        return appointment
      } else {
        // Создание новой заявки
        const { data: appointment, error } = await supabase
          .from('appointments')
          .insert({
            customer_id: data.customer_id,
            vehicle_id: data.vehicle_id,
            scheduled_date: data.scheduledDate,
            status: 'in_progress',
            notes: data.notes,
            work_items: data.workItems,
            part_items: data.partItems,
            total_work_cost: totalWork,
            total_parts_cost: totalParts,
            total_cost: totalWork + totalParts,
            sto_company_id: profile?.sto_company_id,
            created_by: profile?.id,
            assigned_to: data.assigned_to || profile?.id,
            parts_paid: false,
            work_paid: false,
          })
          .select()
          .single()

        if (error) throw error
        return appointment
      }
    },
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['worker_appointments'] })
      toast.success(appointmentId ? 'Запись успешно обновлена!' : 'Запись успешно создана!')
      onSuccess?.(appointment.id)
      onClose()
    },
    onError: (error: any) => {
      console.error('Save mutation error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!appointmentId) throw new Error('No appointment ID')
      
      // Работник помечает заявку как удаленную (статус deleted)
      if (isStoWorker && !isStoOwner) {
        const currentNotes = formData.notes || ''
        const updatedNotes = currentNotes + (currentNotes ? '\n' : '') + '[Работник запросил удаление]'
        
        const { error } = await supabase
          .from('appointments')
          .update({ 
            status: 'deleted',
            notes: updatedNotes
          })
          .eq('id', appointmentId)

        if (error) {
          console.error('Delete mutation error (worker):', error)
          throw error
        }
      } else {
        // Владелец перемещает заявку в корзину
        await moveToTrash({
          entityType: 'appointment',
          entityId: appointmentId,
          entityLabel: `Заявка: ${existingAppointment?.customers?.name || existingAppointment?.customer_id || ''}`,
          entityData: existingAppointment,
          stoCompanyId: profile?.sto_company_id,
        })
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', appointmentId)

        if (error) {
          console.error('Delete mutation error (owner):', error)
          throw error
        }
      }
    },
    onSuccess: () => {
      // Инвалидируем все queries связанные с appointments
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['worker_appointments'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      // Принудительно рефетчим данные
      queryClient.refetchQueries({ queryKey: ['appointments'] })
      toast.success(
        isStoWorker && !isStoOwner 
          ? 'Заявка отправлена на удаление' 
          : 'Заявка перемещена в корзину'
      )
      onClose()
    },
    onError: (error: any) => {
      toast.error(`Ошибка удаления: ${error.message}`)
    },
  })

  if (!isOpen) return null

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      // Для работников шаг 1 и 2 недоступны при редактировании
      if (isStoWorker && !isStoOwner && appointmentId && currentStep === 4) {
        return
      }
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.customer_id !== ''
      case 2:
        return formData.vehicle_id !== ''
      case 3:
      case 4:
        return true // Работы и запчасти опциональны
      case 5:
        return true
      default:
        return false
    }
  }

  const handleDelete = async () => {
    if (!appointmentId) return
    
    const confirmMessage = isStoWorker && !isStoOwner
      ? 'Отправить заявку на удаление? Она будет отправлена владельцу на подтверждение.'
      : 'Вы уверены, что хотите удалить эту заявку?'
    
    const ok = await showConfirm({
      message: confirmMessage,
      confirmText: isStoWorker && !isStoOwner ? 'Отправить' : 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    })
    if (ok) deleteMutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between relative">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {appointmentId ? 'Редактировать запись' : 'Новая запись на обслуживание'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Шаг {currentStep} из {steps.length}: {steps[currentStep - 1].description}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-4 right-4 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-900 hover:text-gray-700 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-12 right-12 h-0.5 bg-gray-200 -z-10">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
              />
            </div>

            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <button
                  type="button"
                  onClick={() => appointmentId ? setCurrentStep(step.id) : null}
                  disabled={!appointmentId && step.id !== currentStep}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    appointmentId || step.id <= currentStep ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-60'
                  } ${
                    step.id < currentStep
                      ? 'bg-green-500 text-white hover:bg-green-700'
                      : step.id === currentStep
                      ? 'bg-primary text-white ring-4 ring-primary/20'
                      : 'bg-gray-200 text-gray-500 ' + (appointmentId ? 'hover:bg-gray-300' : '')
                  }`}
                >
                  {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                </button>
                <span
                  className={`mt-2 text-xs font-medium ${
                    step.id === currentStep ? 'text-primary' : 'text-gray-500'
                  }`}
                >
                  {step.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStep === 1 && (
            <ClientSelector
              selectedId={formData.customer_id}
              onSelect={(id, customer) => setFormData({ ...formData, customer_id: id, vehicle_id: '', selectedClient: customer })}
            />
          )}

          {currentStep === 2 && (
            <VehicleSelector
              customerId={formData.customer_id}
              selectedId={formData.vehicle_id}
              onSelect={(id, vehicle) => setFormData({ ...formData, vehicle_id: id, selectedVehicle: vehicle })}
            />
          )}

          {currentStep === 3 && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-900">Дата и время записи</h3>
                <p className="text-xs text-gray-400 mt-0.5">Выберите удобную дату и свободный слот</p>
              </div>
              <DateTimePicker
                value={formData.scheduledDate}
                onChange={(val) => setFormData({ ...formData, scheduledDate: val })}
                stoCompanyId={profile?.sto_company_id}
                excludeAppointmentId={appointmentId}
              />
            </div>
          )}

          {currentStep === 4 && (
            <WorkItemsManager
              items={formData.workItems}
              onChange={(items) => setFormData({ ...formData, workItems: items })}
            />
          )}

          {currentStep === 5 && (
            <PartItemsManager
              items={formData.partItems}
              onChange={(items) => setFormData({ ...formData, partItems: items })}
            />
          )}

          {currentStep === 6 && (
            <AppointmentSummary
              formData={formData}
              onUpdate={(data) => setFormData({ ...formData, ...data })}
              isEditing={!!appointmentId}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex items-center gap-2 sm:gap-3">
          {currentStep > 1 && !(isStoWorker && !isStoOwner && appointmentId && currentStep === 4) && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-center"
            >
              Назад
            </button>
          )}
          
          {appointmentId && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors font-medium text-center"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </button>
          )}
          
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium border-2 border-gray-300 text-center"
          >
            Отмена
          </button>

          {currentStep < steps.length ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-center"
            >
              Далее
            </button>
          ) : (
            <button
              type="button"
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors font-medium text-center whitespace-nowrap"
            >
              {createMutation.isPending ? 'Сохранение...' : (appointmentId ? 'Сохранить' : 'Создать')}
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
