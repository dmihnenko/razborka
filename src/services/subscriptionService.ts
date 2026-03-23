import { supabase } from '@/lib/supabase'
import type { Subscription, CompanySubscription, AssignSubscriptionInput, SubscriptionStats } from '@/types/subscription'

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

export async function getSubscriptionPlans() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })
  
  if (error) throw error
  return data as Subscription[]
}

export async function createSubscriptionPlan(plan: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(plan)
    .select()
    .single()
  
  if (error) throw error
  return data as Subscription
}

export async function updateSubscriptionPlan(id: string, updates: Partial<Subscription>) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as Subscription
}

export async function deleteSubscriptionPlan(id: string) {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================================================
// COMPANY SUBSCRIPTIONS
// ============================================================================

export async function getAllCompanySubscriptions() {
  const { data, error } = await supabase
    .from('company_subscriptions')
    .select(`
      *,
      subscription:subscriptions(*)
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
  // Загружаем названия компаний
  const subscriptions = await Promise.all((data || []).map(async (sub) => {
    let companyName = 'Неизвестно'
    
    if (sub.company_type === 'sto') {
      const { data: company } = await supabase
        .from('sto_companies')
        .select('name')
        .eq('id', sub.company_id)
        .single()
      companyName = company?.name || 'Неизвестно'
    } else if (sub.company_type === 'parts') {
      const { data: company } = await supabase
        .from('parts_companies')
        .select('name')
        .eq('id', sub.company_id)
        .single()
      companyName = company?.name || 'Неизвестно'
    }
    
    return {
      ...sub,
      company: {
        id: sub.company_id,
        name: companyName
      }
    }
  }))
  
  return subscriptions as CompanySubscription[]
}

export async function getCompanySubscription(companyType: 'sto' | 'parts', companyId: string) {
  const { data, error } = await supabase
    .from('company_subscriptions')
    .select(`
      *,
      subscription:subscriptions(*)
    `)
    .eq('company_type', companyType)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle()
  
  if (error) throw error
  return data as CompanySubscription | null
}

export async function assignSubscription(input: AssignSubscriptionInput) {
  // Remove all existing rows for this company (handles duplicates + avoids unique constraint issues)
  await supabase
    .from('company_subscriptions')
    .delete()
    .eq('company_type', input.company_type)
    .eq('company_id', input.company_id)

  // Insert fresh subscription
  const { data, error } = await supabase
    .from('company_subscriptions')
    .insert({
      company_type: input.company_type,
      company_id: input.company_id,
      subscription_id: input.subscription_id,
      start_date: input.start_date || new Date().toISOString(),
      end_date: input.end_date || null,
      is_active: true
    })
    .select(`
      *,
      subscription:subscriptions(*)
    `)
    .single()

  if (error) throw error
  return data as CompanySubscription
}

export async function deactivateSubscription(id: string) {
  const { error } = await supabase
    .from('company_subscriptions')
    .update({ is_active: false })
    .eq('id', id)
  
  if (error) throw error
}

export async function deleteCompanySubscription(id: string) {
  const { error } = await supabase
    .from('company_subscriptions')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================================================
// STATISTICS
// ============================================================================

export async function getSubscriptionStats(): Promise<SubscriptionStats> {
  // Получаем все активные подписки
  const { data: activeSubscriptions } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
    .eq('is_active', true)
  
  const total_active = activeSubscriptions?.length || 0
  
  const total_monthly = activeSubscriptions?.filter(
    sub => sub.subscription?.type === 'monthly'
  ).length || 0
  
  const total_lifetime = activeSubscriptions?.filter(
    sub => sub.subscription?.type === 'lifetime'
  ).length || 0
  
  // Подсчет дохода за текущий месяц (подписки созданные в этом месяце)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data: monthSubscriptions } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
    .gte('created_at', startOfMonth.toISOString())
  
  const revenue_this_month = monthSubscriptions?.reduce((sum, sub) => {
    return sum + (sub.subscription?.price || 0)
  }, 0) || 0
  
  // Общий доход (все подписки)
  const { data: allSubscriptions } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
  
  const revenue_total = allSubscriptions?.reduce((sum, sub) => {
    return sum + (sub.subscription?.price || 0)
  }, 0) || 0
  
  return {
    total_active,
    total_monthly,
    total_lifetime,
    revenue_this_month,
    revenue_total
  }
}

// ============================================================================
// COMPANIES FOR ASSIGNMENT
// ============================================================================

export async function getStoCompanies() {
  const { data, error } = await supabase
    .from('sto_companies')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')
  
  if (error) throw error
  return data
}

export async function getPartsCompanies() {
  const { data, error } = await supabase
    .from('parts_companies')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name')
  
  if (error) throw error
  return data
}
