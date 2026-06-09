import { supabase } from '@/lib/supabase'

const ADMIN_KEY = 'imp_admin_session'
const ACTIVE_KEY = 'imp_active'

export interface ImpersonationInfo {
  name: string
  email: string
}

export function getImpersonation(): ImpersonationInfo | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Войти под пользователем: сохраняем сессию админа, входим как цель. */
export async function startImpersonation(userId: string): Promise<void> {
  // Сохраняем текущую (админскую) сессию для возврата
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Нет активной сессии')
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  }))

  // Получаем токен для входа под целью
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userId }),
  })
  const data = await resp.json()
  if (!resp.ok || data?.error) {
    sessionStorage.removeItem(ADMIN_KEY)
    throw new Error(data?.error || 'Не удалось войти под пользователем')
  }

  // Входим под целью через magic-token
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.token_hash })
  if (error) {
    sessionStorage.removeItem(ADMIN_KEY)
    throw new Error(error.message)
  }

  sessionStorage.setItem(ACTIVE_KEY, JSON.stringify({ name: data.name, email: data.email }))
}

/** Вернуться в админский аккаунт. */
export async function stopImpersonation(): Promise<void> {
  const raw = sessionStorage.getItem(ADMIN_KEY)
  sessionStorage.removeItem(ACTIVE_KEY)
  sessionStorage.removeItem(ADMIN_KEY)
  if (!raw) {
    await supabase.auth.signOut()
    return
  }
  const { access_token, refresh_token } = JSON.parse(raw)
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) {
    await supabase.auth.signOut()
    throw new Error('Сессия админа истекла, войдите заново')
  }
}
