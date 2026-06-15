import { supabase } from '@/lib/supabase'

// ============================================================================
// Настройки Новой Почты per-разборка (таблица parts_np_settings).
// Заменяет localStorage (tsp_np_api_key / tsp_np_config) — ключ и профиль
// отправителя живут в БД и работают для всех сотрудников разборки.
// ⚠️ Требует миграции database/migrations/2026-06-16_parts_np_settings.sql
// ============================================================================

export interface PartsNpSettings {
  parts_company_id: string
  api_key: string | null
  sender_counterparty_ref: string | null
  sender_contact_ref: string | null
  sender_city_ref: string | null
  sender_city_name: string | null
  sender_warehouse_ref: string | null
  sender_warehouse_name: string | null
  sender_phone: string | null
  sender_name: string | null
  updated_at?: string
}

export async function getNpSettings(partsCompanyId: string): Promise<PartsNpSettings | null> {
  const { data, error } = await supabase
    .from('parts_np_settings')
    .select('*')
    .eq('parts_company_id', partsCompanyId)
    .maybeSingle()
  if (error) throw error
  return (data as PartsNpSettings) ?? null
}

export async function upsertNpSettings(
  partsCompanyId: string,
  patch: Partial<Omit<PartsNpSettings, 'parts_company_id'>>,
): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('parts_np_settings')
    .upsert(
      {
        parts_company_id: partsCompanyId,
        ...patch,
        updated_at: new Date().toISOString(),
        updated_by: userRes?.user?.id ?? null,
      },
      { onConflict: 'parts_company_id' },
    )
  if (error) throw error
}
