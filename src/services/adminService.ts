import { supabase } from '../lib/supabase'

export interface AdminStats {
  users: number
  activeUsers: number
  roles: number
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
  const [users, activeUsers, roles, partsCompanies, subscriptions, openTickets] =
    await Promise.all([
      safeCount(supabase.from('user_profiles').select('*', { count: 'exact', head: true })),
      safeCount(supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('roles').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('parts_companies').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('company_subscriptions').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      safeCount(supabase.from('support_chats').select('*', { count: 'exact', head: true }).eq('status', 'open')),
    ])

  return { users, activeUsers, roles, partsCompanies, subscriptions, openTickets }
}

export async function fetchAccessRequests(filter: string) {
  // user_id ссылается на auth.users, поэтому встроенный join user_profiles недоступен —
  // тянем профили отдельным запросом и сшиваем.
  let q = supabase
    .from('access_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (filter !== 'all') q = (q as any).eq('status', filter)
  const { data, error } = await q
  if (error) throw error

  const rows = data || []
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))]
  let profiles: Record<string, any> = {}
  if (userIds.length) {
    const { data: profs } = await supabase
      .from('user_profiles')
      .select('id, full_name, username, email')
      .in('id', userIds)
    profiles = Object.fromEntries((profs || []).map((p: any) => [p.id, p]))
  }
  return rows.map((r: any) => ({ ...r, user: profiles[r.user_id] || null }))
}

export async function approveAccessRequest(req: any) {
  const isOwner = req.request_type === 'parts_owner'
  const isWorker = req.request_type === 'parts_worker'
  let companyId: string | null = null

  if (isOwner) {
    const { data: company, error } = await supabase.from('parts_companies')
      .insert({ name: req.company_name, address: req.company_address || null, phone: req.company_phone || null, is_active: true })
      .select('id').single()
    if (error) throw error
    companyId = company.id
  }

  if (isWorker) {
    const { data: companies } = await supabase.from('parts_companies').select('id').eq('phone', req.owner_phone)
    if (!companies?.length) throw new Error('Компания с таким телефоном не найдена')
    companyId = companies[0].id
  }

  const roleName = req.request_type
  const { data: role } = await supabase.from('roles').select('id').eq('name', roleName).single()
  if (role) {
    await supabase.from('user_roles').upsert({ user_id: req.user_id, role_id: role.id, is_primary: true }, { onConflict: 'user_id,role_id' })
  }

  if (companyId) {
    await supabase.from('user_profiles').update({ parts_company_id: companyId }).eq('id', req.user_id)
  }

  await supabase.from('access_requests').update({ status: 'approved', company_id: companyId, reviewed_at: new Date().toISOString() }).eq('id', req.id)

  // Уведомить владельца об одобрении (только для parts_owner)
  if (isOwner) {
    try {
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        type: 'success',
        title: 'Авторазборка создана',
        body: `Ваша заявка одобрена — авторазборка «${req.company_name}» готова к работе.`,
        link: '/parts/dashboard',
      })
    } catch (e) {
      console.error('approveAccessRequest: не удалось вставить уведомление', e)
    }
  }
}

export async function rejectAccessRequest(id: string, reason: string) {
  const { error } = await supabase.from('access_requests').update({
    status: 'rejected', rejection_reason: reason || null, reviewed_at: new Date().toISOString()
  }).eq('id', id)
  if (error) throw error
}

// ── Каталог авто (car_models): модерация заявок на марки/модели ─────────────

export interface CarModelRow {
  id: string
  make: string
  model: string
  sort_order: number
  is_active: boolean
  status: 'approved' | 'pending' | 'rejected'
  suggested_by: string | null
  parts_company_id: string | null
  rejection_reason: string | null
  year_from: number | null
  year_to: number | null
  standard_categories: string[] | null
  created_at: string
}

export interface ApproveCarModelInput {
  id: string
  make: string
  model: string
  yearFrom?: number | null
  yearTo?: number | null
  categories?: string[] | null
}

/** Список моделей каталога по статусу (admin). filter: pending|approved|rejected|all */
export async function fetchCarModels(filter: string): Promise<CarModelRow[]> {
  let q = supabase
    .from('car_models')
    .select('id, make, model, sort_order, is_active, status, suggested_by, parts_company_id, rejection_reason, year_from, year_to, standard_categories, created_at')
    .order('status', { ascending: true })
    .order('make', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('model', { ascending: true })
  if (filter !== 'all') q = (q as any).eq('status', filter)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as CarModelRow[]
}

/**
 * Утвердить заявку: правит написание марки/модели, задаёт года и стандартные категории.
 * Серверный RPC нормализует авто разборок к утверждённому написанию и сливает дубли.
 */
export async function approveCarModel(input: ApproveCarModelInput): Promise<void> {
  const { error } = await supabase.rpc('approve_car_model', {
    p_id: input.id,
    p_make: input.make,
    p_model: input.model,
    p_year_from: input.yearFrom ?? null,
    p_year_to: input.yearTo ?? null,
    p_categories: input.categories ?? null,
  })
  if (error) throw error
}

/** Отклонить заявку на модель. */
export async function rejectCarModel(id: string, reason?: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('car_models').update({
    status: 'rejected', is_active: false, rejection_reason: reason?.trim() || null,
    reviewed_at: new Date().toISOString(), reviewed_by: auth?.user?.id ?? null,
  }).eq('id', id)
  if (error) throw error
}

/** Админ добавляет модель в каталог напрямую (сразу approved). */
export async function addCarModel(make: string, model: string, sortOrder = 0): Promise<void> {
  const mk = make.trim()
  const md = model.trim()
  if (!mk || !md) throw new Error('Укажите марку и модель')
  const { error } = await supabase.from('car_models').upsert(
    { make: mk, model: md, sort_order: sortOrder, is_active: true, status: 'approved' },
    { onConflict: 'make,model' }
  )
  if (error) throw error
}

/** Включить/выключить модель в каталоге. */
export async function setCarModelActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('car_models').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
