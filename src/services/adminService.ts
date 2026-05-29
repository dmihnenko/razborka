import { supabase } from '../lib/supabase'

export interface AdminStats {
  users: number
  activeUsers: number
  roles: number
  stoCompanies: number
  partsCompanies: number
  subscriptions: number
  openTickets: number
}

async function safeCount(query: any): Promise<number> {
  try {
    const { count } = await query
    return count || 0
  } catch {
    return 0
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const [users, activeUsers, roles, stoCompanies, partsCompanies, subscriptions, openTickets] =
    await Promise.all([
      safeCount(supabase.from('user_profiles').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('roles').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('sto_companies').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('parts_companies').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('company_subscriptions').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('support_chats').select('*', { count: 'exact', head: true }).eq('status', 'open')),
    ])

  return { users, activeUsers, roles, stoCompanies, partsCompanies, subscriptions, openTickets }
}

export async function fetchAccessRequests(filter: string) {
  let q = supabase
    .from('access_requests')
    .select('*, user:user_profiles!user_id(full_name, username, email)')
    .order('created_at', { ascending: false })
  if (filter !== 'all') q = (q as any).eq('status', filter)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function approveAccessRequest(req: any) {
  const isOwner = req.request_type === 'sto_owner' || req.request_type === 'parts_owner'
  const isWorker = req.request_type === 'sto_worker' || req.request_type === 'parts_worker'
  const isSto = req.request_type === 'sto_owner' || req.request_type === 'sto_worker'
  let companyId: string | null = null

  if (isOwner) {
    const table = isSto ? 'sto_companies' : 'parts_companies'
    const { data: company, error } = await supabase.from(table)
      .insert({ name: req.company_name, address: req.company_address || null, phone: req.company_phone || null, is_active: true })
      .select('id').single()
    if (error) throw error
    companyId = company.id
  }

  if (isWorker) {
    const table = isSto ? 'sto_companies' : 'parts_companies'
    const { data: companies } = await supabase.from(table).select('id').eq('phone', req.owner_phone)
    if (!companies?.length) throw new Error('Компания с таким телефоном не найдена')
    companyId = companies[0].id
  }

  const roleName = req.request_type
  const { data: role } = await supabase.from('roles').select('id').eq('name', roleName).single()
  if (role) {
    await supabase.from('user_roles').upsert({ user_id: req.user_id, role_id: role.id, is_primary: true }, { onConflict: 'user_id,role_id' })
  }

  if (companyId) {
    const field = isSto ? 'sto_company_id' : 'parts_company_id'
    await supabase.from('user_profiles').update({ [field]: companyId }).eq('id', req.user_id)
  }

  await supabase.from('access_requests').update({ status: 'approved', company_id: companyId, reviewed_at: new Date().toISOString() }).eq('id', req.id)
}

export async function rejectAccessRequest(id: string, reason: string) {
  const { error } = await supabase.from('access_requests').update({
    status: 'rejected', rejection_reason: reason || null, reviewed_at: new Date().toISOString()
  }).eq('id', id)
  if (error) throw error
}
