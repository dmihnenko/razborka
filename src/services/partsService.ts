import { supabase } from '@/lib/supabase'
import type {
  PartsVehicle,
  PartsCustomer,
  PartsCategory,
  PartsInventoryItem,
  PartsOrder,
  CreatePartsVehicleInput,
  CreatePartsCustomerInput,
  CreatePartsInventoryInput,
  CreatePartsCategoryInput,
  PartsCategorySuggestion
} from '@/types/parts'

// ============================================================================
// PARTS VEHICLES (Автомобили на разборке)
// ============================================================================

export async function getPartsVehicles(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_vehicles')
    .select('*')
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as PartsVehicle[]
}

export async function getPartsVehicle(id: string) {
  const { data, error } = await supabase
    .from('parts_vehicles')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as PartsVehicle
}

export async function createPartsVehicle(input: CreatePartsVehicleInput, partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_vehicles')
    .insert({
      ...input,
      parts_company_id: partsCompanyId,
      status: 'awaiting'
    })
    .select()
    .single()
  
  if (error) throw error
  return data as PartsVehicle
}

export async function updatePartsVehicle(id: string, updates: Partial<PartsVehicle>) {
  const { data, error } = await supabase
    .from('parts_vehicles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as PartsVehicle
}

export async function deletePartsVehicle(id: string) {
  const { error } = await supabase
    .from('parts_vehicles')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

export async function updateVehicleStatus(
  id: string, 
  status: PartsVehicle['status']
) {
  const updates: any = { status }
  
  if (status === 'in_progress' && !updates.dismantling_started_at) {
    updates.dismantling_started_at = new Date().toISOString()
  } else if (status === 'dismantled' && !updates.dismantling_completed_at) {
    updates.dismantling_completed_at = new Date().toISOString()
  }
  
  return updatePartsVehicle(id, updates)
}

// ============================================================================
// PARTS CUSTOMERS (Клиенты разборки)
// ============================================================================

export async function getPartsCustomers(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_customers')
    .select('*')
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  
  // Добавляем подсчет заказов и суммы для каждого клиента
  const customersWithStats = await Promise.all(
    (data || []).map(async (customer) => {
      const { count } = await supabase
        .from('parts_orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
      
      const { data: orders } = await supabase
        .from('parts_orders')
        .select('total_amount')
        .eq('customer_id', customer.id)
      
      const totalSpent = (orders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0)
      
      return {
        ...customer,
        total_orders: count || 0,
        total_spent: totalSpent
      }
    })
  )
  
  return customersWithStats as PartsCustomer[]
}

export async function createPartsCustomer(input: CreatePartsCustomerInput, partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_customers')
    .insert({
      ...input,
      parts_company_id: partsCompanyId
    })
    .select()
    .single()
  
  if (error) throw error
  return data as PartsCustomer
}

export async function updatePartsCustomer(id: string, updates: Partial<PartsCustomer>) {
  const { data, error } = await supabase
    .from('parts_customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as PartsCustomer
}

export async function deletePartsCustomer(id: string) {
  const { error } = await supabase
    .from('parts_customers')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Delete parts customer error:', error)
    throw error
  }
}

// ============================================================================
// PARTS CATEGORIES (Категории запчастей с шаблонами)
// ============================================================================

export async function getPartsCategories(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_categories')
    .select('*')
    .or(`parts_company_id.eq.${partsCompanyId},is_template.is.true`)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  
  if (error) throw error
  return data as PartsCategory[]
}

export async function getPartsCategoryTemplates(brand?: string, model?: string) {
  let query = supabase
    .from('parts_categories')
    .select('*')
    .eq('is_template', true)
    .eq('is_active', true)
  
  if (brand && model) {
    query = query.or(`template_type.eq.global,and(template_type.eq.brand,brand.eq.${brand}),and(template_type.eq.brand_model,brand.eq.${brand},model.eq.${model})`)
  } else if (brand) {
    query = query.or(`template_type.eq.global,and(template_type.eq.brand,brand.eq.${brand})`)
  } else {
    query = query.eq('template_type', 'global')
  }
  
  const { data, error } = await query.order('sort_order', { ascending: true })
  
  if (error) throw error
  return data as PartsCategory[]
}

export async function getSuggestedCategories(
  partsCompanyId: string,
  brand: string,
  model: string
): Promise<PartsCategorySuggestion[]> {
  const { data, error } = await supabase
    .rpc('get_suggested_categories', {
      p_parts_company_id: partsCompanyId,
      p_brand: brand,
      p_model: model
    })
  
  if (error) throw error
  return data as PartsCategorySuggestion[]
}

export async function copyTemplateCategories(
  partsCompanyId: string,
  templateIds: string[]
): Promise<number> {
  const { data, error } = await supabase
    .rpc('copy_template_categories_to_company', {
      p_parts_company_id: partsCompanyId,
      p_template_ids: templateIds
    })
  
  if (error) throw error
  return data as number
}

export async function createPartsCategory(input: CreatePartsCategoryInput, partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_categories')
    .insert({
      ...input,
      parts_company_id: partsCompanyId,
      is_template: false,
      is_active: true
    })
    .select()
    .single()
  
  if (error) throw error
  return data as PartsCategory
}

export async function createPartsCategoriesBulk(names: string[], partsCompanyId: string) {
  const rows = names.map((name, i) => ({
    name: name.trim(),
    parts_company_id: partsCompanyId,
    is_template: false,
    is_active: true,
    sort_order: i,
  }))
  const { data, error } = await supabase
    .from('parts_categories')
    .insert(rows)
    .select()
  if (error) throw error
  return data as PartsCategory[]
}

export async function updatePartsCategory(id: string, updates: Partial<PartsCategory>) {
  const { data, error } = await supabase
    .from('parts_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data as PartsCategory
}

export async function deletePartsCategory(id: string) {
  const { error } = await supabase
    .from('parts_categories')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================================================
// PARTS INVENTORY (Склад запчастей)
// ============================================================================

export async function getPartsInventory(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select(`
      *,
      category:parts_categories(id, name),
      vehicle:parts_vehicles!vehicle_id(id, make, model, year, vin)
    `)
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as PartsInventoryItem[]
}

export async function createPartsInventoryItem(input: CreatePartsInventoryInput, partsCompanyId: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { purchase_price, ...rest } = input
  const { data, error } = await supabase
    .from('parts_inventory')
    .insert({
      ...rest,
      parts_company_id: partsCompanyId,
      status: input.status || 'available',
      reserved_quantity: 0
    })
    .select('*')
    .single()
  
  if (error) throw error
  return data as PartsInventoryItem
}

export async function updatePartsInventoryItem(id: string, updates: Partial<PartsInventoryItem>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { purchase_price, category, vehicle, ...safeUpdates } = updates as any
  const { data, error } = await supabase
    .from('parts_inventory')
    .update(safeUpdates)
    .eq('id', id)
    .select('*')
    .single()
  
  if (error) throw error
  return data as PartsInventoryItem
}

export async function deletePartsInventoryItem(id: string) {
  const { error } = await supabase
    .from('parts_inventory')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

// ============================================================================
// PARTS ORDERS (Заказы)
// ============================================================================

export async function getPartsOrders(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_orders')
    .select(`
      *,
      customer:parts_customers(id, full_name, phone),
      items:parts_order_items(
        *,
        inventory_item:parts_inventory(
          id,
          name,
          part_number,
          category:parts_categories(id, name)
        )
      )
    `)
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as PartsOrder[]
}

export async function getPartsOrder(id: string) {
  const { data, error } = await supabase
    .from('parts_orders')
    .select(`
      *,
      customer:parts_customers(id, full_name, phone, email),
      items:parts_order_items(
        *,
        inventory_item:parts_inventory(
          id,
          name,
          part_number,
          category:parts_categories(id, name)
        )
      )
    `)
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as PartsOrder
}

// ============================================================================
// СКЛАД (иерархические места хранения)
// ============================================================================

export async function getStorageLocations(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_storage_locations')
    .select('*')
    .eq('parts_company_id', partsCompanyId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createStorageLocation(input: {
  parts_company_id: string
  parent_id?: string | null
  name: string
  sort_order?: number
}) {
  const { data, error } = await supabase
    .from('parts_storage_locations')
    .insert({
      parts_company_id: input.parts_company_id,
      parent_id: input.parent_id ?? null,
      name: input.name.trim(),
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStorageLocation(id: string, updates: { name?: string; sort_order?: number }) {
  const { data, error } = await supabase
    .from('parts_storage_locations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStorageLocation(id: string) {
  const { error } = await supabase
    .from('parts_storage_locations')
    .delete()
    .eq('id', id)
  if (error) throw error
}
