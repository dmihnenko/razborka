import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const PROFILE_CACHE_KEY = 'tsp_profile_cache'
const PROFILE_CACHE_TTL = 4 * 60 * 60 * 1000 // 4 часа

interface CachedProfile {
  data: any
  userId: string
  cachedAt: number
}

function loadProfileFromCache(userId: string): any | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const cached: CachedProfile = JSON.parse(raw)
    if (cached.userId !== userId) return null
    if (Date.now() - cached.cachedAt > PROFILE_CACHE_TTL) return null
    // Не сидим профиль без ролей — иначе на обновлении версии мелькает экран выбора роли.
    if (!cached.data?.roles?.length) return null
    return cached.data
  } catch {
    return null
  }
}

function saveProfileToCache(userId: string, data: any) {
  try {
    // Не кэшируем профиль без ролей — он бы провоцировал мигание экрана выбора роли.
    if (!data?.roles?.length) return
    const cached: CachedProfile = { data, userId, cachedAt: Date.now() }
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached))
  } catch {
    // ignore storage errors
  }
}

function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // ignore storage errors
  }
}

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth()

  return useQuery({
    queryKey: ['userProfile', user?.id],
    refetchOnWindowFocus: false,
    staleTime: 4 * 60 * 60 * 1000, // 4 часа — совпадает с TTL кэша
    gcTime: 6 * 60 * 60 * 1000,
    retry: 1,
    enabled: !authLoading && !!user,
    // Используем localStorage как initialData чтобы убрать мигание скелетона
    initialData: () => user ? loadProfileFromCache(user.id) : undefined,
    initialDataUpdatedAt: () => {
      if (!user) return 0
      try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY)
        if (!raw) return 0
        const cached: CachedProfile = JSON.parse(raw)
        return cached.userId === user.id ? cached.cachedAt : 0
      } catch { return 0 }
    },
    queryFn: async () => {
      if (!user) return null

      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)

      if (profileError) throw profileError
      if (!profiles || profiles.length === 0) return null

      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('is_primary, roles(id, name, display_name, description, is_active)')
        .eq('user_id', user.id)

      const roles = (userRolesData || [])
        .filter((ur: any) => ur.roles != null)
        .map((ur: any) => ({ ...ur.roles, is_primary: ur.is_primary }))

      const result = { ...profiles[0], roles }

      // Сохраняем в localStorage для следующего запуска
      saveProfileToCache(user.id, result)

      return result
    },
  })
}

// Хук для очистки кэша (вызывать при logout)
export function useClearProfileCache() {
  const queryClient = useQueryClient()
  return () => {
    clearProfileCache()
    queryClient.removeQueries({ queryKey: ['userProfile'] })
  }
}

export function useIsAdmin() {
  const { data: profile } = useUserProfile()
  return profile?.roles?.some((role: any) => role.name === 'admin') || false
}

export function useHasRole(roleName: string) {
  const { data: profile } = useUserProfile()
  return profile?.roles?.some((role: any) => role.name === roleName) || false
}

export function useHasAnyRole(roleNames: string[]) {
  const { data: profile } = useUserProfile()
  return profile?.roles?.some((role: any) => roleNames.includes(role.name)) || false
}
