import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useUserProfile } from './useUserProfile'
import type { CompanySubscription, SubscriptionUsage } from '../types/subscription'

// ─── Free tier limits (no active subscription) ────────────────────────────────

export const FREE_LIMITS = {
  parts: { workers: 2, vehicles: 2, parts: 10 },
}

/** Alias для обратной совместимости и публичного контракта */
export const FREE_PARTS = FREE_LIMITS.parts

// ─── Fetch current subscription ───────────────────────────────────────────────

export function useCompanySubscription() {
  const { data: profile } = useUserProfile()

  return useQuery({
    queryKey: ['companySubscription', profile?.parts_company_id],
    queryFn: async () => {
      const companyId = profile?.parts_company_id || null
      if (!companyId) return null

      const { data, error } = await supabase
        .from('company_subscriptions')
        .select('*, subscription:subscriptions(*)')
        .eq('company_type', 'parts')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      // Expired?
      if (data.end_date && new Date(data.end_date) < new Date()) return null

      return data as CompanySubscription
    },
    enabled: !!profile?.parts_company_id,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Usage counters ───────────────────────────────────────────────────────────

export function useSubscriptionUsage() {
  const { data: profile } = useUserProfile()
  const partsId = profile?.parts_company_id

  const { data: vehicleCount = 0 } = useQuery({
    queryKey: ['sub-usage-vehicles', partsId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsId!)
      return count || 0
    },
    enabled: !!partsId,
    staleTime: 2 * 60 * 1000,
  })

  const { data: partCount = 0 } = useQuery({
    queryKey: ['sub-usage-parts', partsId],
    queryFn: async () => {
      const { count } = await supabase
        .from('parts_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsId!)
      return count || 0
    },
    enabled: !!partsId,
    staleTime: 2 * 60 * 1000,
  })

  return {
    customers: 0, workers: 0,
    vehicles: vehicleCount, parts: partCount,
  } as SubscriptionUsage
}

// ─── Combined hook (main) ─────────────────────────────────────────────────────

export function useSubscriptionLimits() {
  const { data: profile } = useUserProfile()
  const { data: subscription } = useCompanySubscription()
  const usage = useSubscriptionUsage()

  const isPartsOwner = profile?.roles?.some((r: any) => r.name === 'parts_owner')
  const hasSubscription = !!subscription

  const plan = subscription?.subscription

  // Признак аналитики: только если есть активный платный план с has_analytics
  const hasAnalytics: boolean = hasSubscription ? (plan?.has_analytics ?? false) : false

  // Effective limits: from plan (null=unlimited) or FREE_LIMITS
  const maxCustomers    = hasSubscription ? (plan?.max_customers    ?? null) : null
  const maxWorkers      = hasSubscription ? (plan?.max_workers      ?? null) : FREE_LIMITS.parts.workers
  // Разборка
  const maxVehicles = hasSubscription ? (plan?.max_vehicles ?? null) : FREE_LIMITS.parts.vehicles
  const maxParts    = hasSubscription ? (plan?.max_parts    ?? null) : FREE_LIMITS.parts.parts

  // Usage percentages (0-100, clamped)
  const usagePct = {
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
    hasAnalytics,

    limits: {
      maxCustomers,
      maxWorkers,
      maxVehicles,
      maxParts,
      parts: hasSubscription && isPartsOwner ? null : FREE_LIMITS.parts,
    },

    canCreate: {
      worker: (currentCount: number) => {
        if (maxWorkers === null) return true
        if (isPartsOwner) return currentCount < FREE_LIMITS.parts.workers
        return false
      },
      vehicle: () => {
        // Лимит машин — только для разборки
        if (!isPartsOwner) return true
        if (maxVehicles === null) return true
        return usage.vehicles < maxVehicles
      },
      part: () => {
        if (!isPartsOwner) return true
        if (maxParts === null) return true
        return usage.parts < maxParts
      },
    },
  }
}
