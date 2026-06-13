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

export interface PartsDashboardStats {
  vehicles: { total: number; awaiting: number; in_progress: number; dismantled: number }
  inventory: { total: number; available: number; lowStock: number; noPrice: number; valueUSD: number; valueUAH: number; fromVehicles: number; fromShop: number }
  orders: { total: number; new: number; in_progress: number; completed: number }
  revenueUSD: number
  customers: { total: number; withOrders: number }
  marketOrders: number
}

/** Агрегаты дашборда одним RPC (вместо ~6 запросов с клиентской агрегацией полных таблиц). */
export async function getPartsDashboardStats(partsCompanyId: string, rate = 41): Promise<PartsDashboardStats> {
  const { data, error } = await supabase.rpc('get_parts_dashboard_stats', {
    p_company: partsCompanyId,
    p_rate: rate,
  })
  if (error) throw error
  return data as PartsDashboardStats
}

/** Аналитика разборки одним серверным RPC (вместо нескольких клиентских запросов). */
export async function getPartsAnalytics(partsCompanyId: string, rate = 41): Promise<any> {
  const { data, error } = await supabase.rpc('get_parts_analytics', {
    p_company: partsCompanyId,
    p_rate: rate,
  })
  if (error) throw error
  return data
}

export async function getPartsInventory(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select(INVENTORY_SELECT)
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as PartsInventoryItem[]
}

/** Экранируем значение для PostgREST or()-фильтра (запятые/скобки ломают синтаксис) */
function sanitizeInventorySearch(s: string): string {
  return s.trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ')
}

export interface PartsInventoryPagedOpts {
  page?: number
  pageSize?: number
  status?: string
  vehicleId?: string
  source?: 'vehicles' | 'shop'
  search?: string
}

/** Серверная пагинация инвентаря (не заменяет getPartsInventory — для PartsInventory.tsx) */
export async function getPartsInventoryPaged(
  partsCompanyId: string,
  opts: PartsInventoryPagedOpts = {}
): Promise<{ items: PartsInventoryItem[]; total: number }> {
  const { page = 1, pageSize = 50, status, vehicleId, source, search } = opts

  let query = supabase
    .from('parts_inventory')
    .select(INVENTORY_SELECT, { count: 'exact' })
    .eq('parts_company_id', partsCompanyId)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (vehicleId && vehicleId !== 'all') {
    query = query.eq('vehicle_id', vehicleId)
  }
  if (source === 'vehicles') {
    query = query.not('vehicle_id', 'is', null)
  } else if (source === 'shop') {
    query = query.is('vehicle_id', null)
  }
  if (search?.trim()) {
    const s = sanitizeInventorySearch(search)
    query = query.or(`name.ilike.%${s}%,part_number.ilike.%${s}%`)
  }

  const from = (page - 1) * pageSize
  const to = page * pageSize - 1

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { items: (data ?? []) as PartsInventoryItem[], total: count ?? 0 }
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
  const { data, error } = await supabase
    .from('parts_inventory')
    .insert({
      ...input,
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
      purchase_price: input.purchase_price ?? null,
    })
    .select('*')
    .single()
  
  if (error) throw error
  return data as PartsInventoryItem
}

