import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  entityId: string
  entityTable: 'appointments' | 'work_orders'
  entityLabel: string
  entityInfo: {
    customerName: string
    vehicleName: string
  }
  currentWorkerId: string | null
  filterIsActive?: boolean
  invalidateQueryKeys?: string[]
}

export default function ReassignWorkerModal({
  isOpen,
  onClose,
  entityId,
  entityTable,
  entityLabel,
  entityInfo,
  currentWorkerId,
  filterIsActive = false,
  invalidateQueryKeys = [],
}: Props) {
  const [selectedWorkerId, setSelectedWorkerId] = useState(currentWorkerId || '')
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  useBlockScroll(isOpen)

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['sto_workers', profile?.sto_company_id],
    queryFn: async () => {
      const { data: workerRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (!workerRole) return []

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', workerRole.id)

      if (!userRoles) return []

      const userIds = userRoles.map((ur) => ur.user_id)

      let query = supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('sto_company_id', profile?.sto_company_id)
        .in('id', userIds)
        .order('full_name')

      if (filterIsActive) {
        query = query.eq('is_active', true)
      }

      const { data: profiles, error } = await query

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
        .from(entityTable)
        .update({ assigned_to: newWorkerId })
        .eq('id', entityId)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateQueryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] })
      })
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
    <div className="modal-overlay">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Переназначить работника</h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">{entityLabel}</p>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-medium text-gray-900">{entityInfo.customerName}</p>
              <p className="text-sm text-gray-600">{entityInfo.vehicleName}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите работника
            </label>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : workers.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">Нет доступных работников</p>
            ) : (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="px-4 py-2.5 min-h-[40px] text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
              className="px-4 py-2.5 min-h-[40px] text-sm text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {reassignMutation.isPending ? 'Сохранение...' : 'Переназначить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
