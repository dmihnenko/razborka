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
  duration_months: number | null
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
