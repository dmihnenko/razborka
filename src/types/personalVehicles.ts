export type CostCurrency = 'UAH' | 'USD'

export type CostCategory = 'lot' | 'parts' | 'work' | 'additional'

export type PartCondition = 'new-original' | 'used-original' | 'aftermarket'

export interface PersonalCostItem {
  id: string
  name: string
  cost: number
  currency: CostCurrency
  category: CostCategory
  condition?: PartCondition
}

export interface VehiclePhoto {
  url: string
  uploadedAt: string
  fileName?: string
}

export type PhotoAlbum = 'usaPhotos' | 'portPhotos' | 'arrivalPhotos'

export interface PersonalVehicle {
  id: string
  userId: string
  makeModel: string
  year: number
  vin?: string
  photoUrl?: string
  usdRate?: number
  lotItems: PersonalCostItem[]
  partsItems: PersonalCostItem[]
  workItems: PersonalCostItem[]
  additionalItems: PersonalCostItem[]
  totalCost: number
  isSold: boolean
  soldAt?: string
  salePrice?: number
  usaPhotos: VehiclePhoto[]
  portPhotos: VehiclePhoto[]
  arrivalPhotos: VehiclePhoto[]
  createdAt: string
  updatedAt: string
}

export interface VehicleShareLink {
  id: string
  code: string
  vehicleId: string
  userId: string
  createdAt: string
  expiresAt?: string
  isActive: boolean
}

export interface CreatePersonalVehicleInput {
  makeModel: string
  year: number
  vin?: string
  photoUrl?: string
  usdRate?: number
}

export interface UpdatePersonalVehicleInput {
  makeModel?: string
  year?: number
  vin?: string
  photoUrl?: string
  usdRate?: number
  lotItems?: PersonalCostItem[]
  partsItems?: PersonalCostItem[]
  workItems?: PersonalCostItem[]
  additionalItems?: PersonalCostItem[]
  isSold?: boolean
  soldAt?: string
  salePrice?: number
}

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  lot: 'Авто',
  parts: 'Запчасти',
  work: 'Работа',
  additional: 'Доп. расходы'
}

export const CONDITION_LABELS: Record<PartCondition, string> = {
  'new-original': 'Новая оригинал',
  'used-original': 'Б/у оригинал',
  'aftermarket': 'Неоригинал'
}

export const ALBUM_LABELS: Record<PhotoAlbum, string> = {
  usaPhotos: 'USA',
  portPhotos: 'Port',
  arrivalPhotos: 'Arrival'
}
