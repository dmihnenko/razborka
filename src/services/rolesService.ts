import { supabase } from '../lib/supabase'

export type Role = {
  id: string
  name: string
  display_name: string
  is_active: boolean
  description: string | null
  created_at: string
}

export type RoleFormData = {
  name: string
  display_name: string
  description: string
  is_active: boolean
}

export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name')

  if (error) throw error
  return data as Role[]
}

export async function createRole(data: RoleFormData): Promise<void> {
  const { error } = await supabase.from('roles').insert([data])
  if (error) throw error
}

export async function updateRole(id: string, data: RoleFormData): Promise<void> {
  const { error } = await supabase.from('roles').update(data).eq('id', id)
  if (error) throw error
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await supabase.from('roles').delete().eq('id', id)
  if (error) throw error
}

export async function fetchRoleByName(name: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('roles')
    .select('id')
    .eq('name', name)
    .single()

  if (error) throw error
  return data
}

export async function fetchUserIdsByRole(roleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleId)

  if (error) throw error
  return (data ?? []).map((r: { user_id: string }) => r.user_id)
}

export async function assignUserRole(
  userId: string,
  roleId: string,
  isPrimary = false
): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role_id: roleId, is_primary: isPrimary }, {
      onConflict: 'user_id,role_id',
    })
  if (error) throw error
}
