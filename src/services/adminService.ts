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
      safeCount(supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open')),
    ])

  return { users, activeUsers, roles, stoCompanies, partsCompanies, subscriptions, openTickets }
}
