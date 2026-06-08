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

export interface CompanyDetail {
  company: CompanyInfo
  stats: CompanyStat[]
}

// ── СТО ──────────────────────────────────────────────────────────────────────
export async function fetchStoCompanyDetail(companyId: string): Promise<CompanyDetail> {
  const [companyRes, workers, appointments, customers, vehicles, workOrders, services] = await Promise.all([
    supabase.from('sto_companies').select('id, name, phone, address, email, is_active').eq('id', companyId).single(),
    countRows('user_profiles', 'sto_company_id', companyId),
    countRows('appointments', 'sto_company_id', companyId),
    countRows('customers', 'sto_company_id', companyId),
    countRows('vehicles', 'sto_company_id', companyId),
    countRows('work_orders', 'sto_company_id', companyId),
    countRows('services', 'sto_company_id', companyId),
  ])
  if (companyRes.error) throw companyRes.error
  return {
    company: companyRes.data as CompanyInfo,
    stats: [
      { key: 'appointments', label: 'Заявки', value: appointments },
      { key: 'customers', label: 'Клиенты', value: customers },
      { key: 'vehicles', label: 'Автомобили', value: vehicles },
      { key: 'workOrders', label: 'Наряды', value: workOrders },
      { key: 'services', label: 'Услуги', value: services },
      { key: 'workers', label: 'Сотрудники', value: workers },
    ],
  }
}

// ── Разборка ─────────────────────────────────────────────────────────────────
export async function fetchPartsCompanyDetail(companyId: string): Promise<CompanyDetail> {
  const [companyRes, workers, partsVehicles, inventory, orders, customers] = await Promise.all([
    supabase.from('parts_companies').select('id, name, phone, address, email, is_active').eq('id', companyId).single(),
    countRows('user_profiles', 'parts_company_id', companyId),
    countRows('parts_vehicles', 'parts_company_id', companyId),
    countRows('parts_inventory', 'parts_company_id', companyId),
    countRows('parts_orders', 'parts_company_id', companyId),
    countRows('parts_customers', 'parts_company_id', companyId),
  ])
  if (companyRes.error) throw companyRes.error
  return {
    company: companyRes.data as CompanyInfo,
    stats: [
      { key: 'inventory', label: 'Запчасти', value: inventory },
      { key: 'partsVehicles', label: 'Авто на разборке', value: partsVehicles },
      { key: 'orders', label: 'Заказы', value: orders },
      { key: 'customers', label: 'Клиенты', value: customers },
      { key: 'workers', label: 'Сотрудники', value: workers },
    ],
  }
}
