import { supabase } from '@/lib/supabase'

export interface MonthPoint {
  month: string          // 'YYYY-MM'
  label: string          // 'июн'
  users: number
  orders: number
}

export interface RoleSlice {
  name: string
  value: number
}

export interface PlatformAnalytics {
  series: MonthPoint[]
  roles: RoleSlice[]
  totals: { users: number; orders: number }
}

/** Строка user_roles с вложенным join roles(display_name) */
interface RoleRow {
  roles?: { display_name: string | null } | null
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function fetchCreatedAt(table: string, sinceISO: string): Promise<string[]> {
  try {
    const { data } = await supabase.from(table).select('created_at').gte('created_at', sinceISO)
    return ((data || []) as { created_at: string | null }[])
      .map(r => r.created_at)
      .filter((v): v is string => Boolean(v))
  } catch {
    return []
  }
}

/** Платформенная аналитика за последние `months` месяцев (агрегация по месяцам). */
export async function fetchPlatformAnalytics(months: number): Promise<PlatformAnalytics> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const sinceISO = start.toISOString()

  const [usersAt, ordersAt, roleRows] = await Promise.all([
    fetchCreatedAt('user_profiles', sinceISO),
    fetchCreatedAt('parts_orders', sinceISO),
    (async (): Promise<RoleRow[]> => {
      try {
        const { data } = await supabase.from('user_roles').select('roles(display_name)')
        // supabase выводит join roles как массив, но FK role_id даёт единичный объект —
        // приводим к фактической форме RoleRow (одиночный roles), как использует код ниже.
        return (data ?? []) as unknown as RoleRow[]
      } catch { return [] }
    })(),
  ])

  // Каркас месяцев
  const buckets: Record<string, MonthPoint> = {}
  const orderedKeys: string[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = monthKey(d)
    orderedKeys.push(key)
    buckets[key] = { month: key, label: MONTHS_SHORT[d.getMonth()], users: 0, orders: 0 }
  }

  const add = (iso: string, field: 'users' | 'orders') => {
    const key = monthKey(new Date(iso))
    if (buckets[key]) buckets[key][field]++
  }
  usersAt.forEach(d => add(d, 'users'))
  ordersAt.forEach(d => add(d, 'orders'))

  // Распределение по ролям
  const roleMap: Record<string, number> = {}
  roleRows.forEach(r => {
    const name = r.roles?.display_name || 'Без роли'
    roleMap[name] = (roleMap[name] || 0) + 1
  })
  const roles = Object.entries(roleMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return {
    series: orderedKeys.map(k => buckets[k]),
    roles,
    totals: { users: usersAt.length, orders: ordersAt.length },
  }
}
