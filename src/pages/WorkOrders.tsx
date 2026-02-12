import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react'
import WorkOrderModal from '@/components/work-orders/WorkOrderModal'
import ReassignWorkerModal from '@/components/work-orders/ReassignWorkerModal'

export default function WorkOrders() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWorkOrder, setEditingWorkOrder] = useState<any>(null)
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean
    workOrderId: string
    currentWorkerId: string | null
    customerName: string
    vehicleName: string
  } | null>(null)
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()

  // Проверяем роль пользователя
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['work_orders', profile?.id],
    queryFn: async () => {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          customers(name, phone),
          vehicles(brand, model, license_plate),
          created_by_profile:user_profiles!created_by(full_name, email),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)
        `)

      // Работники видят только свои заказы
      if (!isStoOwner && profile?.id) {
        query = query.eq('assigned_to', profile.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.id,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_orders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_orders'] })
      toast.success('Заказ-наряд удален')
    },
  })

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    invoiced: 'bg-purple-100 text-purple-800',
  }

  const statusLabels = {
    draft: 'Черновик',
    in_progress: 'В работе',
    completed: 'Выполнен',
    invoiced: 'Оплачен',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Заказ-наряды</h1>
        <button
          onClick={() => {
            setEditingWorkOrder(null)
            setIsModalOpen(true)
          }}
          className="flex items-center px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90"
        >
          <Plus className="w-5 h-5 mr-2" />
          Новый заказ-наряд
        </button>
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
                  Дата создания
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Клиент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Автомобиль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Назначено
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Сумма
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workOrders?.map((order: any) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(order.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.customers?.name}</div>
                    <div className="text-sm text-gray-500">{order.customers?.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.vehicles?.brand} {order.vehicles?.model}
                    <div className="text-sm text-gray-500">{order.vehicles?.license_plate}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {order.assigned_to_profile ? (
                      <div>
                        <div className="text-gray-900 font-medium">
                          {order.assigned_to_profile.full_name || order.assigned_to_profile.email}
                        </div>
                        <div className="text-xs text-gray-500">Работник</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Не назначено</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[order.status as keyof typeof statusColors]}`}>
                      {statusLabels[order.status as keyof typeof statusLabels]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₴{Number(order.total_cost || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {isStoOwner && (
                      <button
                        onClick={() =>
                          setReassignModal({
                            isOpen: true,
                            workOrderId: order.id,
                            currentWorkerId: order.assigned_to,
                            customerName: order.customers?.name || 'Неизвестно',
                            vehicleName: `${order.vehicles?.brand || ''} ${order.vehicles?.model || ''}`.trim(),
                          })
                        }
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Переназначить работника"
                      >
                        <UserCog className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingWorkOrder(order)
                        setIsModalOpen(true)
                      }}
                      className="text-primary hover:text-primary/80 mr-3"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Удалить этот заказ-наряд?')) {
                          deleteMutation.mutate(order.id)
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WorkOrderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingWorkOrder(null)
        }}
        workOrderId={editingWorkOrder?.id}
      />

      {reassignModal && (
        <ReassignWorkerModal
          isOpen={reassignModal.isOpen}
          onClose={() => setReassignModal(null)}
          workOrderId={reassignModal.workOrderId}
          currentWorkerId={reassignModal.currentWorkerId}
          workOrderInfo={{
            customerName: reassignModal.customerName,
            vehicleName: reassignModal.vehicleName,
          }}
        />
      )}
    </div>
  )
}
