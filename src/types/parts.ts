// ============================================================================
// Types для системы Разборки (ОТДЕЛЬНО от STO!)
// ============================================================================

import type { ImgbbPhoto } from '@/services/imgbbService'

export interface PartsCompany {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  created_at: string
}

export interface PartsCustomer {
  id: string
  parts_company_id: string
  full_name: string
  phone?: string
  email?: string
  address?: string
  /** Город доставки */
  city?: string
  /** Отделение Новой почты */
  np_office?: string
  /** Ref города/отделения Новой почты (для создания ТТН) */
  np_city_ref?: string
  np_warehouse_ref?: string
  notes?: string
  discount_percent: number
  total_orders: number
  total_spent: number
  created_at: string
  updated_at: string
  created_by?: string
}

export type PartsVehicleStatus = 'awaiting' | 'in_progress' | 'dismantled'

export interface PartsVehicle {
  id: string
  parts_company_id: string
  make: string
  model: string
  year?: number
  vin?: string
  license_plate?: string
  color?: string
  engine_type?: string
  transmission_type?: string
  mileage?: number
  purchase_price?: number
  purchase_date?: string
  exchange_rate?: number
  status: PartsVehicleStatus
  notes?: string
  photos?: string[]
  dismantling_started_at?: string
  dismantling_completed_at?: string
  created_at: string
  updated_at: string
  created_by?: string
}

export type PartsCategoryTemplateType = 'global' | 'brand' | 'brand_model' | 'custom'

export interface PartsCategory {
  id: string
  parts_company_id?: string
  name: string
  parent_id?: string
  icon?: string
  color?: string
  sort_order: number
  is_active: boolean
  is_template: boolean
  template_type?: PartsCategoryTemplateType
  brand?: string
  model?: string
  created_by?: string
  created_at: string
}

export interface PartsCategorySuggestion {
  category_id: string
  category_name: string
  usage_count: number
  source: 'history' | 'template' | 'global'
}

export type PartsInventoryStatus = 'available' | 'reserved' | 'sold' | 'damaged'

export interface PartsInventoryItem {
  id: string
  parts_company_id: string
  category_id: string
  vehicle_id?: string
  name: string
  part_number?: string
  description?: string
  condition: string
  quantity: number
  purchase_price?: number
  selling_price?: number
  sold_price?: number
  price_currency?: 'UAH' | 'USD'
  location?: string
  shelf?: string
  bin?: string
  photos?: ImgbbPhoto[]
  qr_code?: string
  status: PartsInventoryStatus
  reserved_quantity: number
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
  
  // Buyer info + зафиксированные на момент продажи курс и дата
  sold_to_customer_id?: string
  sold_at?: string
  exchange_rate_at_sale?: number

  // Relations
  category?: PartsCategory
  vehicle?: PartsVehicle
  storage_location?: { id: string; name: string } | null
  sold_to_customer?: Pick<PartsCustomer, 'id' | 'full_name' | 'phone'>
}

// Form types
export interface CreatePartsVehicleInput {
  make: string
  model: string
  year?: number
  vin?: string
  license_plate?: string
  color?: string
  engine_type?: string
  transmission_type?: string
  mileage?: number
  purchase_price?: number
  purchase_date?: string
  exchange_rate?: number
  notes?: string
}

export interface CreatePartsCustomerInput {
  full_name: string
  phone?: string
  email?: string
  address?: string
  city?: string
  np_office?: string
  np_city_ref?: string
  np_warehouse_ref?: string
  notes?: string
  discount_percent?: number
}

export interface CreatePartsInventoryInput {
  category_id?: string
  vehicle_id?: string
  name: string
  part_number?: string
  description?: string
  condition: string
  quantity: number
  purchase_price?: number
  selling_price?: number
  price_currency?: 'UAH' | 'USD'
  location?: string
  shelf?: string
  bin?: string
  photos?: ImgbbPhoto[]
  notes?: string
  storage_location_id?: string
  status?: PartsInventoryStatus
}

// ============================================================================
// Склад (иерархические места хранения)
// ============================================================================

export interface StorageLocation {
  id: string
  parts_company_id: string
  parent_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateStorageLocationInput {
  parts_company_id: string
  parent_id?: string | null
  name: string
  sort_order?: number
}

export interface CreatePartsCategoryInput {
  name: string
  parent_id?: string
  icon?: string
  color?: string
  sort_order?: number
}

// ============================================================================
// Types для заказов разборки
// ============================================================================

export type PartsOrderStatus = 'new' | 'in_progress' | 'completed' | 'cancelled'

export interface PartsOrder {
  id: string
  parts_company_id: string
  customer_id?: string
  order_number: string
  order_date: string
  status: PartsOrderStatus
  total_amount: number
  notes?: string
  created_by?: string
  /** Номер ТТН Новой почты (если создана) */
  np_ttn?: string
  created_at: string
  updated_at: string
  // Joined data
  customer?: PartsCustomer
  items?: PartsOrderItem[]
}

export interface PartsOrderItem {
  id: string
  order_id: string
  inventory_item_id: string
  quantity: number
  price_at_sale: number
  price_at_sale_currency?: 'UAH' | 'USD'
  subtotal: number
  created_at: string
  // Joined data
  inventory_item?: PartsInventoryItem
}

export interface CreatePartsOrderInput {
  customer_id?: string
  notes?: string
}

export interface CreatePartsOrderItemInput {
  inventory_item_id: string
  quantity: number
  price_at_sale: number
  price_at_sale_currency?: 'UAH' | 'USD'
}
