export interface Tariff {
  id: string
  name: string
  price: number
  description?: string | null
  maxVehicles: number | null
  maxParts: number | null
  maxWorkers: number | null
  hasAnalytics: boolean
  isCustom: boolean
  sortOrder: number
}

export interface PartsApplicationInput {
  companyName: string
  ownerFirstName: string
  ownerLastName: string
  phone: string
  address: string
  vehicleMakes: string[]
}

export interface PartsApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  companyName: string
  createdAt: string
  rejectionReason?: string
}

// Лимиты демо-режима — фолбэк на время загрузки. Реальные лимиты берём с сервера
// (getDefaultCompanyPlanPublic), т.к. админ может назначить триал платного тарифа.
export const DEMO_LIMITS = {
  vehicles: 3,
  parts: 50,
  workers: 2,
} as const

/** Эффективный план по умолчанию для новых разборок (публичный, для лендинга). */
export interface PublicDefaultPlan {
  name: string
  price: number
  is_demo: boolean
  max_vehicles: number | null
  max_parts: number | null
  max_workers: number | null
  has_analytics: boolean
  /** Срок триала в месяцах; null = бессрочно (демо/бесплатный). */
  months: number | null
}
