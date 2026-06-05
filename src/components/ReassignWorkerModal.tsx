import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { UserCog } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import Modal from '@/components/ui/Modal'
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

  const submit = () => {
    if (selectedWorkerId && selectedWorkerId !== currentWorkerId) {
      reassignMutation.mutate(selectedWorkerId)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><UserCog className="w-5 h-5 text-primary" /></div>}
      title="Переназначить работника"
      subtitle="Назначьте другого мастера на заявку"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={reassignMutation.isPending || !selectedWorkerId || selectedWorkerId === currentWorkerId}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {reassignMutation.isPending ? 'Сохранение…' : 'Переназначить'}
          </button>
        </div>
      }
    >
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{entityLabel}</p>
        <div className="bg-gray-50 rounded-lg px-3.5 py-2.5">
          <p className="font-semibold text-gray-900 text-sm">{entityInfo.customerName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{entityInfo.vehicleName}</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-gray-700 mb-2">Выберите работника</label>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : workers.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">Нет доступных работников</p>
      ) : (
        <select
          value={selectedWorkerId}
          onChange={(e) => setSelectedWorkerId(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">— Выберите работника —</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.full_name || worker.email}{worker.id === currentWorkerId ? ' (текущий)' : ''}
            </option>
          ))}
        </select>
      )}
    </Modal>
  )
}
