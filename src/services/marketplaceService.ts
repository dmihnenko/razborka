import { supabase } from '@/lib/supabase'
import type {
  MarketPart,
  MarketSupplier,
  MarketCategory,
  MarketFilters,
  MarketPhoto,
  MarketplaceOrder,
  MarketplaceOrderStatus,
  CartItem,
} from '@/types/marketplace'
import {
  createPartsOrder,
  createPartsOrderItem,
  updatePartsOrderTotal,
} from '@/services/partsService'

// ============================================================================
// ПУБЛИЧНЫЙ МАРКЕТПЛЕЙС — каталог читается анонимно (anon key)
// Показываем ТОЛЬКО безопасные поля parts_inventory (без закупки/локаций/заметок)
// ============================================================================

export const MARKET_PAGE_SIZE = 24

/** Безопасные публичные поля запчасти */
const PART_FIELDS = `
  id, name, part_number, description, condition, quantity, reserved_quantity,
  selling_price, price_currency, photo_url, photos, status, created_at
`

const COMPANY_JOIN = `company:parts_companies!inner(id, name, phone, telegram, address, email, description, is_active)`
const CATEGORY_JOIN = `category:parts_categories(id, name)`

function vehicleJoin(inner: boolean) {
  return `vehicle:parts_vehicles!vehicle_id${inner ? '!inner' : ''}(make, model, year, vin)`
}

// ── Маппинг row → MarketPart ────────────────────────────────────────────────

function mapPartRow(row: any): MarketPart {
  const photos: MarketPhoto[] = Array.isArray(row.photos) ? row.photos : []
  const first = photos[0]
  return {
    id: row.id,
    name: row.name,
    partNumber: row.part_number ?? null,
    description: row.description ?? null,
    condition: row.condition,
    quantity: row.quantity ?? 1,
    sellingPrice: row.selling_price ?? 0,
    priceCurrency: row.price_currency === 'USD' ? 'USD' : 'UAH',
    photoUrl: row.photo_url || first?.thumb_url || first?.display_url || first?.url || null,
    photos,
    categoryName: row.category?.name ?? null,
    vehicle: row.vehicle
      ? {
          make: row.vehicle.make,
          model: row.vehicle.model,
          year: row.vehicle.year ?? null,
          vin: row.vehicle.vin ?? null,
        }
      : null,
    company: {
      id: row.company?.id ?? '',
      name: row.company?.name ?? '',
      phone: row.company?.phone ?? null,
      telegram: row.company?.telegram ?? null,
      address: row.company?.address ?? null,
      email: row.company?.email ?? null,
      description: row.company?.description ?? null,
    },
  }
}

/** Экранируем значение для PostgREST or()-фильтра (запятые/скобки ломают синтаксис) */
function sanitizeSearch(s: string): string {
  return s.trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ')
}

// ── Каталог ─────────────────────────────────────────────────────────────────

export async function getMarketParts(
  f: MarketFilters = {}
): Promise<{ items: MarketPart[]; total: number }> {
  const page = Math.max(1, f.page ?? 1)
  const pageSize = f.pageSize ?? MARKET_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // make-фильтр требует inner-join по авто (иначе «магазинные» позиции без авто отвалятся зря)
  const needVehicleInner = !!f.make?.trim()

  let query = supabase
    .from('parts_inventory')
    .select(
      `${PART_FIELDS}, ${COMPANY_JOIN}, ${CATEGORY_JOIN}, ${vehicleJoin(needVehicleInner)}`,
      { count: 'exact' }
    )
    .eq('status', 'available')
    .gt('selling_price', 0)
    .eq('company.is_active', true)

  if (f.search?.trim()) {
    const s = sanitizeSearch(f.search)
    query = query.or(`name.ilike.%${s}%,part_number.ilike.%${s}%,description.ilike.%${s}%`)
  }
  if (f.categoryId) query = query.eq('category_id', f.categoryId)
  if (f.condition) query = query.eq('condition', f.condition)
  if (f.companyId) query = query.eq('parts_company_id', f.companyId)
  if (needVehicleInner) query = query.ilike('vehicle.make', `%${f.make!.trim()}%`)
  if (f.minPrice != null && f.minPrice > 0) query = query.gte('selling_price', f.minPrice)
  if (f.maxPrice != null && f.maxPrice > 0) query = query.lte('selling_price', f.maxPrice)

  switch (f.sort) {
    case 'price_asc':
      query = query.order('selling_price', { ascending: true })
      break
    case 'price_desc':
      query = query.order('selling_price', { ascending: false })
      break
    case 'new':
    default:
      query = query.order('created_at', { ascending: false })
  }

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  return { items: (data || []).map(mapPartRow), total: count ?? 0 }
}

