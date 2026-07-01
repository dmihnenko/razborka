import { supabase } from '@/lib/supabase'
import type { Tariff, PartsApplicationInput, PartsApplication } from '@/types/business'

/** Строка subscriptions из БД (snake_case) — выбранные в getPublicTariffs колонки */
interface SubscriptionRow {
  id: string
  name: string
  price: number
  description: string | null
  max_vehicles: number | null
  max_parts: number | null
  max_workers: number | null
  has_analytics: boolean | null
  is_custom: boolean | null
  sort_order: number | null
}

export async function getPublicTariffs(): Promise<Tariff[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id,name,price,description,max_vehicles,max_parts,max_workers,has_analytics,is_custom,sort_order')
    .eq('company_type', 'parts')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  return ((data || []) as SubscriptionRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    description: row.description ?? null,
    maxVehicles: row.max_vehicles ?? null,
    maxParts: row.max_parts ?? null,
    maxWorkers: row.max_workers ?? null,
    hasAnalytics: row.has_analytics ?? false,
    isCustom: row.is_custom ?? false,
    sortOrder: row.sort_order ?? 0,
  }))
}

/** Нормализация телефона — как в WaitingAccessPage */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 10 ? `+38${digits}` : `+${digits}`
}

export async function submitPartsApplication(
  userId: string,
  input: PartsApplicationInput,
): Promise<void> {
  const phone = normalizePhone(input.phone)

  const { error } = await supabase.from('access_requests').insert({
    user_id: userId,
    request_type: 'parts_owner',
    status: 'pending',
    company_name: input.companyName,
    company_address: input.address || null,
    company_phone: phone,
    owner_phone: phone,
    owner_name: `${input.ownerFirstName} ${input.ownerLastName}`.trim(),
    vehicle_makes: input.vehicleMakes.join(', '),
  })

  if (error) throw error
}

export async function selfProvisionPartsCompany(input: {
  companyName: string
  address?: string
  phone?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('self_provision_parts_company', {
    p_company_name: input.companyName,
    p_address: input.address ?? null,
    p_phone: input.phone ? normalizePhone(input.phone) : null,
  })
  if (error) throw error
  return data as string
}

export async function getMyPartsApplication(
  userId: string,
): Promise<PartsApplication | null> {
  const { data, error } = await supabase
    .from('access_requests')
    .select('id,status,company_name,created_at,rejection_reason')
    .eq('user_id', userId)
    .eq('request_type', 'parts_owner')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    status: data.status as 'pending' | 'approved' | 'rejected',
    companyName: data.company_name ?? '',
    createdAt: data.created_at,
    rejectionReason: data.rejection_reason ?? undefined,
  }
}
