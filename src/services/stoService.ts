import { supabase } from '../lib/supabase'

// ─── Ставка нормо-часа ────────────────────────────────────────────

/** Ставка нормо-часа компании (₴/н·ч). 0, если не задана / колонки ещё нет. */
export async function fetchStoLaborRate(stoCompanyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('sto_companies')
    .select('labor_rate')
    .eq('id', stoCompanyId)
    .single()
  if (error) return 0 // колонка может отсутствовать на отстающем проде
  return Number(data?.labor_rate) || 0
}

/** Обновить ставку нормо-часа компании. */
export async function updateStoLaborRate(stoCompanyId: string, rate: number): Promise<void> {
  const { error } = await supabase
    .from('sto_companies')
    .update({ labor_rate: rate })
    .eq('id', stoCompanyId)
  if (error) throw error
}

export type CatalogWorkMode = 'price' | 'norm_hours'

/** Режим каталога работ + ставка. mode: 'price' (цена) | 'norm_hours' (нормо-часы × ставку). */
export async function fetchStoCatalogSettings(stoCompanyId: string): Promise<{ mode: CatalogWorkMode; rate: number }> {
  const { data, error } = await supabase
    .from('sto_companies')
    .select('catalog_work_mode, labor_rate')
    .eq('id', stoCompanyId)
    .single()
  if (error) return { mode: 'price', rate: 0 }
  return {
    mode: data?.catalog_work_mode === 'norm_hours' ? 'norm_hours' : 'price',
    rate: Number(data?.labor_rate) || 0,
  }
}

/** Обновить режим каталога работ компании. */
export async function updateStoCatalogMode(stoCompanyId: string, mode: CatalogWorkMode): Promise<void> {
  const { error } = await supabase
    .from('sto_companies')
    .update({ catalog_work_mode: mode })
    .eq('id', stoCompanyId)
  if (error) throw error
}

// ─── STO Companies ────────────────────────────────────────────────

export interface StoCompany {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  description: string | null
  is_active: boolean
  created_at: string
  workers_count?: number
  subscription?: {
    id: string
    type: string
    end_date: string | null
  }
}

export interface StoFormData {
  name: string
  address: string
  phone: string
  email: string
  description: string
}

