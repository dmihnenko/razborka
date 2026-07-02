import { supabase } from '@/lib/supabase'
import type {
  PartsVehicle,
  PartsCustomer,
  PartsCategory,
  PartsInventoryItem,
  PartsOrder,
  PartsOrderItem,
  CreatePartsVehicleInput,
  CreatePartsCustomerInput,
  CreatePartsInventoryInput,
  CreatePartsCategoryInput,
  PartsCategorySuggestion,
  VehicleRoi,
  PartsOrderStatus,
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

  const updates: Partial<PartsVehicle> = { status }

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

export async function createPartsCategoriesBulk(names: string[], partsCompanyId: string, parentId?: string | null) {
  const rows = names.map((name, i) => ({
    name: name.trim(),
    parts_company_id: partsCompanyId,
    parent_id: parentId ?? null,
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
  storage_location:parts_storage_locations!storage_location_id(id, name),
  sold_to_customer:parts_customers!sold_to_customer_id(id, full_name, phone)
`

export interface PartsDashboardStats {
  vehicles: { total: number; awaiting: number; in_progress: number; dismantled: number }
  inventory: { total: number; available: number; lowStock: number; needsFill: number; valueUSD: number; valueUAH: number; fromVehicles: number; fromShop: number }
  orders: { total: number; new: number; assembling?: number; shipped?: number; in_progress: number; completed: number }
  revenueUSD: number
  revenueOrders?: number
  profitUSD?: number
  profitItems?: number
  customers: { total: number; withOrders: number }
  marketOrders: number
}

/** Агрегаты дашборда одним RPC (вместо ~6 запросов с клиентской агрегацией полных таблиц). */
export type DashboardPeriod = 'today' | '7d' | 'month' | 'all'

export async function getPartsDashboardStats(partsCompanyId: string, rate: number, period: DashboardPeriod = 'all'): Promise<PartsDashboardStats> {
  const { data, error } = await supabase.rpc('get_parts_dashboard_stats', {
    p_company: partsCompanyId,
    p_rate: rate,
    p_period: period,
  })
  if (error) throw error
  return data as PartsDashboardStats
}

/** Форма ответа RPC get_parts_analytics (json_build_object на сервере). */
export interface PartsAnalytics {
  totalRevenue: number
  totalOrders: number
  completedOrders: number
  totalSoldParts: number
  avgCheck: number
  inventoryValue: number
  potentialMargin: number
  totalVehicles: number
  dismantledVehicles: number
  monthly: Array<{ month: string; revenue: number; orders: number }>
  topParts: Array<{ name: string; sold_quantity: number; revenue: number }>
}

/** Аналитика разборки одним серверным RPC (вместо нескольких клиентских запросов). */
export async function getPartsAnalytics(partsCompanyId: string, rate: number): Promise<PartsAnalytics> {
  const { data, error } = await supabase.rpc('get_parts_analytics', {
    p_company: partsCompanyId,
    p_rate: rate,
  })
  if (error) throw error
  return data as PartsAnalytics
}

/** Окупаемость авто: на каждое авто — вложено (цена авто), возвращено, остаток, прибыль, %. */
export async function getVehicleRoi(partsCompanyId: string, rate: number): Promise<VehicleRoi[]> {
  const { data, error } = await supabase.rpc('get_vehicle_roi', {
    p_company: partsCompanyId,
    p_rate: rate,
  })
  if (error) throw error
  return (data ?? []) as VehicleRoi[]
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

export interface PartsInventorySummary {
  stockUSD: number; soldUSD: number
  availableCount: number; reservedCount: number; soldCount: number
  /** Непроданные без цены ИЛИ без оригинального номера (серверный счёт по всей выборке) */
  needsFill: number
  /** Непроданные без фото */
  noPhoto: number
}

/** Серверный агрегат стоимости склада/продаж по ВСЕЙ выборке (не по подгруженной странице). */
export async function getPartsInventorySummary(
  partsCompanyId: string,
  rate: number,
  isShop?: boolean,
): Promise<PartsInventorySummary> {
  const { data, error } = await supabase.rpc('get_parts_inventory_summary', {
    p_company: partsCompanyId,
    p_rate: rate,
    // null = вся компания; false = разборка; true = магазин (вкладки не пересекаются)
    p_is_shop: isShop ?? null,
  })
  if (error) throw error
  return data as PartsInventorySummary
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
    query = query.eq('is_shop', false)   // разборка (с авто или без — главное не магазин)
  } else if (source === 'shop') {
    query = query.eq('is_shop', true)    // магазин (наполняется отдельным меню)
  }
  if (search?.trim()) {
    const s = sanitizeInventorySearch(search)
    query = query.or(`name.ilike.%${s}%,part_number.ilike.%${s}%,article.ilike.%${s}%`)
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
  const { category, vehicle, ...rest } = updates
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

/**
 * Дозаписать фото к товару, НЕ перетирая уже привязанные.
 *
 * Используется для фоновой выгрузки: пользователь нажал «Добавить», не дождавшись
 * загрузки, и фото догружаются после создания товара. Перечитываем актуальные
 * `photos` (а не снимок на момент сабмита — иначе гонка перезаписи), добавляем новые
 * без дублей по `url`, и сохраняем с ретраем (сетевой сбой не должен терять фото).
 *
 * @returns обновлённый товар; если добавлять нечего (всё уже привязано) — текущий.
 */
export async function appendPartsItemPhotos(
  id: string,
  newPhotos: Array<{ url: string }>,
  retries = 3,
): Promise<PartsInventoryItem> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const current = await getPartsInventoryItem(id)
      const existing = ((current.photos as Array<{ url: string }> | undefined) ?? [])
      const seen = new Set(existing.map(p => p.url))
      const toAdd = newPhotos.filter(p => p.url && !seen.has(p.url))
      if (!toAdd.length) return current
      return await updatePartsInventoryItem(id, { photos: [...existing, ...toAdd] as any })
    } catch (err) {
      lastErr = err
      // экспоненциальный бэкофф: 1с → 2с → 4с; последняя попытка — без ожидания
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
      }
    }
  }
  throw lastErr
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
    .maybeSingle()  // не .single(): удалённый/несуществующий заказ → null, а не 406

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

/**
 * Атомарная продажа запчасти через RPC sell_part (одна транзакция):
 * опц. клиент → заказ → позиция → completed (триггер спишет quantity, sold при 0).
 * Заменяет прежние 6 нетранзакционных запросов. Возвращает id заказа.
 */
export async function sellPart(params: {
  itemId: string
  price: number
  currency: 'UAH' | 'USD'
  rate?: number | null
  quantity?: number
  customerId?: string | null
  newCustomerName?: string
  newCustomerPhone?: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('sell_part', {
    p_item_id: params.itemId,
    p_price: params.price,
    p_currency: params.currency,
    p_rate: params.rate ?? null,
    p_quantity: params.quantity ?? 1,
    p_customer_id: params.customerId ?? null,
    p_new_customer_name: params.newCustomerName ?? null,
    p_new_customer_phone: params.newCustomerPhone ?? null,
  })
  if (error) throw error
  return data as string
}

export interface RecentPartsOrder {
  id: string
  order_number: string
  order_date: string
  status: PartsOrderStatus
  total_amount: number
  exchange_rate_at_sale: number | null
  customer: { full_name: string | null } | null
  items: { price_at_sale: number | null; quantity: number | null; price_at_sale_currency?: 'UAH' | 'USD' | null }[]
}

/** Последние заказы разборки для дашборда (вынесено из компонента в сервисный слой). */
export async function getRecentPartsOrders(partsCompanyId: string, limit = 6): Promise<RecentPartsOrder[]> {
  const { data, error } = await supabase
    .from('parts_orders')
    .select(`
      id, order_number, order_date, status, total_amount, exchange_rate_at_sale,
      customer:parts_customers(full_name),
      items:parts_order_items(price_at_sale, quantity, price_at_sale_currency)
    `)
    .eq('parts_company_id', partsCompanyId)
    .order('order_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  // supabase выводит to-one join (customer) как массив — форма фактически объектная.
  return (data || []) as unknown as RecentPartsOrder[]
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

  // Авторезерв: позиция бронируется сразу при добавлении в заказ (статус «available» → «reserved»).
  if (item.inventory_item_id) {
    await supabase
      .from('parts_inventory')
      .update({ status: 'reserved' })
      .eq('id', item.inventory_item_id)
      .eq('status', 'available')
  }

  return data
}

export async function updatePartsOrderTotal(orderId: string, exchangeRate?: number | null) {
  const { data: items } = await supabase
    .from('parts_order_items')
    .select('price_at_sale, quantity, price_at_sale_currency')
    .eq('order_id', orderId)

  const total = (items || []).reduce((s: number, i: Pick<PartsOrderItem, 'price_at_sale' | 'quantity' | 'price_at_sale_currency'>) => {
    const currency = i.price_at_sale_currency || 'UAH'
    const amount = (i.price_at_sale || 0) * (i.quantity || 1)
    // USD → грн только при известном курсе; иначе считаем сумму без USD-позиций (без хардкода)
    const amountUAH = currency === 'USD' ? (exchangeRate != null ? amount * exchangeRate : 0) : amount
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

export async function updateStorageLocation(id: string, updates: { name?: string; sort_order?: number; parent_id?: string | null }) {
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
  // Отмена — атомарно через RPC: возвращает остатки завершённого заказа (quantity +
  // sold→available) либо снимает резерв, затем ставит 'cancelled'. Симметрично списанию.
  if (status === 'cancelled') {
    const { error } = await supabase.rpc('cancel_parts_order', { p_order_id: orderId })
    if (error) throw error
    return
  }

  const updateData: Record<string, unknown> = { status }
  if (status === 'completed' && exchangeRate) {
    updateData.exchange_rate_at_sale = exchangeRate
  }
  const { error } = await supabase.from('parts_orders').update(updateData).eq('id', orderId)
  if (error) throw error

  // Синхронизация инвентаря с этапом заказа:
  //  • new/assembling/shipped — позиции в резерве (в т.ч. возврат из «продано» при отмене завершения);
  //  • completed — статус «sold» проставляет триггер complete_parts_order.
  if (inventoryIds.length > 0) {
    if (status === 'new' || status === 'assembling' || status === 'shipped' || status === 'in_progress') {
      const { error: invErr } = await supabase
        .from('parts_inventory')
        .update({ status: 'reserved' })
        .in('id', inventoryIds)
        .in('status', ['available', 'sold'])
      if (invErr) throw invErr
    }
  }
}

/**
 * Delete a parts order atomically (RPC): корректно возвращает остатки склада
 * (для завершённого — quantity + sold→available; иначе снимает резерв), удаляет
 * позиции и заказ в одной транзакции. `inventoryIds` больше не нужен (revert идёт
 * по parts_order_items внутри RPC) — параметр оставлен для обратной совместимости.
 */
export async function deletePartsOrder(
  orderId: string,
  _inventoryIds?: string[]
): Promise<void> {
  const { error } = await supabase.rpc('delete_parts_order', { p_order_id: orderId })
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

  const source = src as PartsInventoryItem
  const { id: _id, created_at: _ca, updated_at: _ua, sold_price: _sp, sold_to_customer_id: _stc, reserved_quantity: _rq, ...rest } = source

  const copy: Record<string, unknown> = {
    ...rest,
    name: `${source.name} (копия)`,
    status: 'available',
    parts_company_id: partsCompanyId,
    reserved_quantity: 0,
    category_id: source.category_id || null,
    vehicle_id: source.vehicle_id || null,
    storage_location_id: source.storage_location_id || null,
    location: source.location || null,
    shelf: source.shelf || null,
    bin: source.bin || null,
    part_number: source.part_number || null,
    description: source.description || null,
    notes: source.notes || null,
    purchase_price: source.purchase_price ?? null,
  }

  // copy собирается динамическим spread'ом (...rest + переопределения), поэтому
  // структурно эквивалентен CreatePartsInventoryInput, но TS не может это вывести —
  // граничный каст через unknown (не подмена типа, форма реально совпадает).
  return createPartsInventoryItem(copy as unknown as CreatePartsInventoryInput, partsCompanyId)
}

/** Fetch all inventory items for a parts vehicle */
export async function getPartsInventoryByVehicle(vehicleId: string): Promise<PartsInventoryItem[]> {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select('*')
    .eq('vehicle_id', vehicleId)
  if (error) throw error
  return (data ?? []) as PartsInventoryItem[]
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

export type CabinetSearchPart = Pick<PartsInventoryItem, 'id' | 'name' | 'part_number' | 'selling_price' | 'price_currency' | 'status'>
export type CabinetSearchVehicle = Pick<PartsVehicle, 'id' | 'make' | 'model' | 'year' | 'vin'>
export type CabinetSearchOrder = Pick<PartsOrder, 'id' | 'order_number' | 'status' | 'total_amount'>
export type CabinetSearchCustomer = Pick<PartsCustomer, 'id' | 'full_name' | 'phone'>

export interface CabinetSearchResult {
  parts: CabinetSearchPart[]
  vehicles: CabinetSearchVehicle[]
  orders: CabinetSearchOrder[]
  customers: CabinetSearchCustomer[]
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
