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
  MyMarketplaceOrder,
  CartItem,
} from '@/types/marketplace'
import { oemOrClause } from '@/utils/partNumberSearch'

// ============================================================================
// ПУБЛИЧНЫЙ МАРКЕТПЛЕЙС — каталог читается анонимно (anon key)
// Показываем ТОЛЬКО безопасные поля parts_inventory (без закупки/локаций/заметок)
// ============================================================================

export const MARKET_PAGE_SIZE = 24

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Приведение результата select к форме строки БД.
 * Динамические select-строки (с вычисляемым vehicleJoin/`!inner`) не разбираются
 * типовым парсером supabase-js — data приходит как GenericStringError. Форма строк
 * гарантируется самими select-константами (PART_FIELDS/JOIN'ы), поэтому здесь
 * единая точка приведения к доменной row-форме вместо `any` в мапперах.
 */
function asRows<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as T[]
}
function asRow<T>(data: unknown): T {
  return data as T
}

/** Безопасные публичные поля запчасти (полные — для страницы товара: с галереей photos) */
const PART_FIELDS = `
  id, name, article, part_number, description, condition, quantity, reserved_quantity,
  selling_price, price_currency, photo_url, photos, status, created_at, market_category
`

/** Лёгкие поля для списков/карточек — без тяжёлого photos jsonb (тумба берётся из photo_url) */
const PART_LIST_FIELDS = `
  id, name, article, part_number, description, condition, quantity, reserved_quantity,
  selling_price, price_currency, photo_url, status, created_at, market_category
`

const COMPANY_JOIN = `company:parts_companies!inner(id, name, phone, telegram, address, city, email, description, is_active, ship_speed, warranty_enabled, warranty_days)`

function vehicleJoin(inner: boolean) {
  // VIN НЕ запрашиваем — публичный маркет не должен раскрывать VIN авто-донора.
  return `vehicle:parts_vehicles!vehicle_id${inner ? '!inner' : ''}(make, model, year)`
}

// ── Формы строк БД (snake_case) для мапперов ────────────────────────────────

/** Вложенный join company:parts_companies в строке market_inventory */
interface PartCompanyJoin {
  id?: string | null
  name?: string | null
  phone?: string | null
  telegram?: string | null
  address?: string | null
  city?: string | null
  email?: string | null
  description?: string | null
  is_active?: boolean | null
  ship_speed?: 'today' | 'days12' | string | null
  warranty_enabled?: boolean | null
  warranty_days?: number | null
}

/** Строка market_inventory с join'ами category/vehicle/company */
interface MarketPartRow {
  id: string
  name: string
  article?: string | null
  part_number?: string | null
  description?: string | null
  condition: string
  quantity?: number | null
  reserved_quantity?: number | null
  selling_price?: number | null
  price_currency?: string | null
  photo_url?: string | null
  photos?: MarketPhoto[] | null
  status?: string | null
  created_at?: string | null
  market_category?: string | null
  vehicle?: { make: string; model: string; year?: number | null } | null
  company?: PartCompanyJoin | null
}

// ── Маппинг row → MarketPart ────────────────────────────────────────────────

