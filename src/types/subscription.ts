export type SubscriptionType = 'monthly' | 'yearly' | 'lifetime'

export interface Subscription {
  id: string
  name: string
  type: SubscriptionType
  price: number
  description: string | null
  company_type: 'sto' | 'parts'
  is_active: boolean
  // Limits (null = unlimited)
  max_appointments: number | null
  max_customers: number | null
  max_workers: number | null
  // Лимиты разборки
  max_vehicles?: number | null
  max_parts?: number | null
  duration_months: number | null
  sort_order?: number
  /** Персональный тариф — цена/лимиты обсуждаются индивидуально */
  is_custom?: boolean
  created_at: string
  updated_at: string
}

export interface CompanySubscription {
  id: string
  company_type: 'sto' | 'parts'
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
  company_type: 'sto' | 'parts'
  company_id: string
  subscription_id: string
  start_date?: string
  end_date?: string
}

export interface SubscriptionUsage {
  appointments: number
  customers: number
  workers: number
  // Разборка
  vehicles: number
  parts: number
}

export interface SubscriptionRequest {
  id: string
  company_type: 'sto' | 'parts'
  company_id: string
  requested_by: string | null
  plan_id: string | null
  months: number
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
  processed_at: string | null
  processed_by: string | null
  // join / derived
  plan?: { name: string; type: string } | null
  company_name?: string
}

// Plan tier display config
export const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    'До 10 заявок',
    'До 15 клиентов',
    '1 мастер',
    'Базовый календарь',
  ],
  start: [
    'До 50 заявок в месяц',
    'До 100 клиентов',
    'До 3 мастеров',
    'Календарь записей',
    'Каталог услуг',
  ],
  business: [
    'До 200 заявок в месяц',
    'До 500 клиентов',
    'До 10 мастеров',
    'Полная аналитика',
    'Календарь записей',
    'Каталог услуг',
    'Статистика доходов',
  ],
  pro: [
    'Безлимит заявок',
    'Безлимит клиентов',
    'Неограниченное количество мастеров',
    'Полная аналитика',
    'Приоритетная поддержка',
    'Все текущие и будущие функции',
  ],
  lifetime: [
    'Безлимит заявок навсегда',
    'Безлимит клиентов навсегда',
    'Неограниченное количество мастеров',
    'Полная аналитика',
    'Приоритетная поддержка',
    'Все текущие и будущие функции',
    'Обновления бесплатно',
  ],
}
