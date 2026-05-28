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

// ============================================================================
// Users page queries
// ============================================================================

export interface UserProfileWithRoles {
  id: string
  full_name: string | null
  phone: string | null
  email: string
  username: string | null
  role_id: string | null
  sto_company_id: string | null
  parts_company_id: string | null
  is_active: boolean
  sto_companies?: { id: string; name: string } | null
  parts_companies?: { id: string; name: string } | null
  roles?: Array<{
    id: string
    name: string
    display_name: string
    description: string | null
    is_active: boolean
    is_primary?: boolean
  }>
}

export interface FetchUsersParams {
  isStoOwner: boolean
  isPartsOwner: boolean
  isAdmin: boolean
  stoCompanyId?: string | null
  partsCompanyId?: string | null
}

export async function fetchUsers(params: FetchUsersParams): Promise<UserProfileWithRoles[]> {
  let query = supabase.from('user_profiles').select(`
    *,
    sto_companies:sto_company_id(id, name),
    parts_companies:parts_company_id(id, name)
  `)

  if (params.isStoOwner && !params.isAdmin) {
    query = query.eq('sto_company_id', params.stoCompanyId)
  }
  if (params.isPartsOwner && !params.isAdmin && !params.isStoOwner) {
    query = query.eq('parts_company_id', params.partsCompanyId)
  }

  const { data: profiles, error: profilesError } = await query
  if (profilesError) throw profilesError

  const { data: allRoles, error: rolesError } = await supabase.from('roles').select('*')
  if (rolesError) throw rolesError

  const { data: userRolesData, error: userRolesError } = await supabase.from('user_roles').select('*')
  if (userRolesError) throw userRolesError

  return (profiles || []).map(profile => {
    const userRoleIds = userRolesData?.filter(ur => ur.user_id === profile.id).map(ur => ur.role_id) || []
    const userRoles = allRoles?.filter(r => userRoleIds.includes(r.id)) || []
    return { ...profile, roles: userRoles, email: profile.email || 'N/A' }
  })
}

export async function fetchActiveRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('is_active', true)
    .order('display_name')
  if (error) throw error
  return data
}

export async function fetchStoCompanies() {
  const { data, error } = await supabase
    .from('sto_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data as Array<{ id: string; name: string }>
}

export async function fetchPartsCompanies() {
  const { data, error } = await supabase
    .from('parts_companies')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data as Array<{ id: string; name: string }>
}

export async function updateUserRolesFull(params: {
  userId: string
  roleIds: string[]
  primaryRoleId?: string
  sto_company_id?: string | null
  parts_company_id?: string | null
}): Promise<void> {
  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', params.userId)
  if (deleteError) throw deleteError

  if (params.roleIds.length > 0) {
    const { error: insertError } = await supabase.from('user_roles').insert(
      params.roleIds.map(roleId => ({
        user_id: params.userId,
        role_id: roleId,
        is_primary: roleId === params.primaryRoleId,
      }))
    )
    if (insertError) throw insertError
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      sto_company_id: params.sto_company_id || null,
      parts_company_id: params.parts_company_id || null,
    })
    .eq('id', params.userId)
  if (updateError) throw updateError
}

export async function toggleUserActive(userId: string, currentActive: boolean): Promise<void> {
  const { error } = await supabase.from('user_profiles').update({ is_active: !currentActive }).eq('id', userId)
  if (error) throw error
}

export async function softDeleteUser(userId: string): Promise<void> {
  const { error } = await supabase.from('user_profiles').update({ is_active: false }).eq('id', userId)
  if (error) throw error
}

export async function getAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function checkUsernameExists(username: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('username', username.toLowerCase())
    .maybeSingle()
  return !!data
}

export async function getUserByUsername(username: string): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle()
  return data
}

export async function getUserRolesWithNames(userId: string): Promise<{
  roleNames: string[]
  primaryRoleName: string | null
}> {
  const { data: userRolesData } = await supabase
    .from('user_roles')
    .select('role_id, is_primary')
    .eq('user_id', userId)

  if (!userRolesData || userRolesData.length === 0) {
    return { roleNames: [], primaryRoleName: null }
  }

  const roleIds = userRolesData.map(ur => ur.role_id)
  const { data: rolesData } = await supabase.from('roles').select('id, name').in('id', roleIds)
  const roleNames = rolesData?.map(r => r.name) || []
  const primaryRoleId = userRolesData.find(ur => ur.is_primary)?.role_id
  const primaryRoleName = primaryRoleId
    ? (rolesData?.find(r => r.id === primaryRoleId)?.name || null)
    : null

  return { roleNames, primaryRoleName }
}

export async function fetchUserProfileForEdit(userId: string) {
  const { data: profile, error } = await supabase.from('user_profiles').select('*').eq('id', userId).single()
  if (error) throw error
  const { data: userRoles } = await supabase.from('user_roles').select('role_id, is_primary').eq('user_id', userId)
  return { ...profile, user_roles: userRoles || [] }
}

export async function fetchAllActiveRoles() {
  const { data, error } = await supabase.from('roles').select('*').eq('is_active', true)
  if (error) throw error
  return data
}
