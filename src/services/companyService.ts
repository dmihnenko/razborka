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

type PartsCompanyContactsRow = Omit<PartsCompanyContacts, 'telegram'>

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
    telegram = (tg.data as { telegram: string | null } | null)?.telegram ?? null
  } catch { /* колонки нет */ }

  return { ...(data as PartsCompanyContactsRow), telegram }
}

export async function updatePartsCompanyContacts(
  id: string,
  fields: { phone?: string | null; telegram?: string | null; address?: string | null; email?: string | null }
): Promise<void> {
  const { error } = await supabase.from('parts_companies').update(fields).eq('id', id)
  if (!error) return
  // Если колонки telegram нет — сохраняем остальное без неё
  if (error.code === '42703' || /telegram/i.test(error.message || '')) {
    const { telegram, ...rest } = fields
    void telegram
    const retry = await supabase.from('parts_companies').update(rest).eq('id', id)
    if (retry.error) throw retry.error
    return
  }
  throw error
}

// ── Курс USD разборки: режим авто (глобальный ПриватБанк) или свой ──
export interface CompanyRateSettings { mode: 'auto' | 'manual'; manualRate: number | null }

export async function getCompanyRate(companyId: string): Promise<CompanyRateSettings> {
  const { data, error } = await supabase
    .from('parts_companies').select('usd_rate_mode, usd_rate').eq('id', companyId).single()
  if (error) throw error
  const d = data as { usd_rate_mode: string | null; usd_rate: number | null } | null
  return { mode: d?.usd_rate_mode === 'manual' ? 'manual' : 'auto', manualRate: d?.usd_rate ?? null }
}

/** Владелец/админ задаёт режим курса своей разборки (auto/manual) и, для manual, своё значение. */
export async function setCompanyRate(mode: 'auto' | 'manual', rate?: number): Promise<void> {
  const { error } = await supabase.rpc('set_company_rate', { p_mode: mode, p_rate: rate ?? null })
  if (error) throw error
}

// ── Админ: CRUD разборок (parts_companies) ──────────────────────────────────

export interface PartsCompanyInput {
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  description?: string | null
  is_active?: boolean
}

/** Админ: создать разборку. */
export async function createPartsCompany(data: PartsCompanyInput): Promise<void> {
  const { error } = await supabase.from('parts_companies').insert({
    name: data.name,
    address: data.address ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    description: data.description ?? null,
    is_active: data.is_active ?? true,
  })
  if (error) throw error
}

/** Админ: обновить данные разборки. */
export async function updatePartsCompany(
  id: string,
  data: { name: string; address?: string | null; phone?: string | null; email?: string | null; description?: string | null }
): Promise<void> {
  const { error } = await supabase.from('parts_companies').update({
    name: data.name,
    address: data.address ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    description: data.description ?? null,
  }).eq('id', id)
  if (error) throw error
}

/** Админ: включить/выключить разборку (передаётся ТЕКУЩЕЕ значение, инвертируется). */
export async function setPartsCompanyActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('parts_companies').update({ is_active: !isActive }).eq('id', id)
  if (error) throw error
}

/** Админ: мягкое удаление разборки (данные хранятся 6 месяцев). */
export async function softDeletePartsCompany(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_soft_delete_company', { p_company_id: id })
  if (error) throw error
}

/** Скрыть онбординг-чек-лист текущей разборки (parts_companies.onboarding_dismissed). */
export async function dismissCompanyOnboarding(): Promise<void> {
  const { error } = await supabase.rpc('dismiss_company_onboarding')
  if (error) throw error
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
