import { supabase } from '../lib/supabase'

export interface Company {
  id: string
  name: string
}

export interface CreateCompanyParams {
  type: 'sto' | 'parts'
  name: string
  phone: string
  address: string
  userId: string
}

export interface CreateCompanyResult {
  id: string
  name: string
  type: 'sto' | 'parts'
}

// Получить список активных СТО
export async function getStoCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('sto_companies')
    .select('id, name')
    .eq('is_active', true)
  if (error) throw error
  return data as Company[]
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
  const { data, error } = await supabase
    .from('parts_companies')
    .select('id, name, phone, telegram, address, email')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as PartsCompanyContacts
}

export async function updatePartsCompanyContacts(
  id: string,
  fields: { phone?: string | null; telegram?: string | null; address?: string | null; email?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('parts_companies')
    .update(fields)
    .eq('id', id)
  if (error) throw error
}

// Создать компанию и привязать к пользователю
export async function createCompanyAndAssign(params: CreateCompanyParams): Promise<CreateCompanyResult> {
  const table = params.type === 'sto' ? 'sto_companies' : 'parts_companies'
  const profileField = params.type === 'sto' ? 'sto_company_id' : 'parts_company_id'

  const { data: company, error: createError } = await supabase
    .from(table)
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
    .update({ [profileField]: company.id })
    .eq('id', params.userId)
  if (assignError) throw assignError

  return { ...company, type: params.type }
}
