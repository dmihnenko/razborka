export type SubscriptionType = 'monthly' | 'yearly' | 'lifetime'

export interface Subscription {
  id: string
  name: string
  type: SubscriptionType
  price: number
  description: string | null
  company_type: 'parts'
  is_active: boolean
  // Limits (null = unlimited)
  max_customers: number | null
  max_workers: number | null
  // Лимиты разборки
  max_vehicles?: number | null
  max_parts?: number | null
  duration_months: number | null
  sort_order?: number
  /** Персональный тариф — цена/лимиты обсуждаются индивидуально */
  is_custom?: boolean
  /** Базовый бесплатный Демо-план (фолбэк для новых/истёкших) */
  is_demo?: boolean
  /** Есть ли модуль аналитики в этом тарифе */
  has_analytics?: boolean
  created_at: string
  updated_at: string
}

export interface CompanySubscription {
  id: string
  company_type: 'parts'
  company_id: string
  subscription_id: string
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  subscription?: Subscription
  company?: { id: string; name: string }
}

export interface SubscriptionStats {
  total_active: number
  total_monthly: number
  total_yearly: number
  total_lifetime: number
  revenue_this_month: number
  revenue_total: number
}

export interface AssignSubscriptionInput {
  company_type: 'parts'
  company_id: string
  subscription_id: string
  start_date?: string
  end_date?: string
}

export interface SubscriptionUsage {
  customers: number
  workers: number
  // Разборка
  vehicles: number
  parts: number
}

export interface SubscriptionRequest {
  id: string
  company_type: 'parts'
  company_id: string
  requested_by: string | null
  plan_id: string | null
  months: number
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
  processed_at: string | null
  processed_by: string | null
  payment_proof_url?: string | null
  client_note?: string | null
  // join / derived
  plan?: { name: string; type: string } | null
  company_name?: string
}

