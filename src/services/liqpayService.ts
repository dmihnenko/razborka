import { supabase } from '@/lib/supabase'

export interface SubscriptionPayment {
  id: string
  order_id: string
  subscription_id: string
  months: number
  amount: number
  currency: string
  description: string | null
  status: 'pending' | 'success' | 'failed'
  created_at: string
  paid_at: string | null
}

/**
 * Запускает оплату подписки через LiqPay.
 * 1) создаёт pending-платёж (RPC, сумма считается на сервере),
 * 2) получает подписанные data+signature от воркера (приватный ключ только на сервере),
 * 3) авто-сабмит формы на страницу оплаты LiqPay.
 * Активация подписки произойдёт ТОЛЬКО после серверного callback LiqPay (не по редиректу).
 */
export async function startLiqpayCheckout(subscriptionId: string, months: number): Promise<void> {
  const { data: pend, error } = await supabase.rpc('liqpay_create_pending', {
    p_subscription_id: subscriptionId,
    p_months: months,
  })
  if (error) throw error
  const row = Array.isArray(pend) ? pend[0] : pend
  if (!row?.order_id) throw new Error('Не удалось создать платёж')

  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) throw new Error('Нужно войти в аккаунт')

  const res = await fetch('/api/liqpay-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ order_id: row.order_id }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error === 'liqpay_not_configured' ? 'Онлайн-оплата ещё не настроена' : 'Не удалось начать оплату')
  }
  const { data, signature, url } = await res.json()

  // Авто-сабмит формы на LiqPay (переход на их защищённую страницу оплаты)
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  form.acceptCharset = 'utf-8'
  for (const [name, value] of [['data', data], ['signature', signature]] as const) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

/** История платежей текущей компании (RLS отдаёт только свои). */
export async function getMyPayments(): Promise<SubscriptionPayment[]> {
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('id, order_id, subscription_id, months, amount, currency, description, status, created_at, paid_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data || []) as SubscriptionPayment[]
}
