import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function useToggleAppointmentExclude() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, exclude }: { id: string; exclude: boolean }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ exclude_from_stats: exclude })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success('Статус учета обновлен')
    },
    onError: () => {
      toast.error('Ошибка обновления')
    },
  })
}
