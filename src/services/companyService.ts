import { supabase } from '../lib/supabase'

export interface Company {
  id: string
  name: string
}

export interface CreateCompanyParams {
  type: 'parts'
  name: string
  phone: string
  address: string
  userId: string
}

export interface CreateCompanyResult {
  id: string
  name: string
  type: 'parts'
}

// Получить список активных авторазборок
export async function getPartsCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('parts_companies')
    .select('id, name')
    .eq('is_active', true)
  if (error) throw error
  return data as Company[]
}

// ── Контакты разборки (для публичной страницы запчасти) ──────────────────────

export interface PartsCompanyContacts {
  id: string
  name: string
  phone: string | null
  telegram: string | null
  address: string | null
  email: string | null
}

export async function getPartsCompanyContacts(id: string): Promise<PartsCompanyContacts> {
  // Базовые поля грузим всегда; telegram — best-effort (колонки может не быть,
  // если миграция 012 ещё не применена).
  const { data, error } = await supabase
    .from('parts_companies')
    .select('id, name, phone, address, email')
    .eq('id', id)
    .single()
  if (error) throw error

  let telegram: string | null = null
  try {
    const tg = await supabase.from('parts_companies').select('telegram').eq('id', id).single()
    telegram = (tg.data as any)?.telegram ?? null
  } catch { /* колонки нет */ }

  return { ...(data as any), telegram } as PartsCompanyContacts
}

export async function updatePartsCompanyContacts(
  id: string,
  fields: { phone?: string | null; telegram?: string | null; address?: string | null; email?: string | null }
): Promise<void> {
  const { error } = await supabase.from('parts_companies').update(fields).eq('id', id)
  if (!error) return
  // Если колонки telegram нет — сохраняем остальное без неё
  if ((error as any)?.code === '42703' || /telegram/i.test(error.message || '')) {
    const { telegram, ...rest } = fields
    void telegram
    const retry = await supabase.from('parts_companies').update(rest).eq('id', id)
    if (retry.error) throw retry.error
    return
  }
  throw error
}

// Создать компанию и привязать к пользователю
export async function createCompanyAndAssign(params: CreateCompanyParams): Promise<CreateCompanyResult> {
  const { data: company, error: createError } = await supabase
    .from('parts_companies')
    .insert({
      name: params.name.trim(),
      phone: params.phone || null,
      address: params.address || null,
      is_active: true,
    })
    .select('id, name')
    .single()
  if (createError) throw createError

  const { error: assignError } = await supabase
    .from('user_profiles')
    .update({ parts_company_id: company.id })
    .eq('id', params.userId)
  if (assignError) throw assignError

  return { ...company, type: params.type }
}
