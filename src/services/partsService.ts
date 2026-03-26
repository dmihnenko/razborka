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
  status: PartsVehicle['status'],
  currentVehicle?: Pick<PartsVehicle, 'dismantling_started_at' | 'dismantling_completed_at'>
) {
  // If current vehicle not passed — fetch it to avoid overwriting existing timestamps
  let existing = currentVehicle
  if (!existing) {
    const { data } = await supabase
      .from('parts_vehicles')
      .select('dismantling_started_at, dismantling_completed_at')
      .eq('id', id)
      .single()
    existing = data ?? undefined
  }

  const updates: any = { status }

  if (status === 'in_progress' && !existing?.dismantling_started_at) {
    updates.dismantling_started_at = new Date().toISOString()
  } else if (status === 'dismantled' && !existing?.dismantling_completed_at) {
    updates.dismantling_completed_at = new Date().toISOString()
  }

  return updatePartsVehicle(id, updates)
}

// ============================================================================
// PARTS CUSTOMERS (Клиенты разборки)
// ============================================================================

export async function getPartsCustomers(partsCompanyId: string) {
  // Fetch customers and all their orders in 2 queries (avoids N+1)
  const [customersRes, ordersRes] = await Promise.all([
    supabase
      .from('parts_customers')
      .select('*')
      .eq('parts_company_id', partsCompanyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('parts_orders')
      .select('customer_id, total_amount')
      .eq('parts_company_id', partsCompanyId),
  ])

  if (customersRes.error) throw customersRes.error

  const orders = ordersRes.data || []

  // Build per-customer stats map
  const statsMap: Record<string, { count: number; total: number }> = {}
  for (const order of orders) {
    if (!order.customer_id) continue
    if (!statsMap[order.customer_id]) statsMap[order.customer_id] = { count: 0, total: 0 }
    statsMap[order.customer_id].count += 1
    statsMap[order.customer_id].total += order.total_amount || 0
  }

  const customersWithStats = (customersRes.data || []).map(customer => ({
    ...customer,
    total_orders: statsMap[customer.id]?.count ?? 0,
    total_spent: statsMap[customer.id]?.total ?? 0,
  }))

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

const INVENTORY_SELECT = `
  *,
  category:parts_categories(id, name),
  vehicle:parts_vehicles!vehicle_id(id, make, model, year, vin),
  sold_to_customer:parts_customers!sold_to_customer_id(id, full_name, phone)
`

export async function getPartsInventory(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select(INVENTORY_SELECT)
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data as PartsInventoryItem[]
}

export async function getPartsInventoryItem(id: string) {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select(INVENTORY_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as PartsInventoryItem
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
      reserved_quantity: 0,
      // convert empty strings to null for UUID/optional fields
      category_id: input.category_id || null,
      vehicle_id: input.vehicle_id || null,
      storage_location_id: input.storage_location_id || null,
      location: input.location || null,
      shelf: input.shelf || null,
      bin: input.bin || null,
      part_number: input.part_number || null,
      description: input.description || null,
      notes: input.notes || null,
    })
    .select('*')
    .single()
  
  if (error) throw error
  return data as PartsInventoryItem
}

export async function updatePartsInventoryItem(id: string, updates: Partial<PartsInventoryItem>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { purchase_price, category, vehicle, ...rest } = updates as any
  // Convert empty strings to null for UUID and optional fields to avoid 400 errors
  // Only include UUID fields if explicitly provided — otherwise they'd be set to null,
  // overwriting existing values (e.g. vehicle_id gets wiped when selling a part)
  const safeUpdates = {
    ...rest,
    ...('category_id' in rest ? { category_id: rest.category_id || null } : {}),
    ...('vehicle_id' in rest ? { vehicle_id: rest.vehicle_id || null } : {}),
    ...('storage_location_id' in rest ? { storage_location_id: rest.storage_location_id || null } : {}),
    part_number: rest.part_number !== undefined ? (rest.part_number || null) : undefined,
    description: rest.description !== undefined ? (rest.description || null) : undefined,
    location: rest.location !== undefined ? (rest.location || null) : undefined,
    shelf: rest.shelf !== undefined ? (rest.shelf || null) : undefined,
    bin: rest.bin !== undefined ? (rest.bin || null) : undefined,
    notes: rest.notes !== undefined ? (rest.notes || null) : undefined,
  }
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

export async function createPartsOrder(
  partsCompanyId: string,
  input: { customer_id?: string | null; notes?: string; order_date?: string }
) {
  // Generate order number via RPC or fallback
  // Fallback includes random suffix to guarantee uniqueness if RPC fails
  let orderNumber = `P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const { data: rpcData, error: rpcError } = await supabase.rpc('generate_parts_order_number', {
    p_company_id: partsCompanyId,
  })
  if (rpcError) console.error('RPC generate_parts_order_number error:', rpcError)
  if (!rpcError && rpcData) orderNumber = rpcData as string

  const { data, error } = await supabase
    .from('parts_orders')
    .insert({
      parts_company_id: partsCompanyId,
      customer_id: input.customer_id || null,
      order_number: orderNumber,
      order_date: input.order_date || new Date().toISOString(),
      status: 'new',
      total_amount: 0,
      notes: input.notes || null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('createPartsOrder insert error:', error)
    throw error
  }
  return data as PartsOrder
}

export async function createPartsOrderItem(
  orderId: string,
  item: { inventory_item_id: string; quantity: number; price_at_sale: number; price_at_sale_currency?: 'UAH' | 'USD' }
) {
  const { data, error } = await supabase
    .from('parts_order_items')
    .insert({
      order_id: orderId,
      inventory_item_id: item.inventory_item_id,
      quantity: item.quantity,
      price_at_sale: item.price_at_sale,
      price_at_sale_currency: item.price_at_sale_currency || 'USD',
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updatePartsOrderTotal(orderId: string, exchangeRate: number = 41) {
  const { data: items } = await supabase
    .from('parts_order_items')
    .select('price_at_sale, quantity, price_at_sale_currency')
    .eq('order_id', orderId)

  const total = (items || []).reduce((s: number, i: any) => {
    const currency = i.price_at_sale_currency || 'UAH'
    const amount = (i.price_at_sale || 0) * (i.quantity || 1)
    const amountUAH = currency === 'USD' ? amount * exchangeRate : amount
    return s + amountUAH
  }, 0)

  const { error } = await supabase
    .from('parts_orders')
    .update({ total_amount: total })
    .eq('id', orderId)

  if (error) {
    console.error('updatePartsOrderTotal error:', JSON.stringify(error))
    throw error
  }
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
