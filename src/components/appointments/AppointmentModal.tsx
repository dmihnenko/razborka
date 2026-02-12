import { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { AppointmentFormValues, AppointmentStatus } from '@/types/appointments'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import ClientSelector from './ClientSelector'
import VehicleSelector from './VehicleSelector'
import WorkItemsManager from './WorkItemsManager'
import PartItemsManager from './PartItemsManager'
import AppointmentSummary from './AppointmentSummary'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentId?: string
  onSuccess?: (id: string) => void
}

const steps = [
  { id: 1, name: 'Клиент', description: 'Выбор клиента' },
  { id: 2, name: 'Автомобиль', description: 'Выбор транспорта' },
  { id: 3, name: 'Работы', description: 'Список работ' },
  { id: 4, name: 'Запчасти', description: 'Список запчастей' },
  { id: 5, name: 'Проверка', description: 'Итоговая сводка' },
]

export default function AppointmentModal({ isOpen, onClose, appointmentId, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AppointmentFormValues>({
    customer_id: '',
    vehicle_id: '',
    scheduledDate: new Date().toISOString().slice(0, 16),
    status: 'pending',
    notes: '',
    workItems: [],
    partItems: [],
  })

  const createMutation = useMutation({
    mutationFn: async (data: AppointmentFormValues) => {
      const totalWork = data.workItems.reduce((sum, item) => sum + item.price, 0)
      const totalParts = data.partItems.reduce((sum, item) => sum + item.totalPrice, 0)

      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          customer_id: data.customer_id,
          vehicle_id: data.vehicle_id,
          scheduled_date: data.scheduledDate,
          status: data.status,
          notes: data.notes,
          work_items: data.workItems,
          part_items: data.partItems,
          total_work_cost: totalWork,
          total_parts_cost: totalParts,
          total_cost: totalWork + totalParts,
          sto_company_id: profile?.sto_company_id,
          created_by: profile?.id,
          // Автоматически назначаем создателя как ответственного работника
          assigned_to: profile?.id,
        })
        .select()
        .single()

      if (error) throw error
      return appointment
    },
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Запись успешно создана!')
      onSuccess?.(appointment.id)
      onClose()
    },
    onError: (error: any) => {
      toast.error(`Ошибка: ${error.message}`)
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {appointmentId ? 'Редактировать запись' : 'Новая запись на обслуживание'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Шаг {currentStep} из {steps.length}: {steps[currentStep - 1].description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
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
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    step.id < currentStep
                      ? 'bg-green-500 text-white'
                      : step.id === currentStep
                      ? 'bg-primary text-white ring-4 ring-primary/20'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                </div>
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
            <WorkItemsManager
              items={formData.workItems}
              onChange={(items) => setFormData({ ...formData, workItems: items })}
            />
          )}

          {currentStep === 4 && (
            <PartItemsManager
              items={formData.partItems}
              onChange={(items) => setFormData({ ...formData, partItems: items })}
            />
          )}

          {currentStep === 5 && (
            <AppointmentSummary
              formData={formData}
              onUpdate={(data) => setFormData({ ...formData, ...data })}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Назад
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>

            {currentStep < steps.length ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center px-6 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Далее
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}
                className="px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-semibold"
              >
                {createMutation.isPending ? 'Сохранение...' : 'Создать запись'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
