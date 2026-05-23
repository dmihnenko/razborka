import { supabase } from '../lib/supabase'

export interface Role {
  id: string
  name: string
  display_name: string
  description: string | null
  is_active: boolean
}

export interface UserRole {
  role_id: string
  is_primary: boolean
}

export interface UserProfile {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  username: string | null
  is_active: boolean
  sto_company_id: string | null
  parts_company_id: string | null
  user_roles?: UserRole[]
}

export interface UpdateUserProfileParams {
  userId: string
  full_name: string
  phone: string
  sto_company_id: string | null
  parts_company_id: string | null
}

export interface UpdateUserRolesParams {
  userId: string
  role_ids: string[]
  primary_role_id: string
}

export interface UpdateProfileParams {
  userId: string
  full_name: string
  phone: string
}

// Получить профиль пользователя с ролями
export async function getUserProfileWithRoles(userId: string): Promise<UserProfile> {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error

  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, is_primary')
    .eq('user_id', userId)

  return { ...profile, user_roles: userRoles || [] }
}

// Получить все активные роли
export async function getRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('is_active', true)
  if (error) throw error
  return data as Role[]
}

// Обновить профиль пользователя (поля + роли)
export async function updateUserProfile(params: UpdateUserProfileParams): Promise<void> {
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      full_name: params.full_name,
      phone: params.phone,
      sto_company_id: params.sto_company_id,
      parts_company_id: params.parts_company_id,
    })
    .eq('id', params.userId)
  if (profileError) throw profileError
}

// Обновить роли пользователя
export async function updateUserRoles(params: UpdateUserRolesParams): Promise<void> {
  const { error: deleteError } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', params.userId)
  if (deleteError) throw deleteError

  if (params.role_ids.length > 0) {
    const { error: insertError } = await supabase.from('user_roles').upsert(
      params.role_ids.map(roleId => ({
        user_id: params.userId,
        role_id: roleId,
        is_primary: roleId === params.primary_role_id,
      })),
      { onConflict: 'user_id,role_id' }
    )
    if (insertError) throw insertError
  }
}

// Обновить профиль текущего пользователя (ProfileSettings)
export async function updateProfile(params: UpdateProfileParams): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: params.full_name,
      phone: params.phone,
    })
    .eq('id', params.userId)
  if (error) throw error
}

// Сменить пароль
export async function changePassword(newPassword: string): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('Пароль должен быть не менее 6 символов')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
