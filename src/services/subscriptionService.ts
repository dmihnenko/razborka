import { supabase } from '@/lib/supabase'
import type { Subscription, CompanySubscription, SubscriptionStats, SubscriptionRequest } from '@/types/subscription'

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

/**
 * Обновить поля тарифного плана (без возврата строки).
 * Плоский update по id — совпадает с формой инлайн-вызова в редакторе плана
 * (в отличие от updateSubscriptionPlan, который делает .select().single()).
 */
export async function updateSubscriptionPlanFields(
  id: string,
  fields: {
    name: string
    description: string | null
    price: number
    max_vehicles: number | null
    max_parts: number | null
    max_workers: number | null
    sort_order: number
    has_analytics: boolean
  }
) {
  const { error } = await supabase
    .from('subscriptions')
    .update(fields)
    .eq('id', id)
  if (error) throw error
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
  // только АКТИВНЫЕ строки — по одной на компанию (очередь frozen/scheduled грузится отдельно)
  const { data, error } = await supabase
    .from('company_subscriptions')
    .select(`
      *,
      subscription:subscriptions(*)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Названия компаний — одним батч-запросом вместо N+1 (.single() на каждую подписку).
  const subs = (data || []) as CompanySubscription[]
  const ids = [...new Set(subs.map(s => s.company_id))]
  const { data: companies } = ids.length
    ? await supabase.from('parts_companies').select('id, name').in('id', ids)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((companies || []).map((c: { id: string; name: string }) => [c.id, c.name]))

  return subs.map(sub => ({
    ...sub,
    company: { id: sub.company_id, name: nameById.get(sub.company_id) || 'Неизвестно' },
  })) as CompanySubscription[]
}

export async function getCompanySubscription(companyType: 'parts', companyId: string) {
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

/**
 * Админ: ЕДИНОЕ действие «Применить тариф» через защищённый SECURITY DEFINER RPC
 * (is_admin-guard). Сервер сам выбирает поведение по уровню тарифа (sort_order):
 *   • нет подписки / демо  → назначить план active;
 *   • тот же тариф         → продлить срок;
 *   • апгрейд (выше)       → заморозить текущий (frozen), включить новый active;
 *   • даунгрейд (ниже)     → текущий остаётся, новый встаёт в очередь (scheduled).
 * months = null → бессрочно (для бесплатных / lifetime игнорируется).
 * Это ЕДИНСТВЕННЫЙ путь назначения — не использовать assignSubscription (delete+insert
 * ломает очередь/заморозку).
 */
export async function applyCompanySubscription(
  companyId: string,
  planId: string,
  months: number | null,
) {
  const { error } = await supabase.rpc('apply_company_subscription', {
    p_company_id: companyId,
    p_plan_id: planId,
    p_months: months,
  })
  if (error) throw error
}

export interface SubscriptionPayment {
  id: string
  company: string | null
  plan: string | null
  months: number
  amount: number
  currency: string
  provider: string
  status: string
  created_at: string
  paid_at: string | null
}

/** Админ: история платежей подписок (LiqPay + ручные назначения). */
export async function getSubscriptionPayments(limit = 100): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase.rpc('admin_get_subscription_payments', { p_limit: limit })
  if (error) throw error
  return (data ?? []) as SubscriptionPayment[]
}

export async function deactivateSubscription(id: string) {
  const { error } = await supabase
    .from('company_subscriptions')
    .update({ is_active: false, status: 'ended' })
    .eq('id', id)

  if (error) throw error
}

/**
 * Очередь компании: замороженные (frozen) и запланированные (scheduled) строки.
 * Используется детальной панелью для показа блока «Очередь».
 */
export async function getCompanyQueue(companyId: string) {
  const { data, error } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
    .eq('company_type', 'parts')
    .eq('company_id', companyId)
    .in('status', ['frozen', 'scheduled'])
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CompanySubscription[]
}

/** Отменить очередь компании: удалить все frozen/scheduled строки. */
export async function cancelCompanyQueue(companyId: string) {
  const { error } = await supabase
    .from('company_subscriptions')
    .delete()
    .eq('company_type', 'parts')
    .eq('company_id', companyId)
    .in('status', ['frozen', 'scheduled'])
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
  const { data: activeData } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
    .eq('is_active', true)
  const activeSubscriptions = (activeData ?? []) as CompanySubscription[]

  const total_active = activeSubscriptions.length
  
  const total_monthly = activeSubscriptions.filter(
    sub => sub.subscription?.type === 'monthly'
  ).length

  const total_yearly = activeSubscriptions.filter(
    sub => sub.subscription?.type === 'yearly'
  ).length

  const total_lifetime = activeSubscriptions.filter(
    sub => sub.subscription?.type === 'lifetime'
  ).length
  
  // Подсчет дохода за текущий месяц (подписки созданные в этом месяце)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data: monthData } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
    .gte('created_at', startOfMonth.toISOString())
  const monthSubscriptions = (monthData ?? []) as CompanySubscription[]

  const revenue_this_month = monthSubscriptions.reduce((sum, sub) => {
    return sum + (sub.subscription?.price || 0)
  }, 0)

  // Общий доход (все подписки)
  const { data: allData } = await supabase
    .from('company_subscriptions')
    .select('*, subscription:subscriptions(*)')
  const allSubscriptions = (allData ?? []) as CompanySubscription[]

  const revenue_total = allSubscriptions.reduce((sum, sub) => {
    return sum + (sub.subscription?.price || 0)
  }, 0)
  
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

/** Загрузка разборок (машины / запчасти) — для мониторинга в админке. */
export async function getPartsCompaniesUsage(): Promise<Record<string, { vehicles: number; parts: number }>> {
  const map: Record<string, { vehicles: number; parts: number }> = {}
  const bump = (id: string | null, key: 'vehicles' | 'parts') => {
    if (!id) return
    ;(map[id] ??= { vehicles: 0, parts: 0 })[key]++
  }
  const [veh, prt] = await Promise.all([
    supabase.from('parts_vehicles').select('parts_company_id'),
    supabase.from('parts_inventory').select('parts_company_id'),
  ])
  type CompanyIdRow = { parts_company_id: string | null }
  ;((veh.data || []) as CompanyIdRow[]).forEach(r => bump(r.parts_company_id, 'vehicles'))
  ;((prt.data || []) as CompanyIdRow[]).forEach(r => bump(r.parts_company_id, 'parts'))
  return map
}

/** Тарифы (Стандарт/Про/Макс/Персональный) для типа компании, по порядку. Демо (price=0, не custom) исключается. */
export async function getSubscriptionTiers(companyType: 'parts') {
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
export async function getActivePaidPlan(companyType: 'parts') {
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
  company_type: 'parts'
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

/** Клиент прикладывает скрин оплаты к своей заявке (+ уведомление админу в telegram). */
export async function submitPaymentProof(requestId: string, url: string, note: string) {
  const { error } = await supabase.rpc('submit_payment_proof', {
    p_request_id: requestId, p_url: url, p_note: note,
  })
  if (error) throw error
}

/** Последняя заявка компании (для показа статуса владельцу) */
export async function getMyLatestRequest(companyType: 'parts', companyId: string) {
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

  const rows = await Promise.all(((data || []) as SubscriptionRequest[]).map(async (r) => {
    const { data: c } = await supabase.from('parts_companies').select('name').eq('id', r.company_id).single()
    return { ...r, company_name: (c as { name: string | null } | null)?.name || '—' }
  }))
  return rows
}

/** Подтвердить заявку: применить тариф (через единый apply RPC) и отметить approved */
export async function approveSubscriptionRequest(id: string) {
  const { data, error } = await supabase
    .from('subscription_requests').select('*').eq('id', id).single()
  if (error) throw error
  const req = data as SubscriptionRequest

  // через единый apply RPC: сервер сам выберет назначение/продление/апгрейд/очередь
  // plan_id у одобряемой заявки всегда задан (nullable только формально в типе).
  await applyCompanySubscription(req.company_id, req.plan_id!, req.months || 1)

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

// ============================================================================
// DEFAULT PLAN FOR NEW COMPANIES (подписка по умолчанию для новых разборок)
// ============================================================================

export interface DefaultCompanyPlan {
  plan_id: string | null
  months: number | null
}

/** Текущая настройка плана по умолчанию для новых разборок (null = Демо бессрочно). */
export async function getDefaultCompanyPlan(): Promise<DefaultCompanyPlan> {
  const { data, error } = await supabase.rpc('admin_get_default_company_plan')
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as DefaultCompanyPlan | undefined
  return { plan_id: row?.plan_id ?? null, months: row?.months ?? null }
}

/** Сохранить план по умолчанию (planId=null → Демо; months=null → бессрочно). */
export async function setDefaultCompanyPlan(planId: string | null, months: number | null) {
  const { error } = await supabase.rpc('admin_set_default_company_plan', {
    p_plan_id: planId,
    p_months: months,
  })
  if (error) throw error
}
