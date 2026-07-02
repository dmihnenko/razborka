import { supabase } from '@/lib/supabase'

// ============================================================================
// ЗАЯВКИ НА ДОСТУП (access_requests) + выдача роли «личные авто»
// Используется экраном ожидания доступа (WaitingAccessPage).
// ============================================================================

export type AccessRequestType = 'parts_owner' | 'parts_worker' | 'user'

/** Полезная нагрузка заявки на доступ (форма из WaitingAccessPage). */
export interface AccessRequestPayload {
  user_id: string
  request_type: AccessRequestType | null
  status: 'pending'
  company_name?: string
  company_address?: string | null
  company_phone?: string | null
  owner_phone?: string
}

/**
 * «Личные автомобили» — без подтверждения админом: выдаёт роль «user» текущему
 * пользователю через SECURITY DEFINER RPC. Бросает исключение при ошибке
 * (напр. 23503 — аккаунт удалён, но осталась сессия).
 */
export async function claimPersonalUserRole(): Promise<void> {
  const { error } = await supabase.rpc('claim_personal_user_role')
  if (error) throw error
}

/** Создать заявку на доступ (parts_owner / parts_worker). */
export async function createAccessRequest(payload: AccessRequestPayload): Promise<void> {
  const { error } = await supabase.from('access_requests').insert(payload)
  if (error) throw error
}

/** Удалить (отменить) заявку на доступ по id. */
export async function deleteAccessRequest(id: string): Promise<void> {
  const { error } = await supabase.from('access_requests').delete().eq('id', id)
  if (error) throw error
}
