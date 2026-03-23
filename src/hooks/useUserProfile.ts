import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
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

      // Если профиль не найден, создаем его
      if (!profiles || profiles.length === 0) {
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            is_active: true
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating profile:', createError)
          throw createError
        }

        return { ...newProfile, roles: [] }
      }

      const profile = profiles[0]
      
      // Получаем все роли пользователя через таблицу user_roles
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role_id, is_primary')
        .eq('user_id', user.id)
      
      if (userRolesError) {
        console.error('User roles error:', userRolesError)
        throw userRolesError
      }
      
      // Если нет ролей, возвращаем профиль с пустым массивом
      if (!userRolesData || userRolesData.length === 0) {
        return { ...profile, roles: [] }
      }

      // Получаем данные ролей
      const roleIds = userRolesData.map(ur => ur.role_id)
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .in('id', roleIds)
      
      if (rolesError) {
        console.error('Roles error:', rolesError)
        throw rolesError
      }

      // Добавляем информацию об is_primary к каждой роли
      const rolesWithPrimary = rolesData?.map(role => ({
        ...role,
        is_primary: userRolesData.find(ur => ur.role_id === role.id)?.is_primary || false
      })) || []

      return { ...profile, roles: rolesWithPrimary }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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
