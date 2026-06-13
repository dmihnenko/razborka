import { supabase } from '@/lib/supabase'

export interface ActivityLogEntry {
  id: string
  user_id: string | null
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  action: string
  detail: string | null
  created_at: string
  // Подтянутое имя пользователя (не в БД, обогащается в сервисе)
  user_name?: string | null
}

const DEFAULT_PAGE_SIZE = 50

export async function getActivityLog(
  partsCompanyId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<{ items: ActivityLogEntry[]; total: number }> {
  const page = opts?.page ?? 0
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('parts_activity_log')
    .select('*', { count: 'exact' })
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  const items = (data ?? []) as ActivityLogEntry[]

  // Подтяни имена пользователей одним запросом
  const userIds = [...new Set(items.map(i => i.user_id).filter(Boolean))] as string[]
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    const nameMap: Record<string, string> = {}
    for (const p of profiles ?? []) {
      nameMap[p.id] = p.full_name || p.email || p.id.slice(0, 8)
    }

    for (const item of items) {
      if (item.user_id) {
        item.user_name = nameMap[item.user_id] ?? item.user_id.slice(0, 8)
      }
    }
  }

  return { items, total: count ?? 0 }
}
