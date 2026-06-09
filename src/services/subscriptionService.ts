import { supabase } from '@/lib/supabase'
import type { Subscription, CompanySubscription, AssignSubscriptionInput, SubscriptionStats, SubscriptionRequest } from '@/types/subscription'

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

  const total_yearly = activeSubscriptions?.filter(
    sub => sub.subscription?.type === 'yearly'
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
    total_yearly,
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

// ============================================================================
// PAID PLAN HELPER
// ============================================================================

/** Загрузка СТО-компаний (заявки в этом месяце / клиенты / механики) — для мониторинга в админке. Несколько батч-запросов. */
export async function getStoCompaniesUsage(): Promise<Record<string, { appointments: number; customers: number; workers: number }>> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const map: Record<string, { appointments: number; customers: number; workers: number }> = {}
  const bump = (id: string | null, key: 'appointments' | 'customers' | 'workers') => {
    if (!id) return
    ;(map[id] ??= { appointments: 0, customers: 0, workers: 0 })[key]++
  }

  const [appts, custs, workerRole] = await Promise.all([
    supabase.from('appointments').select('sto_company_id').gte('created_at', startOfMonth.toISOString()),
    supabase.from('customers').select('sto_company_id'),
    supabase.from('roles').select('id').eq('name', 'sto_worker').single(),
  ])
  ;(appts.data || []).forEach((r: any) => bump(r.sto_company_id, 'appointments'))
  ;(custs.data || []).forEach((r: any) => bump(r.sto_company_id, 'customers'))

  if (workerRole.data) {
    const { data: wr } = await supabase.from('user_roles').select('user_id').eq('role_id', workerRole.data.id)
    const ids = (wr || []).map((x: any) => x.user_id)
    if (ids.length) {
      const { data: profs } = await supabase.from('user_profiles').select('sto_company_id').in('id', ids)
      ;(profs || []).forEach((p: any) => bump(p.sto_company_id, 'workers'))
    }
  }
  return map
}

/** Тарифы (Стандарт/Про/Макс/Персональный) для типа компании, по порядку. Демо (price=0, не custom) исключается. */
export async function getSubscriptionTiers(companyType: 'sto' | 'parts') {
  // Сортировку по sort_order делаем на клиенте — колонки может ещё не быть в проде (prod отстаёт от репо)
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('company_type', companyType)
    .eq('is_active', true)
    .order('price', { ascending: true })
  if (error) throw error
  return (data as Subscription[])
    .filter(p => p.price > 0 || p.is_custom)
    .sort((a, b) => (a.sort_order ?? a.price) - (b.sort_order ?? b.price))
}

/** Активный платный месячный план для типа компании (канонический «Подписка …») */
export async function getActivePaidPlan(companyType: 'sto' | 'parts') {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('company_type', companyType)
    .eq('type', 'monthly')
    .eq('is_active', true)
    .gt('price', 0)
    .order('price', { ascending: true })
    .limit(1)
  if (error) throw error
  return (data?.[0] ?? null) as Subscription | null
}

// ============================================================================
// SUBSCRIPTION REQUESTS (заявки владельцев → подтверждение админом)
// ============================================================================

export async function createSubscriptionRequest(input: {
  company_type: 'sto' | 'parts'
  company_id: string
  plan_id: string
  months: number
  note?: string
}) {
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('subscription_requests').insert({
    company_type: input.company_type,
    company_id: input.company_id,
    plan_id: input.plan_id,
    months: input.months,
    note: input.note || null,
    requested_by: u?.user?.id ?? null,
    status: 'pending',
  })
  if (error) throw error
}

/** Последняя заявка компании (для показа статуса владельцу) */
export async function getMyLatestRequest(companyType: 'sto' | 'parts', companyId: string) {
  const { data, error } = await supabase
    .from('subscription_requests')
    .select('*')
    .eq('company_type', companyType)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as SubscriptionRequest | null
}

/** Список заявок для админа (по умолчанию — ожидающие), с названием компании */
export async function getSubscriptionRequests(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') {
  let q = supabase
    .from('subscription_requests')
    .select('*, plan:subscriptions(name, type)')
    .order('created_at', { ascending: false })
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error

  const rows = await Promise.all((data || []).map(async (r: any) => {
    const tbl = r.company_type === 'sto' ? 'sto_companies' : 'parts_companies'
    const { data: c } = await supabase.from(tbl).select('name').eq('id', r.company_id).single()
    return { ...r, company_name: c?.name || '—' }
  }))
  return rows as SubscriptionRequest[]
}

/** Подтвердить заявку: назначить подписку на выбранный срок и отметить approved */
export async function approveSubscriptionRequest(id: string) {
  const { data: req, error } = await supabase
    .from('subscription_requests').select('*').eq('id', id).single()
  if (error) throw error

  const end = new Date()
  end.setMonth(end.getMonth() + (req.months || 1))

  await assignSubscription({
    company_type: req.company_type,
    company_id: req.company_id,
    subscription_id: req.plan_id,
    start_date: new Date().toISOString(),
    end_date: end.toISOString(),
  })

  const { data: u } = await supabase.auth.getUser()
  const { error: uerr } = await supabase
    .from('subscription_requests')
    .update({ status: 'approved', processed_at: new Date().toISOString(), processed_by: u?.user?.id ?? null })
    .eq('id', id)
  if (uerr) throw uerr
}

export async function rejectSubscriptionRequest(id: string, note?: string) {
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('subscription_requests')
    .update({ status: 'rejected', note: note || null, processed_at: new Date().toISOString(), processed_by: u?.user?.id ?? null })
    .eq('id', id)
  if (error) throw error
}
