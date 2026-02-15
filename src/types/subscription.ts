export type SubscriptionType = 'monthly' | 'lifetime'

export interface Subscription {
  id: string
  name: string
  type: SubscriptionType
  price: number
  description: string | null
  company_type: 'sto' | 'parts'
  is_active: boolean
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
  
  // Relations
  subscription?: Subscription
  company?: {
    id: string
    name: string
  }
}

export interface SubscriptionStats {
  total_active: number
  total_monthly: number
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