function mapPartRow(row: MarketPartRow): MarketPart {
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
    categorySlug: row.market_category ?? null,
    vehicle: row.vehicle
      ? {
          make: row.vehicle.make,
          model: row.vehicle.model,
          year: row.vehicle.year ?? null,
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
// Экранирование спецсимволов ilike (\ % _), чтобы сравнивать как точное значение без учёта регистра
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

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
    // market_inventory — view с safe-полями (published+available, без закупочных колонок):
    // и анонимы, и залогиненные читают витрину через неё, не получая чужой purchase_price.
    .from('market_inventory')
    .select(
      `${PART_LIST_FIELDS}, ${COMPANY_JOIN}, ${vehicleJoin(needVehicleInner)}`,
      // estimated: точный COUNT для малых выборок, оценочный (по планировщику) для
      // больших — чтобы не считать 1M строк на каждой странице каталога.
      { count: 'estimated' }
    )

  if (f.search?.trim()) {
    const s = sanitizeSearch(f.search)
    query = query.or(`name.ilike.%${s}%,part_number.ilike.%${s}%,description.ilike.%${s}%${oemOrClause(s)}`)
  }
  if (f.categoryId) {
    // старые ссылки ?category=<uuid> (внутренняя категория) продолжают работать; новые — slug раздела
    query = UUID_RE.test(f.categoryId) ? query.eq('category_id', f.categoryId) : query.eq('market_category', f.categoryId)
  }
  if (f.condition) query = query.eq('condition', f.condition)
  if (f.companyId) query = query.eq('parts_company_id', f.companyId)
  if (f.make?.trim()) query = query.ilike('vehicle.make', escapeIlike(f.make.trim()))
  if (f.model?.trim()) query = query.ilike('vehicle.model', escapeIlike(f.model.trim()))
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

  return { items: asRows<MarketPartRow>(data).map(mapPartRow), total: count ?? 0 }
}

export async function getMarketPart(id: string): Promise<MarketPart | null> {
  const { data, error } = await supabase
    .from('market_inventory')
    .select(`${PART_FIELDS}, ${COMPANY_JOIN}, ${vehicleJoin(false)}`)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? mapPartRow(asRow<MarketPartRow>(data)) : null
}

export async function getRelatedParts(
  companyId: string,
  excludeId: string,
  limit = 8
): Promise<MarketPart[]> {
  const { data, error } = await supabase
    .from('market_inventory')
    .select(`${PART_LIST_FIELDS}, ${COMPANY_JOIN}, ${vehicleJoin(false)}`)
    .eq('parts_company_id', companyId)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return asRows<MarketPartRow>(data).map(mapPartRow)
}

/** Запчасти по списку id (для «Избранного»). Доступные/опубликованные — через market_inventory. */
export async function getMarketPartsByIds(ids: string[]): Promise<MarketPart[]> {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('market_inventory')
    .select(`${PART_LIST_FIELDS}, ${COMPANY_JOIN}, ${vehicleJoin(false)}`)
    .in('id', ids)
  if (error) throw error
  return asRows<MarketPartRow>(data).map(mapPartRow)
}

// ── Публичная страница позиции (QR/ссылка) ──────────────────────────────────

/** Публичный набор полей позиции (SECURITY DEFINER RPC get_public_parts_item). */
export interface PublicPartsItem {
  id: string
  parts_company_id: string
  name: string
  part_number?: string | null
  description?: string | null
  notes?: string | null
  condition?: string | null
  quantity: number
  selling_price?: number | null
  sold_price?: number | null
  price_currency?: 'UAH' | 'USD' | null
  status: string
  photos?: MarketPhoto[] | null
  category?: { name: string } | null
  vehicle?: { make: string; model: string; year?: number | null } | null
}

/**
 * Публичная позиция по id (для QR/ссылки) через SECURITY DEFINER RPC:
 * отдаёт только безопасные поля любой позиции, не зависит от статуса/публикации.
 */
export async function getPublicPartsItem(id: string): Promise<PublicPartsItem | null> {
  const { data, error } = await supabase.rpc('get_public_parts_item', { p_id: id })
  if (error) throw error
  return data as PublicPartsItem | null
}

// ── Разборки (поставщики) ───────────────────────────────────────────────────

const SUPPLIER_FIELDS = 'id, name, phone, telegram, address, city, email, description'

/** Строка parts_companies (публичные контактные поля поставщика) */
interface SupplierRow {
  id: string
  name: string
  phone?: string | null
  telegram?: string | null
  address?: string | null
  city?: string | null
  email?: string | null
  description?: string | null
}

/** Строка RPC get_market_suppliers: поля поставщика + агрегат доступных позиций */
interface SupplierRpcRow extends SupplierRow {
  available_parts?: number | string | null
}

function mapSupplierRow(row: SupplierRow, availableParts: number): MarketSupplier {
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
  return ((data || []) as SupplierRpcRow[]).map(r => mapSupplierRow(r, Number(r.available_parts) || 0))
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

  return mapSupplierRow(data as SupplierRow, count ?? 0)
}

// ── Категории и марки (для фильтров) ───────────────────────────────────────

/** Имя раздела на языке интерфейса (выбор при рендере, чтобы смена языка не требовала перезапроса) */
export function marketCategoryName(c: Pick<MarketCategory, 'nameRu' | 'nameUk'>, lang?: string | null): string {
  return (lang?.startsWith('uk') ? c.nameUk : c.nameRu) || c.nameRu
}

/** Разделы маркета (справочник + количество) из кэша RPC get_market_categories; nameRu/nameUk. */
export async function getMarketCategories(): Promise<MarketCategory[]> {
  try {
    const { data, error } = await supabase.rpc('get_market_categories')
    if (error) throw error
    type Row = { slug?: string; name_ru?: string; name_uk?: string; count?: number | string }
    return ((data || []) as Row[])
      .filter(r => r.slug && Number(r.count) > 0)
      .map(r => ({
        slug: r.slug as string,
        nameRu: r.name_ru || (r.slug as string),
        nameUk: r.name_uk || r.name_ru || (r.slug as string),
        count: Number(r.count),
      }))
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
    type MakeFacetRow = { vehicle?: { make?: string | null } | null }
    for (const row of (data || []) as MakeFacetRow[]) {
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
  const sentCompanyIds: string[] = []
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
    if (error) {
      // Часть заявок уже ушла: вызывающий уберёт их из корзины, чтобы повтор не создал дубль.
      if (sentCompanyIds.length) throw new PartialSubmitError(sentCompanyIds, group.companyId, error)
      throw error
    }
    sentCompanyIds.push(group.companyId)
  }
}

/** Ошибка отправки заявок, когда часть разборок уже получила свои заявки. */
export class PartialSubmitError extends Error {
  constructor(
    public sentCompanyIds: string[],
    public failedCompanyId: string,
    public original: unknown
  ) {
    super('partial_submit')
    this.name = 'PartialSubmitError'
  }
}

/** Строка marketplace_order_items с join'ом склада (для мапперов кабинета разборки) */
interface MarketplaceOrderItemRow {
  id: string
  name: string
  selling_price?: number | null
  price_currency?: string | null
  quantity?: number | null
  photo_url?: string | null
  inventory_id?: string | null
  inventory?: {
    location?: string | null
    vehicle?: { make?: string | null; model?: string | null; year?: number | null } | null
    storage_location?: { name?: string | null } | null
  } | null
}

/** Строка marketplace_orders с вложенными items (кабинет разборки) */
interface MarketplaceOrderRow {
  id: string
  parts_company_id: string
  buyer_name?: string | null
  buyer_phone: string
  comment?: string | null
  status: string
  total_amount?: number | null
  created_at: string
  converted_order_id?: string | null
  items?: MarketplaceOrderItemRow[] | null
}

function mapOrderRow(row: MarketplaceOrderRow): MarketplaceOrder {
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
    items: (row.items || []).map(it => {
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
  return ((data || []) as MarketplaceOrderRow[]).map(mapOrderRow)
}

/** Кол-во новых (status='new') заявок с маркета — для счётчика в нижнем меню кабинета.
 *  head:true — без строк, только count. */
export async function countNewMarketplaceOrders(companyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('marketplace_orders')
    .select('id', { count: 'exact', head: true })
    .eq('parts_company_id', companyId)
    .eq('status', 'new')

  if (error) throw error
  return count ?? 0
}

// ── Кабинет клиента («Мои заказы») ─────────────────────────────────────────

/**
 * Заказы текущего покупателя для личного кабинета («Мои заказы»).
 * RLS (`market_orders_select_own`) отдаёт ТОЛЬКО заказы с `user_id = auth.uid()`,
 * поэтому отдельный фильтр не обязателен — но добавляем `.eq('user_id', uid)`
 * для явности (и чтобы гостевые заказы без user_id точно не подмешались).
 * Возвращает пустой массив для незалогиненного пользователя.
 */
export async function getMyMarketplaceOrders(): Promise<MyMarketplaceOrder[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return []

  const { data, error } = await supabase
    .from('marketplace_orders')
    .select(
      `id, status, total_amount, created_at, comment,
       parts_companies(name, phone, telegram, city),
       marketplace_order_items(name, selling_price, price_currency, quantity, photo_url)`
    )
    .eq('user_id', uid)
    .order('created_at', { ascending: false })

  if (error) throw error

  interface MyOrderItemRow {
    name: string
    selling_price?: number | null
    price_currency?: string | null
    quantity?: number | null
    photo_url?: string | null
  }
  interface MyOrderRow {
    id: string
    status: string
    total_amount?: number | null
    created_at: string
    comment?: string | null
    parts_companies?: { name?: string | null; phone?: string | null; telegram?: string | null; city?: string | null } | null
    marketplace_order_items?: MyOrderItemRow[] | null
  }

  return ((data || []) as MyOrderRow[]).map((row): MyMarketplaceOrder => {
    const c = row.parts_companies
    return {
      id: row.id,
      status: row.status as MarketplaceOrderStatus,
      totalAmount: row.total_amount ?? 0,
      createdAt: row.created_at,
      comment: row.comment ?? null,
      company: c
        ? {
            name: c.name ?? '',
            phone: c.phone ?? null,
            telegram: c.telegram ?? null,
            city: c.city ?? null,
          }
        : null,
      items: (row.marketplace_order_items || []).map((it) => ({
        name: it.name,
        sellingPrice: it.selling_price ?? null,
        priceCurrency: it.price_currency === 'USD' ? 'USD' : 'UAH',
        quantity: it.quantity ?? 1,
        photoUrl: it.photo_url ?? null,
      })),
    }
  })
}

/**
 * Покупатель отменяет свою заявку с маркета (статус → 'cancelled').
 * RPC `cancel_my_marketplace_order` проверяет владельца и допустимость отмены,
 * снимает бронь и уведомляет разборку. Бросает исключение при нарушении правил.
 */
export async function cancelMyMarketplaceOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_my_marketplace_order', { p_id: orderId })
  if (error) throw error
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
 * Сама заявка склад не бронирует (резерв ставит заказ при конвертации —
 * создание заказа из заявки → createPartsOrderItem), поэтому резерв
 * здесь не трогаем: иначе снялась бы бронь другого заказа. items удаляются
 * каскадом (FK order_id ON DELETE CASCADE).
 */
export async function deleteMarketplaceOrder(order: MarketplaceOrder): Promise<void> {
  const { error } = await supabase
    .from('marketplace_orders')
    .delete()
    .eq('id', order.id)
  if (error) throw error
}

/** Заявка уже оформлена в заказ — второй заказ из неё создавать нельзя. */
export class MarketOrderAlreadyConvertedError extends Error {
  orderId: string
  constructor(orderId: string) {
    super('market order already converted')
    this.name = 'MarketOrderAlreadyConvertedError'
    this.orderId = orderId
  }
}

/**
 * Проверка перед созданием заказа из заявки: перечитывает converted_order_id с сервера
 * (заявку могли оформить в другой вкладке/сотрудником). Бросает MarketOrderAlreadyConvertedError.
 */
export async function assertMarketOrderNotConverted(marketOrderId: string): Promise<void> {
  const { data, error } = await supabase
    .from('marketplace_orders')
    .select('converted_order_id')
    .eq('id', marketOrderId)
    .maybeSingle()
  if (error) throw error
  if (data?.converted_order_id) throw new MarketOrderAlreadyConvertedError(data.converted_order_id)
}

/**
 * Атомарно связывает заявку с заказом и закрывает её (converted_order_id + status='closed'),
 * только если она ещё не оформлена. Если строк не обновлено — MarketOrderAlreadyConvertedError.
 */
export async function linkMarketplaceOrderToPartsOrder(marketOrderId: string, partsOrderId: string): Promise<void> {
  const { data, error } = await supabase
    .from('marketplace_orders')
    .update({ converted_order_id: partsOrderId, status: 'closed' })
    .eq('id', marketOrderId)
    .is('converted_order_id', null)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new MarketOrderAlreadyConvertedError(marketOrderId)
}

export interface InventoryStockRow {
  quantity: number | null
  reserved_quantity: number | null
  status: string | null
  part_number: string | null
}

/** Остатки позиций склада по id (для предзаполнения формы продажи из заявки). */
export async function getInventoryStockByIds(
  partsCompanyId: string,
  ids: string[],
): Promise<Record<string, InventoryStockRow>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('parts_inventory')
    .select('id, quantity, reserved_quantity, status, part_number')
    .eq('parts_company_id', partsCompanyId)
    .in('id', ids)
  if (error) throw error
  const out: Record<string, InventoryStockRow> = {}
  for (const r of data || []) out[r.id] = r
  return out
}