export async function fetchStoCompanies(): Promise<StoCompany[]> {
  const { data, error } = await supabase
    .from('sto_companies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Получаем id роли admin чтобы исключить администраторов из подсчёта
  const { data: adminRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'admin')
    .single()

  const { data: adminUserRoles } = adminRole
    ? await supabase.from('user_roles').select('user_id').eq('role_id', adminRole.id)
    : { data: [] }

  const adminIds = (adminUserRoles ?? []).map((r: { user_id: string }) => r.user_id)

  const companiesWithWorkers = await Promise.all((data || []).map(async (company) => {
    let query = supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('sto_company_id', company.id)
      .eq('is_active', true)

    if (adminIds.length > 0) {
      query = query.not('id', 'in', `(${adminIds.join(',')})`)
    }

    const { count } = await query
    const workersCount = count || 0

    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('id, subscription_id, end_date, subscription:subscriptions(type)')
      .eq('company_type', 'sto')
      .eq('company_id', company.id)
      .eq('is_active', true)
      .maybeSingle()

    return {
      ...company,
      workers_count: workersCount,
      subscription: subscription
        ? {
            id: subscription.id,
            type: (subscription.subscription as any)?.type || '',
            end_date: subscription.end_date,
          }
        : undefined,
    }
  }))

  return companiesWithWorkers as StoCompany[]
}

export async function createStoCompany(data: StoFormData): Promise<void> {
  const { error } = await supabase.from('sto_companies').insert({
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
    email: data.email || null,
    description: data.description || null,
    is_active: true,
  })
  if (error) throw error
}

export async function updateStoCompany(id: string, data: StoFormData): Promise<void> {
  const { error } = await supabase
    .from('sto_companies')
    .update({
      name: data.name,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      description: data.description || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteStoCompany(id: string): Promise<void> {
  const { error } = await supabase.from('sto_companies').delete().eq('id', id)
  if (error) throw error
}

export async function toggleStoCompanyActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('sto_companies')
    .update({ is_active: !isActive })
    .eq('id', id)
  if (error) throw error
}

// ─── STO Employees ────────────────────────────────────────────────

export interface StoEmployee {
  id: string
  full_name: string | null
  username: string | null
  email: string
  phone: string | null
  created_at: string
}

export async function fetchStoEmployees(stoCompanyId: string): Promise<StoEmployee[]> {
  const { data: roleData, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'sto_worker')
    .single()

  if (roleError) throw roleError
  if (!roleData) return []

  const { data: userRolesData, error: userRolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleData.id)

  if (userRolesError) throw userRolesError

  const userIds = userRolesData?.map((ur: { user_id: string }) => ur.user_id) || []
  if (userIds.length === 0) return []

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('sto_company_id', stoCompanyId)
    .eq('is_active', true)
    .in('id', userIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as StoEmployee[]
}

export interface EmployeeMonthlyStat {
  closedCount: number
  workSum: number
}

/** Статистика мастеров за месяц: закрытых заявок и сумма по работам.
 *  Закрытыми считаем archived/completed; месяц определяем по closed_date → completed_at → scheduled_date. */
export async function fetchEmployeeMonthlyStats(
  stoCompanyId: string,
  year: number,
  month: number, // 0-based (как Date.getMonth())
): Promise<Record<string, EmployeeMonthlyStat>> {
  const { data, error } = await supabase
    .from('appointments')
    .select('assigned_to, total_work_cost, status, closed_date, completed_at, scheduled_date')
    .eq('sto_company_id', stoCompanyId)
    .in('status', ['archived', 'completed'])

  if (error) throw error

  const stats: Record<string, EmployeeMonthlyStat> = {}
  for (const a of (data || []) as any[]) {
    if (!a.assigned_to) continue
    const ds = a.closed_date || a.completed_at || a.scheduled_date
    if (!ds) continue
    const d = new Date(ds)
    if (isNaN(d.getTime())) continue
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    const s = stats[a.assigned_to] || (stats[a.assigned_to] = { closedCount: 0, workSum: 0 })
    s.closedCount += 1
    s.workSum += Number(a.total_work_cost) || 0
  }
  return stats
}

// ─── Дашборд: уведомления ─────────────────────────────────────────

export interface ReadyUnpaidAlert {
  id: string
  customerName: string
  total: number
  hasInvoice: boolean // счёт выставлен, но не оплачен (true) | счёт не выставлен (false)
}
export interface TomorrowAlert {
  id: string
  customerName: string
  phone: string | null
  time: string
  vehicle: string
  remindedAt: string | null
  dateLabel: string // «Сегодня» | «Завтра»
}

/** Отметить, что клиенту отправлено напоминание по записи. */
export async function markAppointmentReminded(appointmentId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ reminded_at: new Date().toISOString() })
    .eq('id', appointmentId)
  if (error) throw error
}

/** Готовые заявки, требующие оплаты, и записи на завтра (для напоминания клиентам). */
export async function fetchStoAlerts(stoCompanyId: string): Promise<{
  readyUnpaid: ReadyUnpaidAlert[]
  tomorrow: TomorrowAlert[]
}> {
  // Готовые/завершённые заявки (работа сделана — нужен счёт/оплата)
  const { data: ready } = await supabase
    .from('appointments')
    .select('id, total_cost, total_work_cost, total_parts_cost, parts_cost, parts_paid, work_paid, customers(name)')
    .eq('sto_company_id', stoCompanyId)
    .in('status', ['ready', 'completed'])

  const readyRows = (ready || []) as any[]
  const notPaid = readyRows.filter(a => {
    const hasParts = ((a.parts_cost || a.total_parts_cost) || 0) > 0
    const hasWork = (a.total_work_cost || 0) > 0
    return (hasParts && !a.parts_paid) || (hasWork && !a.work_paid)
  })

  // Какие из них уже имеют выставленный счёт
  let invoicedSet = new Set<string>()
  if (notPaid.length > 0) {
    const { data: invs } = await supabase
      .from('sto_invoices')
      .select('appointment_id, status')
      .in('appointment_id', notPaid.map(a => a.id))
    invoicedSet = new Set((invs || []).filter((i: any) => i.appointment_id).map((i: any) => i.appointment_id))
  }

  const readyUnpaid: ReadyUnpaidAlert[] = notPaid.map(a => ({
    id: a.id,
    customerName: a.customers?.name || 'Без клиента',
    total: (Number(a.total_work_cost) || 0) + (Number(a.parts_cost ?? a.total_parts_cost) || 0),
    hasInvoice: invoicedSet.has(a.id),
  }))

  // Записи на сегодня и завтра (локальные даты YYYY-MM-DD, формат как в scheduled_date)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmtDay = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
  const t0 = new Date()
  const t1 = new Date(); t1.setDate(t1.getDate() + 1)
  const t2 = new Date(); t2.setDate(t2.getDate() + 2)
  const dayToday = fmtDay(t0)
  const dayTomorrow = fmtDay(t1)
  const dayAfter = fmtDay(t2)

  const { data: tomo } = await supabase
    .from('appointments')
    .select('id, scheduled_date, customers(name, phone), vehicles(brand, model)')
    .eq('sto_company_id', stoCompanyId)
    .gte('scheduled_date', `${dayToday}T00:00`)
    .lt('scheduled_date', `${dayAfter}T00:00`)
    .not('status', 'in', '("archived","cancelled","deleted","pending_deletion")')
    .order('scheduled_date', { ascending: true })

  const tomoRows = ((tomo || []) as any[]).filter(a => {
    const s = String(a.scheduled_date || '')
    return s.startsWith(dayToday) || s.startsWith(dayTomorrow)
  })

  // reminded_at — отдельным запросом (колонка может отсутствовать до миграции; ошибку игнорируем)
  const remindedMap: Record<string, string> = {}
  if (tomoRows.length) {
    const { data: rem } = await supabase
      .from('appointments')
      .select('id, reminded_at')
      .in('id', tomoRows.map(a => a.id))
    for (const r of (rem || []) as any[]) if (r.reminded_at) remindedMap[r.id] = r.reminded_at
  }

  const tomorrow: TomorrowAlert[] = tomoRows.map(a => ({
    id: a.id,
    customerName: a.customers?.name || 'Без клиента',
    phone: a.customers?.phone || null,
    time: (a.scheduled_date?.match(/T(\d{2}:\d{2})/) || [])[1] || '',
    vehicle: a.vehicles ? `${a.vehicles.brand || ''} ${a.vehicles.model || ''}`.trim() : '',
    remindedAt: remindedMap[a.id] || null,
    dateLabel: String(a.scheduled_date || '').startsWith(dayToday) ? 'Сегодня' : 'Завтра',
  }))

  return { readyUnpaid, tomorrow }
}

export async function createStoEmployee(
  formData: { username: string; password: string; full_name: string; phone: string },
  stoCompanyId: string
): Promise<void> {
  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('username', formData.username)
    .maybeSingle()

  if (existingUser) {
    throw new Error(`Пользователь с логином "${formData.username}" уже существует`)
  }

  const email = `${formData.username}@internal.tsp.local`

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: formData.password,
  })

  if (authError) {
    if (
      authError.message.includes('already registered') ||
      authError.message.includes('User already registered')
    ) {
      throw new Error('Email уже зарегистрирован. Попробуйте другой логин.')
    }
    throw new Error(authError.message || 'Ошибка создания пользователя')
  }

  if (!authData.user) {
    throw new Error('Не удалось создать пользователя')
  }

  const userId = authData.user.id

  const { error: profileError } = await supabase.from('user_profiles').upsert({
    id: userId,
    username: formData.username,
    full_name: formData.full_name || null,
    phone: formData.phone || null,
    sto_company_id: stoCompanyId || null,
    parts_company_id: null,
    email,
    is_active: true,
  })

  if (profileError) throw profileError

  const { data: roleData } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'sto_worker')
    .single()

  if (!roleData) throw new Error('Role not found')

  const { error: roleError } = await supabase.from('user_roles').upsert(
    { user_id: userId, role_id: roleData.id, is_primary: true },
    { onConflict: 'user_id,role_id' }
  )

  if (roleError) throw roleError
}

export async function deactivateStoEmployee(employeeId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ is_active: false })
    .eq('id', employeeId)
  if (error) throw error
}

export async function updateStoEmployeeName(
  employeeId: string,
  fullName: string
): Promise<void> {
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ full_name: fullName })
    .eq('id', employeeId)
  if (profileError) throw profileError

  const { error: appointmentsError } = await supabase
    .from('appointments')
    .update({ assigned_to_name: fullName })
    .eq('assigned_to', employeeId)
    .neq('status', 'archived')
    .neq('status', 'completed')
    .neq('status', 'cancelled')
  if (appointmentsError) throw appointmentsError
}

export async function bulkAssignAppointments(
  workerId: string,
  workerName: string | null
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ assigned_to: workerId, assigned_to_name: workerName })
    .is('assigned_to', null)
  if (error) throw error
}

export async function fetchStoClientStats(stoCompanyId: string): Promise<{ customers: number; vehicles: number }> {
  const [{ count: customers }, { count: vehicles }] = await Promise.all([
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('sto_company_id', stoCompanyId),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('sto_company_id', stoCompanyId),
  ])
  return { customers: customers || 0, vehicles: vehicles || 0 }
}
