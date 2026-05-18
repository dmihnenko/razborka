import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth()
  return useQuery({
    queryKey: ['userProfile', user?.id],
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !authLoading && !!user, // запускаем только когда auth точно загружен
    queryFn: async () => {
      if (!user) return null

      // Получаем профиль - НЕ используем .single() чтобы избежать ошибки если профиля нет
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)

      if (profileError) {
        console.error('Profile error:', profileError)
        throw profileError
      }

      // Если профиль не найден — возвращаем null (профиль создаётся триггером при регистрации)
      if (!profiles || profiles.length === 0) {
        return null
      }

      // Загружаем роли одним запросом
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('is_primary, roles(id, name, display_name, description, is_active)')
        .eq('user_id', user.id)

      const roles = (userRolesData || [])
        .filter((ur: any) => ur.roles != null)
        .map((ur: any) => ({
          ...ur.roles,
          is_primary: ur.is_primary
        }))

      return { ...profiles[0], roles }
    },
  })
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
