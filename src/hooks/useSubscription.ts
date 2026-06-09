import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserProfile } from './useUserProfile'
import type { CompanySubscription, SubscriptionUsage } from '../types/subscription'

// ─── Free tier limits (no active subscription) ────────────────────────────────

export const FREE_LIMITS = {
  sto: { workers: 1, appointments: 10, customers: 15, vehicles: 30 },
  parts: { workers: 1, vehicles: 1, parts: 10 },
}

// ─── Fetch current subscription ───────────────────────────────────────────────

export function useCompanySubscription() {
  const { data: profile } = useUserProfile()

  return useQuery({
    queryKey: ['companySubscription', profile?.sto_company_id, profile?.parts_company_id],
    queryFn: async () => {
      const companyType = profile?.sto_company_id ? 'sto' : profile?.parts_company_id ? 'parts' : null
      const companyId   = profile?.sto_company_id || profile?.parts_company_id || null
      if (!companyType || !companyId) return null

      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('*, subscription:subscriptions(*)')
        .eq('company_type', companyType)
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      // Expired?
      if (data.end_date && new Date(data.end_date) < new Date()) return null

      return data as CompanySubscription
    },
    enabled: !!(profile?.sto_company_id || profile?.parts_company_id),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Usage counters ───────────────────────────────────────────────────────────

export function useSubscriptionUsage() {
  const { data: profile } = useUserProfile()
  const stoId = profile?.sto_company_id

  const { data: appointmentCount = 0 } = useQuery({
    queryKey: ['sub-usage-appointments', stoId],
    queryFn: async () => {
      // Лимит «заявок в месяц» — считаем созданные с начала текущего календарного месяца
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('sto_company_id', stoId!)
        .gte('created_at', startOfMonth.toISOString())
      return count || 0
    },
    enabled: !!stoId,
    staleTime: 2 * 60 * 1000,
  })

  const { data: customerCount = 0 } = useQuery({
    queryKey: ['sub-usage-customers', stoId],
    queryFn: async () => {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('sto_company_id', stoId!)
      return count || 0
    },
    enabled: !!stoId,
    staleTime: 2 * 60 * 1000,
  })

  return { appointments: appointmentCount, customers: customerCount } as SubscriptionUsage
}

// ─── Combined hook (main) ─────────────────────────────────────────────────────

export function useSubscriptionLimits() {
  const { data: profile } = useUserProfile()
  const { data: subscription } = useCompanySubscription()
  const usage = useSubscriptionUsage()

  const isStoOwner   = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const isPartsOwner = profile?.roles?.some((r: any) => r.name === 'parts_owner')
  const hasSubscription = !!subscription

  const plan = subscription?.subscription

  // Effective limits: from plan (null=unlimited) or FREE_LIMITS
  const maxAppointments = hasSubscription ? (plan?.max_appointments ?? null) : FREE_LIMITS.sto.appointments
  const maxCustomers    = hasSubscription ? (plan?.max_customers    ?? null) : FREE_LIMITS.sto.customers
  const maxWorkers      = hasSubscription ? (plan?.max_workers      ?? null) : FREE_LIMITS.sto.workers

  // Usage percentages (0-100, clamped)
  const usagePct = {
    appointments: maxAppointments ? Math.min(100, Math.round((usage.appointments / maxAppointments) * 100)) : 0,
    customers:    maxCustomers    ? Math.min(100, Math.round((usage.customers    / maxCustomers)    * 100)) : 0,
  }

  // Days left
  const daysLeft: number | null = (() => {
    if (!subscription?.end_date) return null
    const diff = new Date(subscription.end_date).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86_400_000))
  })()

  const isExpiringSoon = daysLeft !== null && daysLeft <= 14

  return {
    hasSubscription,
    subscription,
    plan,
    usage,
    usagePct,
    daysLeft,
    isExpiringSoon,

    limits: {
      maxAppointments,
      maxCustomers,
      maxWorkers,
      sto: hasSubscription && isStoOwner ? null : FREE_LIMITS.sto,
      parts: hasSubscription && isPartsOwner ? null : FREE_LIMITS.parts,
    },

    canCreate: {
      appointment: () => {
        if (!isStoOwner) return true
        if (maxAppointments === null) return true
        return usage.appointments < maxAppointments
      },
      customer: () => {
        if (!isStoOwner) return true
        if (maxCustomers === null) return true
        return usage.customers < maxCustomers
      },
      worker: (currentCount: number) => {
        if (maxWorkers === null) return true
        if (isStoOwner) return currentCount < maxWorkers
        if (isPartsOwner) return currentCount < FREE_LIMITS.parts.workers
        return false
      },
      vehicle: (currentCount: number) => {
        if (hasSubscription) return true
        if (isStoOwner) return currentCount < FREE_LIMITS.sto.vehicles
        if (isPartsOwner) return currentCount < FREE_LIMITS.parts.vehicles
        return true
      },
      part: (currentCount: number) => {
        if (!isPartsOwner) return true
        if (hasSubscription) return true
        return currentCount < FREE_LIMITS.parts.parts
      },
    },
  }
}
