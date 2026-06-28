import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from './useUserProfile'
import { useFeatureFlag } from './useFeatureFlags'

/** Избранное маркета (под флагом market_favorites; требует входа). */
export function useFavorites() {
  const qc = useQueryClient()
  const enabled = useFeatureFlag('market_favorites')
  const { data: profile } = useUserProfile()
  const uid = profile?.id

  const { data: ids = [] } = useQuery({
    queryKey: ['favorites', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('market_favorites').select('inventory_id')
      if (error) throw error
      return (data || []).map((r: { inventory_id: string }) => r.inventory_id)
    },
    enabled: enabled && !!uid,
    staleTime: 60_000,
  })

  const set = new Set(ids)
  const toggle = useMutation({
    mutationFn: async (inventoryId: string) => {
      if (!uid) throw new Error('Нужно войти')
      if (set.has(inventoryId)) {
        const { error } = await supabase.from('market_favorites').delete()
          .eq('inventory_id', inventoryId).eq('user_id', uid)
        if (error) throw error
      } else {
        const { error } = await supabase.from('market_favorites').insert({ inventory_id: inventoryId, user_id: uid })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites', uid] }),
  })

  return {
    enabled,
    canUse: enabled && !!uid,
    ids,
    isFavorite: (id: string) => set.has(id),
    toggle: (id: string) => toggle.mutate(id),
  }
}