export async function getMarketPart(id: string): Promise<MarketPart | null> {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select(`${PART_FIELDS}, ${COMPANY_JOIN}, ${CATEGORY_JOIN}, ${vehicleJoin(false)}`)
    .eq('id', id)
    .eq('company.is_active', true)
    .maybeSingle()

  if (error) throw error
  return data ? mapPartRow(data) : null
}

export async function getRelatedParts(
  companyId: string,
  excludeId: string,
  limit = 8
): Promise<MarketPart[]> {
  const { data, error } = await supabase
    .from('parts_inventory')
    .select(`${PART_FIELDS}, ${COMPANY_JOIN}, ${CATEGORY_JOIN}, ${vehicleJoin(false)}`)
    .eq('parts_company_id', companyId)
    .eq('status', 'available')
    .gt('selling_price', 0)
    .eq('company.is_active', true)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).map(mapPartRow)
}

// ── Разборки (поставщики) ───────────────────────────────────────────────────

const SUPPLIER_FIELDS = 'id, name, phone, telegram, address, email, description'

function mapSupplierRow(row: any, availableParts: number): MarketSupplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    telegram: row.telegram ?? null,
    address: row.address ?? null,
    email: row.email ?? null,
    description: row.description ?? null,
    availableParts,
  }
}

export async function getMarketSuppliers(): Promise<MarketSupplier[]> {
  const { data, error } = await supabase
    .from('parts_companies')
    .select(SUPPLIER_FIELDS)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  const companies = data || []
  if (companies.length === 0) return []

  // Число доступных товаров — head-count на компанию (компаний немного)
  const counts = await Promise.all(
    companies.map(c =>
      supabase
        .from('parts_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', c.id)
        .eq('status', 'available')
        .gt('selling_price', 0)
    )
  )

  return companies.map((c, i) => mapSupplierRow(c, counts[i].count ?? 0))
}

export async function getMarketSupplier(id: string): Promise<MarketSupplier | null> {
  const { data, error } = await supabase
    .from('parts_companies')
    .select(SUPPLIER_FIELDS)
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const { count } = await supabase
    .from('parts_inventory')
    .select('id', { count: 'exact', head: true })
    .eq('parts_company_id', id)
    .eq('status', 'available')
    .gt('selling_price', 0)

  return mapSupplierRow(data, count ?? 0)
}

// ── Категории и марки (для фильтров) ───────────────────────────────────────

export async function getMarketCategories(): Promise<MarketCategory[]> {
  try {
    const { data, error } = await supabase
      .from('parts_inventory')
      .select(
        `category_id, category:parts_categories!inner(id, name), company:parts_companies!inner(is_active)`
      )
      .eq('status', 'available')
      .gt('selling_price', 0)
      .eq('company.is_active', true)
      .not('category_id', 'is', null)
      .limit(5000)

    if (error) throw error

    const map = new Map<string, MarketCategory>()
    for (const row of (data || []) as any[]) {
      const cat = row.category
      if (!cat?.id || !cat?.name) continue
      const existing = map.get(cat.id)
      if (existing) existing.count += 1
      else map.set(cat.id, { id: cat.id, name: cat.name, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
  } catch {
    return []
  }
}

export async function getMarketMakes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('parts_inventory')
      .select(
        `id, vehicle:parts_vehicles!vehicle_id!inner(make), company:parts_companies!inner(is_active)`
      )
      .eq('status', 'available')
      .gt('selling_price', 0)
      .eq('company.is_active', true)
      .limit(5000)

    if (error) throw error

    const seen = new Map<string, string>() // lower → original
    for (const row of (data || []) as any[]) {
      const make = (row.vehicle?.make || '').trim()
      if (!make) continue
      const key = make.toLowerCase()
      if (!seen.has(key)) seen.set(key, make)
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'ru'))
  } catch {
    return []
  }
}

// ── Заявки покупателей ─────────────────────────────────────────────────────

/**
 * Отправка заявок анонимным покупателем.
 * Корзина может содержать товары разных разборок — по одной заявке (RPC) на компанию.
 */
export async function submitMarketOrders(
  groups: { companyId: string; items: CartItem[] }[],
  buyer: { phone: string; name?: string; comment?: string }
): Promise<void> {
  for (const group of groups) {
    if (!group.items.length) continue
    const { error } = await supabase.rpc('submit_marketplace_order', {
      p_company_id: group.companyId,
      p_buyer_phone: buyer.phone,
      p_buyer_name: buyer.name?.trim() || null,
      p_comment: buyer.comment?.trim() || null,
      p_items: group.items.map(i => ({
        inventory_id: i.inventoryId,
        name: i.name,
        selling_price: i.sellingPrice,
        price_currency: i.priceCurrency,
        quantity: i.quantity,
        photo_url: i.photoUrl ?? null,
      })),
    })
    if (error) throw error
  }
}

