// ============================================================================
// Types для системы Разборки (ОТДЕЛЬНО от STO!)
// ============================================================================

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
  notes?: string
  discount_percent: number
  total_orders: number
  total_spent: number
  created_at: string
  updated_at: string
  created_by?: string
}

export type PartsVehicleStatus = 'awaiting' | 'in_progress' | 'dismantled' | 'disposed'

export interface PartsVehicle {
  id: string
  parts_company_id: string
  brand: string
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
  source_vehicle_id?: string
  name: string
  part_number?: string
  description?: string
  condition: string
  quantity: number
  purchase_price?: number
  selling_price?: number
  location?: string
  shelf?: string
  bin?: string
  photos?: string[]
  qr_code?: string
  status: PartsInventoryStatus
  reserved_quantity: number
  notes?: string
  created_at: string
  updated_at: string
  created_by?: string
  
  // Relations
  category?: PartsCategory
  source_vehicle?: PartsVehicle
}

export type PartsOrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled'
export type PartsOrderPaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface PartsOrder {
  id: string
  parts_company_id: string
  customer_id?: string
  order_number: string
  status: PartsOrderStatus
  payment_status: PartsOrderPaymentStatus
  total_amount: number
  discount_amount: number
  paid_amount: number
  notes?: string
  created_at: string
  updated_at: string
  completed_at?: string
  created_by?: string
  
  // Relations
  customer?: PartsCustomer
  items?: PartsOrderItem[]
}

export interface PartsOrderItem {
  id: string
  order_id: string
  inventory_item_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
  notes?: string
  
  // Relations
  inventory_item?: PartsInventoryItem
}

// Form types
export interface CreatePartsVehicleInput {
  brand: string
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
  notes?: string
}

export interface CreatePartsCustomerInput {
  full_name: string
  phone?: string
  email?: string
  notes?: string
  discount_percent?: number
}

export interface CreatePartsInventoryInput {
  category_id: string
  source_vehicle_id?: string
  name: string
  part_number?: string
  description?: string
  condition: string
  quantity: number
  purchase_price?: number
  selling_price?: number
  location?: string
  shelf?: string
  bin?: string
  notes?: string
}

export interface CreatePartsCategoryInput {
  name: string
  parent_id?: string
  icon?: string
  color?: string
  sort_order?: number
}
