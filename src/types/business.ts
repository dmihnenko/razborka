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

export const DEMO_LIMITS = {
  vehicles: 2,
  parts: 10,
  workers: 2,
} as const