function mapOrderRow(row: any): MarketplaceOrder {
  return {
    id: row.id,
    partsCompanyId: row.parts_company_id,
    buyerName: row.buyer_name ?? null,
    buyerPhone: row.buyer_phone,
    comment: row.comment ?? null,
    status: row.status as MarketplaceOrderStatus,
    totalAmount: row.total_amount ?? 0,
    createdAt: row.created_at,
    convertedOrderId: row.converted_order_id ?? null,
    items: ((row.items || []) as any[]).map(it => ({
      id: it.id,
      name: it.name,
      sellingPrice: it.selling_price ?? null,
      priceCurrency: it.price_currency === 'USD' ? 'USD' : 'UAH',
      quantity: it.quantity ?? 1,
      photoUrl: it.photo_url ?? null,
      inventoryId: it.inventory_id ?? null,
    })),
  }
}

/** Заявки разборки (для авторизованной стороны — кабинет parts_owner/worker) */
export async function getMarketplaceOrders(companyId: string): Promise<MarketplaceOrder[]> {
  const { data, error } = await supabase
    .from('marketplace_orders')
    .select(
      `id, parts_company_id, buyer_name, buyer_phone, comment, status, total_amount, created_at, converted_order_id,
       items:marketplace_order_items(id, name, selling_price, price_currency, quantity, photo_url, inventory_id)`
    )
    .eq('parts_company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapOrderRow)
}

export async function updateMarketplaceOrderStatus(
  id: string,
  status: MarketplaceOrderStatus
): Promise<void> {
  const { error } = await supabase
    .from('marketplace_orders')
    .update({ status })
    .eq('id', id)

  if (error) throw error
}

/**
 * Конвертирует заявку покупателя с маркета в полноценный заказ разборки за 1 клик:
 * 1) находит клиента по телефону (или заводит нового),
 * 2) создаёт parts_order с позициями из заявки,
 * 3) резервирует склад (available → reserved),
 * 4) пересчитывает сумму заказа,
 * 5) связывает заявку с заказом (converted_order_id) и закрывает её.
 * Повторная конвертация защищена: если заявка уже оформлена — возвращает существующий заказ.
 */
export async function convertMarketplaceOrderToPartsOrder(
  order: MarketplaceOrder,
  partsCompanyId: string,
  exchangeRate: number
): Promise<{ orderId: string }> {
  if (order.convertedOrderId) return { orderId: order.convertedOrderId }

  // 1. Клиент по телефону (в рамках компании) или новый
  let customerId: string | null = null
  const phone = (order.buyerPhone || '').trim()
  if (phone) {
    const { data: existing } = await supabase
      .from('parts_customers')
      .select('id')
      .eq('parts_company_id', partsCompanyId)
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()
    if (existing) {
      customerId = existing.id
    } else {
      const { data: created, error: cErr } = await supabase
        .from('parts_customers')
        .insert({
          parts_company_id: partsCompanyId,
          full_name: order.buyerName?.trim() || 'Покупатель с маркета',
          phone,
        })
        .select('id')
        .single()
      if (cErr) throw cErr
      customerId = created.id
    }
  }

  // 2. Заказ
  const newOrder = await createPartsOrder(partsCompanyId, {
    customer_id: customerId,
    notes: order.comment?.trim()
      ? `Заявка с маркета: ${order.comment.trim()}`
      : 'Заявка с маркета',
  })

  // 3. Позиции + резерв склада
  const inventoryIds: string[] = []
  for (const it of order.items) {
    if (!it.inventoryId) continue // позиция без привязки к складу — пропускаем
    await createPartsOrderItem(newOrder.id, {
      inventory_item_id: it.inventoryId,
      quantity: it.quantity || 1,
      price_at_sale: it.sellingPrice ?? 0,
      price_at_sale_currency: it.priceCurrency,
    })
    inventoryIds.push(it.inventoryId)
  }
  if (inventoryIds.length) {
    await supabase
      .from('parts_inventory')
      .update({ status: 'reserved' })
      .in('id', inventoryIds)
      .eq('status', 'available')
  }

  // 4. Сумма заказа
  await updatePartsOrderTotal(newOrder.id, exchangeRate)

  // 5. Связать заявку с заказом и закрыть
  const { error: uErr } = await supabase
    .from('marketplace_orders')
    .update({ converted_order_id: newOrder.id, status: 'closed' })
    .eq('id', order.id)
  if (uErr) throw uErr

  return { orderId: newOrder.id }
}
