import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserProfile } from './useUserProfile'

export interface Subscription {
  id: string
  name: string
  type: 'monthly' | 'yearly' | 'lifetime'
  price: number
  description: string | null
  is_active: boolean
}

export interface CompanySubscription {
  id: string
  company_type: 'sto' | 'parts'
  company_id: string
  subscription_id: string
  start_date: string
  end_date: string | null
  is_active: boolean
  subscription?: Subscription
}

// Лимиты без подписки
export const FREE_LIMITS = {
  sto: {
    workers: 1,
    appointments: 5,
    customers: 3,
    vehicles: 3
  },
  parts: {
    workers: 1,
    vehicles: 1,
    parts: 10
  }
}

export function useCompanySubscription() {
  const { data: profile } = useUserProfile()
  
  return useQuery({
    queryKey: ['companySubscription', profile?.sto_company_id, profile?.parts_company_id],
    queryFn: async () => {
      // Определяем тип компании и ID
      let companyType: 'sto' | 'parts' | null = null
      let companyId: string | null = null
      
      if (profile?.sto_company_id) {
        companyType = 'sto'
        companyId = profile.sto_company_id
      } else if (profile?.parts_company_id) {
        companyType = 'parts'
        companyId = profile.parts_company_id
      }
      
      if (!companyType || !companyId) {
        return null
      }
      
      // Получаем подписку компании
      const { data: companySub, error } = await supabase
        .from('company_subscriptions')
        .select('*, subscription:subscriptions(*)')
        .eq('company_type', companyType)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle()
      
      if (error) throw error
      
      // Проверяем, не истекла ли подписка
      if (companySub && companySub.end_date) {
        const endDate = new Date(companySub.end_date)
        if (endDate < new Date()) {
          return null // Подписка истекла
        }
      }
      
      return companySub as CompanySubscription | null
    },
    enabled: !!(profile?.sto_company_id || profile?.parts_company_id),
    staleTime: 5 * 60 * 1000 // 5 минут
  })
}

export function useSubscriptionLimits() {
  const { data: profile } = useUserProfile()
  const { data: subscription } = useCompanySubscription()
  
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const isPartsOwner = profile?.roles?.some((r: any) => r.name === 'parts_owner')
  
  const hasActiveSubscription = !!subscription
  
  return {
    hasSubscription: hasActiveSubscription,
    subscription,
    limits: {
      sto: hasActiveSubscription && isStoOwner ? null : FREE_LIMITS.sto,
      parts: hasActiveSubscription && isPartsOwner ? null : FREE_LIMITS.parts
    },
    canCreate: {
      worker: (currentCount: number) => {
        if (hasActiveSubscription) return true
        if (isStoOwner) return currentCount < FREE_LIMITS.sto.workers
        if (isPartsOwner) return currentCount < FREE_LIMITS.parts.workers
        return false
      },
      appointment: (currentCount: number) => {
        if (!isStoOwner) return true
        if (hasActiveSubscription) return true
        return currentCount < FREE_LIMITS.sto.appointments
      },
      customer: (currentCount: number) => {
        if (!isStoOwner) return true
        if (hasActiveSubscription) return true
        return currentCount < FREE_LIMITS.sto.customers
      },
      vehicle: (currentCount: number) => {
        if (hasActiveSubscription) return true
        if (isStoOwner) return currentCount < FREE_LIMITS.sto.vehicles
        if (isPartsOwner) return currentCount < FREE_LIMITS.parts.vehicles
        return true
      },
      part: (currentCount: number) => {
        if (!isPartsOwner) return true
        if (hasActiveSubscription) return true
        return currentCount < FREE_LIMITS.parts.parts
      }
    }
  }
}
