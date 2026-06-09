import { supabase } from '@/lib/supabase'

async function countRows(table: string, col: string, id: string): Promise<number> {
  try {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, id)
    return count || 0
  } catch {
    return 0
  }
}

export interface CompanyInfo {
  id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  is_active: boolean
}

export interface CompanyStat {
  key: string
  label: string
  value: number
}

export interface CompanyWorker {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean
}

export interface CompanySubscriptionInfo {
  name: string
  type: string | null
}

export interface CompanyDetail {
  company: CompanyInfo
  stats: CompanyStat[]
  workers: CompanyWorker[]
  subscription: CompanySubscriptionInfo | null
}

async function fetchWorkers(col: string, id: string): Promise<CompanyWorker[]> {
  // Активные (не в корзине) сотрудники компании
  let q = supabase.from('user_profiles').select('id, full_name, email, is_active').eq(col, id)
  let { data, error } = await q.is('deleted_at', null)
  if (error && ((error as any).code === '42703' || /deleted_at/i.test(error.message))) {
    ;({ data } = await supabase.from('user_profiles').select('id, full_name, email, is_active').eq(col, id))
  }
  return (data as CompanyWorker[]) || []
}

async function fetchSubscription(companyType: 'sto' | 'parts', id: string): Promise<CompanySubscriptionInfo | null> {
  try {
    const { data } = await supabase
      .from('company_subscriptions')
      .select('subscription:subscriptions(name, type)')
      .eq('company_type', companyType)
      .eq('company_id', id)
      .eq('is_active', true)
      .maybeSingle()
    const s = (data as any)?.subscription
    return s ? { name: s.name, type: s.type ?? null } : null
  } catch {
    return null
  }
}

export async function setCompanyActive(kind: 'sto' | 'parts', id: string, isActive: boolean): Promise<void> {
  const table = kind === 'sto' ? 'sto_companies' : 'parts_companies'
  const { error } = await supabase.from(table).update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

// ── СТО ──────────────────────────────────────────────────────────────────────
export async function fetchStoCompanyDetail(companyId: string): Promise<CompanyDetail> {
  const [companyRes, workersList, subscription, appointments, customers, vehicles, workOrders, services] = await Promise.all([
    supabase.from('sto_companies').select('id, name, phone, address, email, is_active').eq('id', companyId).single(),
    fetchWorkers('sto_company_id', companyId),
    fetchSubscription('sto', companyId),
    countRows('appointments', 'sto_company_id', companyId),
    countRows('customers', 'sto_company_id', companyId),
    countRows('vehicles', 'sto_company_id', companyId),
    countRows('work_orders', 'sto_company_id', companyId),
    countRows('services', 'sto_company_id', companyId),
  ])
  if (companyRes.error) throw companyRes.error
  return {
    company: companyRes.data as CompanyInfo,
    workers: workersList,
    subscription,
    stats: [
      { key: 'appointments', label: 'Заявки', value: appointments },
      { key: 'customers', label: 'Клиенты', value: customers },
      { key: 'vehicles', label: 'Автомобили', value: vehicles },
      { key: 'workOrders', label: 'Наряды', value: workOrders },
      { key: 'services', label: 'Услуги', value: services },
      { key: 'workers', label: 'Сотрудники', value: workersList.length },
    ],
  }
}

// ── Разборка ─────────────────────────────────────────────────────────────────
export async function fetchPartsCompanyDetail(companyId: string): Promise<CompanyDetail> {
  const [companyRes, workersList, subscription, partsVehicles, inventory, orders, customers] = await Promise.all([
    supabase.from('parts_companies').select('id, name, phone, address, email, is_active').eq('id', companyId).single(),
    fetchWorkers('parts_company_id', companyId),
    fetchSubscription('parts', companyId),
    countRows('parts_vehicles', 'parts_company_id', companyId),
    countRows('parts_inventory', 'parts_company_id', companyId),
    countRows('parts_orders', 'parts_company_id', companyId),
    countRows('parts_customers', 'parts_company_id', companyId),
  ])
  if (companyRes.error) throw companyRes.error
  return {
    company: companyRes.data as CompanyInfo,
    workers: workersList,
    subscription,
    stats: [
      { key: 'inventory', label: 'Запчасти', value: inventory },
      { key: 'partsVehicles', label: 'Авто на разборке', value: partsVehicles },
      { key: 'orders', label: 'Заказы', value: orders },
      { key: 'customers', label: 'Клиенты', value: customers },
      { key: 'workers', label: 'Сотрудники', value: workersList.length },
    ],
  }
}
