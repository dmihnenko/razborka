import { supabase } from '@/lib/supabase'
import type {
  MarketPart,
  MarketSupplier,
  MarketCategory,
  MarketMakeFacet,
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

/** Безопасные публичные поля запчасти (полные — для страницы товара: с галереей photos) */
const PART_FIELDS = `
  id, name, article, part_number, description, condition, quantity, reserved_quantity,
  selling_price, price_currency, photo_url, photos, status, created_at
`

/** Лёгкие поля для списков/карточек — без тяжёлого photos jsonb (тумба берётся из photo_url) */
const PART_LIST_FIELDS = `
  id, name, article, part_number, description, condition, quantity, reserved_quantity,
  selling_price, price_currency, photo_url, status, created_at
`

const COMPANY_JOIN = `company:parts_companies!inner(id, name, phone, telegram, address, city, email, description, is_active, ship_speed, warranty_enabled, warranty_days)`
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
    article: row.article ?? null,
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
      city: row.company?.city ?? null,
      email: row.company?.email ?? null,
      description: row.company?.description ?? null,
      shipSpeed: row.company?.ship_speed ?? 'today',
      warrantyEnabled: row.company?.warranty_enabled ?? false,
      warrantyDays: row.company?.warranty_days ?? null,
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

  // фильтры по авто требуют inner-join (иначе «магазинные» позиции без авто отвалятся зря)
  const needVehicleInner = !!f.make?.trim() || !!f.model?.trim() || f.year != null

  let query = supabase
    .from('parts_inventory')
    .select(
      `${PART_LIST_FIELDS}, ${COMPANY_JOIN}, ${CATEGORY_JOIN}, ${vehicleJoin(needVehicleInner)}`,
      // estimated: точный COUNT для малых выборок, оценочный (по планировщику) для
      // больших — чтобы не считать 1M строк на каждой странице каталога.
      { count: 'estimated' }
    )
    .eq('status', 'available')
    .gt('selling_price', 0)
    .eq('company.is_active', true)
    .eq('company.market_published', true)

  if (f.search?.trim()) {
    const s = sanitizeSearch(f.search)
    query = query.or(`name.ilike.%${s}%,part_number.ilike.%${s}%,description.ilike.%${s}%`)
  }
  if (f.categoryId) query = query.eq('category_id', f.categoryId)
  if (f.condition) query = query.eq('condition', f.condition)
  if (f.companyId) query = query.eq('parts_company_id', f.companyId)
  if (f.make?.trim()) query = query.eq('vehicle.make', f.make.trim())
  if (f.model?.trim()) query = query.eq('vehicle.model', f.model.trim())
  if (f.year != null) query = query.eq('vehicle.year', f.year)
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
    .eq('company.market_published', true)
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
    .select(`${PART_LIST_FIELDS}, ${COMPANY_JOIN}, ${CATEGORY_JOIN}, ${vehicleJoin(false)}`)
    .eq('parts_company_id', companyId)
    .eq('status', 'available')
    .gt('selling_price', 0)
    .eq('company.is_active', true)
    .eq('company.market_published', true)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).map(mapPartRow)
}

// ── Разборки (поставщики) ───────────────────────────────────────────────────

const SUPPLIER_FIELDS = 'id, name, phone, telegram, address, city, email, description'

function mapSupplierRow(row: any, availableParts: number): MarketSupplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    telegram: row.telegram ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    email: row.email ?? null,
    description: row.description ?? null,
    availableParts,
  }
}

export async function getMarketSuppliers(): Promise<MarketSupplier[]> {
  // Один серверный запрос (RPC get_market_suppliers) вместо 1 + N count-запросов:
  // публикованные разборки + число доступных позиций агрегатом GROUP BY.
  const { data, error } = await supabase.rpc('get_market_suppliers')
  if (error) throw error
  return (data || []).map((r: any) => mapSupplierRow(r, Number(r.available_parts) || 0))
}

export async function getMarketSupplier(id: string): Promise<MarketSupplier | null> {
  const { data, error } = await supabase
    .from('parts_companies')
    .select(SUPPLIER_FIELDS)
    .eq('id', id)
    .eq('is_active', true)
    .eq('market_published', true)
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
      .eq('company.market_published', true)
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
      .eq('company.market_published', true)
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

/**
 * Справочный каталог авто для каскадных фильтров: Марка → Модель → Год.
 * Источник марок/моделей — таблица car_models; годы/счётчики — из доступных запчастей.
 */
export async function getMarketCarCatalog(): Promise<MarketMakeFacet[]> {
  try {
    const { data, error } = await supabase.rpc('get_market_car_catalog')
    if (error) throw error
    return (Array.isArray(data) ? data : []) as MarketMakeFacet[]
  } catch {
    return []
  }
}

/**
 * Предложить новую марку/модель в общий каталог авто (на утверждение админу).
 * Пишет pending-запись в car_models; дубли (already approved/pending) игнорируются.
 * Не бросает ошибку — заведение авто не должно падать из-за заявки в каталог.
 */
export async function suggestCarModel(
  make: string,
  model: string,
  partsCompanyId?: string | null
): Promise<void> {
  const mk = make.trim()
  const md = model.trim()
  if (!mk || !md) return
  try {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth?.user?.id
    if (!uid) return
    await supabase
      .from('car_models')
      .upsert(
        { make: mk, model: md, status: 'pending', is_active: false, suggested_by: uid, parts_company_id: partsCompanyId ?? null },
        { onConflict: 'make,model', ignoreDuplicates: true }
      )
  } catch {
    /* заявка в каталог — не критично */
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
    items: ((row.items || []) as any[]).map(it => {
      const inv = it.inventory
      const v = inv?.vehicle
      const vehicleName = v ? [v.make, v.model, v.year].filter(Boolean).join(' ') : null
      const storageName = inv?.storage_location?.name || inv?.location || null
      return {
        id: it.id,
        name: it.name,
        sellingPrice: it.selling_price ?? null,
        priceCurrency: it.price_currency === 'USD' ? 'USD' : 'UAH',
        quantity: it.quantity ?? 1,
        photoUrl: it.photo_url ?? null,
        inventoryId: it.inventory_id ?? null,
        vehicleName,
        storageName,
      }
    }),
  }
}

/** Заявки разборки (для авторизованной стороны — кабинет parts_owner/worker) */
export async function getMarketplaceOrders(companyId: string): Promise<MarketplaceOrder[]> {
  const { data, error } = await supabase
    .from('marketplace_orders')
    .select(
      `id, parts_company_id, buyer_name, buyer_phone, comment, status, total_amount, created_at, converted_order_id,
       items:marketplace_order_items(
         id, name, selling_price, price_currency, quantity, photo_url, inventory_id,
         inventory:parts_inventory!inventory_id(
           location,
           vehicle:parts_vehicles!vehicle_id(make, model, year),
           storage_location:parts_storage_locations!storage_location_id(name)
         )
       )`
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
 * Удаление неоформленной заявки с маркета.
 * Снимает бронь с привязанных позиций (reserved → available) — товар возвращается
 * в маркет. items удаляются каскадом (FK order_id ON DELETE CASCADE).
 */
export async function deleteMarketplaceOrder(order: MarketplaceOrder): Promise<void> {
  const invIds = order.items.map(i => i.inventoryId).filter(Boolean) as string[]
  if (invIds.length) {
    await supabase
      .from('parts_inventory')
      .update({ status: 'available' })
      .in('id', invIds)
      .eq('status', 'reserved')
  }
  const { error } = await supabase
    .from('marketplace_orders')
    .delete()
    .eq('id', order.id)
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
