import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import ClientSelector from '@/components/appointments/ClientSelector'
import VehicleSelector from '@/components/appointments/VehicleSelector'
import PartsManager, { WorkOrderPartItem } from './PartsManager'

interface Props {
  isOpen: boolean
  onClose: () => void
  workOrderId?: string
}

interface FormData {
  customer_id: string
  vehicle_id: string
  status: 'draft' | 'in_progress' | 'completed' | 'invoiced'
  description: string
  partItems: WorkOrderPartItem[]
  selectedClient?: any
  selectedVehicle?: any
}

const DRAFT_KEY = 'workOrderDraft'

export default function WorkOrderModal({ isOpen, onClose, workOrderId }: Props) {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  
  const [formData, setFormData] = useState<FormData>({
    customer_id: '',
    vehicle_id: '',
    status: 'in_progress', // Автоматически "В работе"
    description: '',
    partItems: [],
  })

  // Загрузка существующего заказ-наряда для редактирования
  const { data: existingWorkOrder } = useQuery({
    queryKey: ['work_order', workOrderId],
    queryFn: async () => {
      if (!workOrderId) return null
      const { data, error } = await supabase
        .from('work_orders')
        .select('*, customers(*), vehicles(*)')
        .eq('id', workOrderId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!workOrderId,
  })

  // Загрузка черновика из localStorage
  useEffect(() => {
    if (!workOrderId && isOpen) {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft)
          setFormData(parsedDraft)
        } catch (e) {
          console.error('Failed to parse draft:', e)
        }
      }
    }
  }, [workOrderId, isOpen])

  // Заполнение формы данными существующего заказ-наряда
  useEffect(() => {
    if (existingWorkOrder) {
      setFormData({
        customer_id: existingWorkOrder.customer_id,
        vehicle_id: existingWorkOrder.vehicle_id,
        status: existingWorkOrder.status,
        description: existingWorkOrder.description || '',
        partItems: existingWorkOrder.part_items || [],
        selectedClient: existingWorkOrder.customers,
        selectedVehicle: existingWorkOrder.vehicles,
      })
    }
  }, [existingWorkOrder])

  // Автосохранение черновика
  useEffect(() => {
    if (!workOrderId && formData.customer_id) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
    }
  }, [formData, workOrderId])

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const totalCost = data.partItems.reduce((sum, item) => sum + item.totalPrice, 0)

      const workOrderData = {
        customer_id: data.customer_id,
        vehicle_id: data.vehicle_id,
        status: data.status,
        description: data.description,
        part_items: data.partItems,
        total_cost: totalCost,
        sto_company_id: profile?.sto_company_id,
        created_by: profile?.id,
        // Автоматически назначаем создателя как ответственного
        assigned_to: profile?.id,
      }

      if (workOrderId) {
        const { data: updated, error } = await supabase
          .from('work_orders')
          .update(workOrderData)
          .eq('id', workOrderId)
          .select()
          .single()

        if (error) throw error
        return updated
      } else {
        const { data: created, error } = await supabase
          .from('work_orders')
          .insert(workOrderData)
          .select()
          .single()

        if (error) throw error
        return created
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_orders'] })
      queryClient.invalidateQueries({ queryKey: ['worker_appointments'] })
      toast.success(workOrderId ? 'Заказ-наряд обновлен' : 'Заказ-наряд создан')
      localStorage.removeItem(DRAFT_KEY)
      onClose()
    },
    onError: (error: any) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {workOrderId ? 'Редактировать заказ-наряд' : 'Новый заказ-наряд'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {workOrderId ? 'Изменение существующего заказ-наряда' : 'Создание нового заказ-наряда'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Клиент */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Клиент</h3>
            <ClientSelector
              selectedId={formData.customer_id}
              onSelect={(id, customer) =>
                setFormData({ ...formData, customer_id: id, vehicle_id: '', selectedClient: customer })
              }
            />
          </div>

          {/* Автомобиль */}
          {formData.customer_id && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Автомобиль</h3>
              <VehicleSelector
                customerId={formData.customer_id}
                selectedId={formData.vehicle_id}
                onSelect={(id, vehicle) => setFormData({ ...formData, vehicle_id: id, selectedVehicle: vehicle })}
              />
            </div>
          )}

          {/* Описание работ */}
          {formData.vehicle_id && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание работ
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Опишите выполняемые работы..."
                />
              </div>

              {/* Запчасти */}
              <PartsManager
                items={formData.partItems}
                onChange={(items) => setFormData({ ...formData, partItems: items })}
              />

              {/* Статус (только при редактировании) */}
              {workOrderId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Статус заказ-наряда
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="draft">Черновик</option>
                    <option value="in_progress">В работе</option>
                    <option value="completed">Выполнен</option>
                    <option value="invoiced">Оплачен</option>
                  </select>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Отмена
          </button>

          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !formData.customer_id || !formData.vehicle_id}
            className="px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {createMutation.isPending
              ? 'Сохранение...'
              : workOrderId
              ? 'Сохранить изменения'
              : 'Создать заказ-наряд'}
          </button>
        </div>
      </div>
    </div>
  )
}