export async function updatePartsInventoryItem(id: string, updates: Partial<PartsInventoryItem>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { category, vehicle, ...rest } = updates as any
  // Convert empty strings to null for UUID and optional fields to avoid 400 errors
  // Only include UUID fields if explicitly provided — otherwise they'd be set to null,
  // overwriting existing values (e.g. vehicle_id gets wiped when selling a part)
  const safeUpdates = {
    ...rest,
    ...('purchase_price' in rest ? { purchase_price: rest.purchase_price ?? null } : {}),
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

// ============================================================================
// EXTRA HELPERS (used in pages)
// ============================================================================

/** Get single customer (e.g. for trash snapshot) */
export async function getPartsCustomer(id: string) {
  const { data, error } = await supabase
    .from('parts_customers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as PartsCustomer
}

/** Get single category (e.g. for trash snapshot) */
export async function getPartsCategoryById(id: string) {
  const { data, error } = await supabase
    .from('parts_categories')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as PartsCategory
}

/** Get category usage count (how many inventory items use each category) */
export async function getPartsCategoriesUsage(partsCompanyId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('parts_inventory')
    .select('category_id')
    .eq('parts_company_id', partsCompanyId)
  const map: Record<string, number> = {}
  ;(data || []).forEach(row => {
    if (row.category_id) map[row.category_id] = (map[row.category_id] || 0) + 1
  })
  return map
}

/** Delete a single order item and restore inventory status to available */
export async function deletePartsOrderItem(
  itemId: string,
  inventoryItemId: string
): Promise<void> {
  const { error } = await supabase.from('parts_order_items').delete().eq('id', itemId)
  if (error) throw error
  await supabase
    .from('parts_inventory')
    .update({ status: 'available' })
    .eq('id', inventoryItemId)
    .eq('status', 'reserved')
}

/** Update parts order status and optionally sync inventory item statuses */
export async function updatePartsOrderStatus(
  orderId: string,
  status: string,
  inventoryIds: string[],
  exchangeRate?: number | null
): Promise<void> {
  const updateData: Record<string, unknown> = { status }
  if (status === 'completed' && exchangeRate) {
    updateData.exchange_rate_at_sale = exchangeRate
  }
  const { error } = await supabase.from('parts_orders').update(updateData).eq('id', orderId)
  if (error) throw error

  if (inventoryIds.length > 0) {
    if (status === 'cancelled' || status === 'new' || status === 'in_progress') {
      await supabase
        .from('parts_inventory')
        .update({ status: 'available' })
        .in('id', inventoryIds)
        .in('status', ['reserved', 'sold'])
    }
  }
}

/** Delete a parts order (also restores inventory, then hard-deletes) */
export async function deletePartsOrder(
  orderId: string,
  inventoryIds: string[]
): Promise<void> {
  if (inventoryIds.length > 0) {
    await supabase
      .from('parts_inventory')
      .update({ status: 'available' })
      .in('id', inventoryIds)
      .in('status', ['reserved', 'sold'])
  }
  await supabase.from('parts_order_items').delete().eq('order_id', orderId)
  const { error } = await supabase.from('parts_orders').delete().eq('id', orderId)
  if (error) throw error
}

/** Get available inventory items for an order (status=available, qty>0) */
export async function getAvailablePartsInventory(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select('id, name, part_number, quantity, selling_price, price_currency, category:parts_categories(name)')
    .eq('parts_company_id', partsCompanyId)
    .eq('status', 'available')
    .gt('quantity', 0)
    .order('name')
  if (error) throw error
  return data
}

/** Get customers for dropdown (id, full_name, phone) */
export async function getPartsCustomersDropdown(partsCompanyId: string) {
  const { data, error } = await supabase
    .from('parts_customers')
    .select('id, full_name, phone')
    .eq('parts_company_id', partsCompanyId)
    .order('full_name')
  if (error) throw error
  return data
}

/** Update order customer / notes / np_ttn */
export async function updatePartsOrder(
  orderId: string,
  updates: { customer_id?: string | null; notes?: string | null; np_ttn?: string | null }
): Promise<void> {
  const { error } = await supabase.from('parts_orders').update(updates).eq('id', orderId)
  if (error) throw error
}


/**
 * Дублирует позицию склада:
 * копирует все поля, кроме id/created_at/updated_at,
 * name → "<name> (копия)", status='available', reserved_quantity=0, sold_* обнуляется.
 */
export async function duplicatePartsInventoryItem(
  id: string,
  partsCompanyId: string
): Promise<PartsInventoryItem> {
  const { data: src, error: fetchErr } = await supabase
    .from('parts_inventory')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, sold_price: _sp, sold_to_customer_id: _stc, reserved_quantity: _rq, ...rest } = src as any

  const copy: CreatePartsInventoryInput & Record<string, unknown> = {
    ...rest,
    name: `${src.name} (копия)`,
    status: 'available',
    parts_company_id: partsCompanyId,
    reserved_quantity: 0,
    category_id: src.category_id || null,
    vehicle_id: src.vehicle_id || null,
    storage_location_id: src.storage_location_id || null,
    location: src.location || null,
    shelf: src.shelf || null,
    bin: src.bin || null,
    part_number: src.part_number || null,
    description: src.description || null,
    notes: src.notes || null,
    purchase_price: src.purchase_price ?? null,
  }

  return createPartsInventoryItem(copy as CreatePartsInventoryInput, partsCompanyId)
}

/** Fetch all inventory items for a parts vehicle */
export async function getPartsInventoryByVehicle(vehicleId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select('*')
    .eq('vehicle_id', vehicleId)
  if (error) throw error
  return data || []
}

/**
 * Массово обновляет поля позиций склада (место хранения, категория).
 * Принимает ids и объект обновлений; бросает ошибку при неудаче.
 */
export async function bulkUpdateInventory(
  ids: string[],
  updates: { storage_location_id?: string | null; category_id?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('parts_inventory')
    .update(updates)
    .in('id', ids)
  if (error) throw error
}

/**
 * Массово удаляет позиции склада по ids.
 * Использует прямое удаление (без корзины) — вызывать только после подтверждения.
 */
export async function bulkDeleteInventory(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('parts_inventory')
    .delete()
    .in('id', ids)
  if (error) throw error
}

// ============================================================================
// GLOBAL CABINET SEARCH
// ============================================================================

/** Экранируем строку для PostgREST or()-фильтра */
function sanitizeSearchQuery(s: string): string {
  return s.trim().replace(/[,()%]/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface CabinetSearchResult {
  parts: any[]
  vehicles: any[]
  orders: any[]
  customers: any[]
}

export async function searchCabinet(
  partsCompanyId: string,
  q: string
): Promise<CabinetSearchResult> {
  if (q.trim().length < 2) {
    return { parts: [], vehicles: [], orders: [], customers: [] }
  }

  const s = sanitizeSearchQuery(q)

  const [partsRes, vehiclesRes, ordersRes, customersRes] = await Promise.all([
    supabase
      .from('parts_inventory')
      .select('id,name,part_number,selling_price,price_currency,status')
      .eq('parts_company_id', partsCompanyId)
      .or(`name.ilike.%${s}%,part_number.ilike.%${s}%`)
      .limit(5),
    supabase
      .from('parts_vehicles')
      .select('id,make,model,year,vin')
      .eq('parts_company_id', partsCompanyId)
      .or(`make.ilike.%${s}%,model.ilike.%${s}%,vin.ilike.%${s}%`)
      .limit(5),
    supabase
      .from('parts_orders')
      .select('id,order_number,status,total_amount')
      .eq('parts_company_id', partsCompanyId)
      .ilike('order_number', `%${s}%`)
      .limit(5),
    supabase
      .from('parts_customers')
      .select('id,full_name,phone')
      .eq('parts_company_id', partsCompanyId)
      .or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`)
      .limit(5),
  ])

  return {
    parts: partsRes.data ?? [],
    vehicles: vehiclesRes.data ?? [],
    orders: ordersRes.data ?? [],
    customers: customersRes.data ?? [],
  }
}
