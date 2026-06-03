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
    'До 15 клієнтів',
    '1 майстер',
    'Базовий календар',
  ],
  start: [
    'До 50 заявок на місяць',
    'До 100 клієнтів',
    'До 3 майстрів',
    'Календар записів',
    'Каталог послуг',
  ],
  business: [
    'До 200 заявок на місяць',
    'До 500 клієнтів',
    'До 10 майстрів',
    'Повна аналітика',
    'Календар записів',
    'Каталог послуг',
    'Статистика доходів',
  ],
  pro: [
    'Безліміт заявок',
    'Безліміт клієнтів',
    'Необмежена кількість майстрів',
    'Повна аналітика',
    'Пріоритетна підтримка',
    'Всі поточні та майбутні функції',
  ],
  lifetime: [
    'Безліміт заявок назавжди',
    'Безліміт клієнтів назавжди',
    'Необмежена кількість майстрів',
    'Повна аналітика',
    'Пріоритетна підтримка',
    'Всі поточні та майбутні функції',
    'Оновлення безкоштовно',
  ],
}
