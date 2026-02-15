import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentId: string
  currentWorkerId: string | null
  appointmentInfo: {
    customerName: string
    vehicleName: string
  }
}

export default function ReassignWorkerModal({
  isOpen,
  onClose,
  appointmentId,
  currentWorkerId,
  appointmentInfo,
}: Props) {
  const [selectedWorkerId, setSelectedWorkerId] = useState(currentWorkerId || '')
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()

  // Загружаем список работников СТО
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['sto_workers', profile?.sto_company_id],
    queryFn: async () => {
      // Получаем роль sto_worker
      const { data: workerRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (!workerRole) return []

      // Получаем пользователей с этой ролью в данной СТО
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', workerRole.id)

      if (!userRoles) return []

      const userIds = userRoles.map((ur) => ur.user_id)

      // Получаем профили работников
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('is_active', true)
        .in('id', userIds)
        .order('full_name')

      if (error) {
        console.error('Workers error:', error)
        return []
      }

      return profiles
    },
    enabled: !!profile?.sto_company_id && isOpen,
  })

  const reassignMutation = useMutation({
    mutationFn: async (newWorkerId: string) => {
      const { error } = await supabase
        .from('appointments')
        .update({ assigned_to: newWorkerId })
        .eq('id', appointmentId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['worker_appointments'] })
      toast.success('Работник успешно переназначен')
      onClose()
    },
    onError: (error: any) => {
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedWorkerId && selectedWorkerId !== currentWorkerId) {
      reassignMutation.mutate(selectedWorkerId)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Переназначить работника</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Заявка:</p>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-medium text-gray-900">{appointmentInfo.customerName}</p>
              <p className="text-sm text-gray-600">{appointmentInfo.vehicleName}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите работника
            </label>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : workers.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">Нет доступных работников</p>
            ) : (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="">-- Выберите работника --</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.full_name || worker.email}
                    {worker.id === currentWorkerId && ' (текущий)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={
                reassignMutation.isPending ||
                !selectedWorkerId ||
                selectedWorkerId === currentWorkerId
              }
              className="px-6 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {reassignMutation.isPending ? 'Сохранение...' : 'Переназначить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
