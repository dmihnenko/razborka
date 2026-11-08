/**
 * Чистая логика единой формы продажи (без React и без сети): расчёт итога,
 * валидация, сборка плана вызовов сервисов. Выполняет план `createPartsSale`.
 */
import type { PriceCurrency } from '@/utils/currency'

/** Откуда открыта форма. Влияет только на режим по умолчанию. */
export type SaleSource = 'manual' | 'stock' | 'stock-bulk' | 'market'

/**
 * sell    — «Оформить продажу»: заказ сразу завершается (склад списывается, статус sold).
 * reserve — «Заказ в работе»: позиции в резерве (available → reserved), заказ остаётся «новым».
 */
export type SaleMode = 'sell' | 'reserve'

export interface SaleLine {
  itemId: string
  name: string
  partNumber?: string | null
  /** Количество на складе (item.quantity) — верхняя граница для продажи */
  maxQty: number
  quantity: number
  /** Цена строкой — как в поле ввода */
  price: string
  currency: PriceCurrency
  /** Объявленная цена (подсказка) */
  announcedPrice?: number | null
  /** Исходная валюта позиции (в ней объявлена цена; currency строки можно переключить) */
  listCurrency?: PriceCurrency
}

export type CustomerChoice =
  | { kind: 'none' }
  | { kind: 'existing'; id: string }
  | { kind: 'new'; name: string; phone: string }

export type SaleIssueCode = 'noItems' | 'badQty' | 'overStock' | 'badPrice' | 'rateMissing' | 'customerName'

export interface SaleIssue {
  code: SaleIssueCode
  /** Позиция, к которой относится ошибка (для badQty/overStock/badPrice) */
  itemId?: string
  name?: string
  /** Доступное количество (для overStock) */
  available?: number
}

/** Строка продажи из позиции склада (цена/валюта — объявленные, количество 1). */
export function lineFromInventory(item: {
  id: string
  name: string
  part_number?: string | null
  quantity: number
  selling_price?: number | null
  price_currency?: PriceCurrency | null
}): SaleLine {
  return {
    itemId: item.id,
    name: item.name,
    partNumber: item.part_number,
    maxQty: item.quantity,
    quantity: 1,
    price: item.selling_price ? String(item.selling_price) : '',
    currency: item.price_currency || 'USD',
    announcedPrice: item.selling_price,
    listCurrency: item.price_currency || 'USD',
  }
}

export function defaultSaleMode(source: SaleSource): SaleMode {
  // Заявка с маркета по умолчанию — заказ в работе (резерв), как и раньше
  return source === 'market' ? 'reserve' : 'sell'
}

/** Позиция заявки с маркета (минимум полей MarketplaceOrderItem). */
export interface MarketItemInput {
  name: string
  sellingPrice?: number | null
  priceCurrency: PriceCurrency
  quantity: number
  inventoryId?: string | null
}

/** Остаток позиции склада на момент открытия формы. */
export interface MarketStockInfo {
  quantity: number | null
  reserved_quantity?: number | null
  status?: string | null
  part_number?: string | null
}

export interface MarketSkippedItem {
  name: string
  reason: 'noInventory' | 'unavailable'
}

/**
 * Строки формы из позиций заявки: количество и цена — из заявки. Позиции без привязки к складу
 * или которых нет в наличии (нет строки / sold / damaged / свободно 0) не включаются — идут в skipped.
 * Дубли одной позиции склада суммируются. Если свободно меньше запрошенного — количество остаётся
 * из заявки, validateSale покажет «не хватает».
 */
export function marketItemsToSaleLines(
  items: MarketItemInput[],
  stock: Record<string, MarketStockInfo | undefined>,
): { lines: SaleLine[]; skipped: MarketSkippedItem[] } {
  const lines: SaleLine[] = []
  const skipped: MarketSkippedItem[] = []
  for (const it of items) {
    if (!it.inventoryId) { skipped.push({ name: it.name, reason: 'noInventory' }); continue }
    const st = stock[it.inventoryId]
    const free = st ? (st.quantity ?? 0) - (st.reserved_quantity ?? 0) : 0
    if (!st || st.status === 'sold' || st.status === 'damaged' || free <= 0) {
      skipped.push({ name: it.name, reason: 'unavailable' })
      continue
    }
    const qty = it.quantity || 1
    const existing = lines.find(l => l.itemId === it.inventoryId)
    if (existing) { existing.quantity += qty; continue }
    lines.push({
      itemId: it.inventoryId,
      name: it.name,
      partNumber: st.part_number,
      maxQty: free,
      quantity: qty,
      price: it.sellingPrice != null ? String(it.sellingPrice) : '',
      currency: it.priceCurrency,
      announcedPrice: it.sellingPrice ?? null,
      listCurrency: it.priceCurrency,
    })
  }
  return { lines, skipped }
}

/** Клиент для заявки: клиент компании с тем же телефоном, иначе новый (имя + телефон). */
export function customerFromMarketBuyer(
  buyer: { name?: string | null; phone?: string | null },
  customers: { id: string; phone?: string | null }[],
  fallbackName: string,
): CustomerChoice {
  const phone = (buyer.phone || '').trim()
  const found = phone ? customers.find(c => samePhone(c.phone, phone)) : undefined
  if (found) return { kind: 'existing', id: found.id }
  if (!phone && !buyer.name?.trim()) return { kind: 'none' }
  return { kind: 'new', name: buyer.name?.trim() || fallbackName, phone }
}

/** Комментарий заказа из заявки: «<префикс>» или «<префикс>: <комментарий покупателя>». */
export function marketOrderNotes(prefix: string, buyerComment?: string | null): string {
  const c = (buyerComment || '').trim()
  return c ? `${prefix}: ${c}` : prefix
}

/** Число из поля цены; пустое/некорректное/отрицательное → null. */
export function parsePrice(value: string): number | null {
  const s = (value ?? '').trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Приводит количество к целому в диапазоне [1, maxQty]. */
export function clampQty(value: number, maxQty: number): number {
  const max = Math.max(1, Math.floor(maxQty) || 1)
  const n = Math.floor(value) || 1
  return Math.max(1, Math.min(max, n))
}

/** Позиция уходит со склада целиком (остаток после продажи = 0). */
export function isFullySold(line: Pick<SaleLine, 'maxQty' | 'quantity'>): boolean {
  return line.maxQty - line.quantity <= 0
}

export interface SaleTotals {
  usd: number
  uah: number
  /** Итог в гривнах (USD по курсу); null — есть USD-позиции, а курса нет */
  totalUah: number | null
  hasUsd: boolean
}

/** Итог: суммы по валютам и общий в грн (как updatePartsOrderTotal: USD × курс). */
export function calcTotals(lines: SaleLine[], rate: number | null | undefined): SaleTotals {
  let usd = 0
  let uah = 0
  for (const l of lines) {
    const p = parsePrice(l.price) ?? 0
    const amount = p * (l.quantity || 0)
    if (l.currency === 'USD') usd += amount
    else uah += amount
  }
  const hasUsd = lines.some(l => l.currency === 'USD')
  const totalUah = hasUsd && rate == null ? null : uah + usd * (rate ?? 0)
  return { usd, uah, totalUah, hasUsd }
}

export interface ValidateOptions {
  mode: SaleMode
  rate: number | null | undefined
  customer: CustomerChoice
}

/** Первая найденная проблема или null. Остаток сверяется с item.quantity (свободный остаток дополнительно проверяет createPartsOrderItem). */
export function validateSale(lines: SaleLine[], opts: ValidateOptions): SaleIssue | null {
  if (lines.length === 0) return { code: 'noItems' }
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) return { code: 'badQty', itemId: l.itemId, name: l.name }
    if (l.quantity > l.maxQty) return { code: 'overStock', itemId: l.itemId, name: l.name, available: l.maxQty }
    const p = parsePrice(l.price)
    // Продажа может быть и бесплатной (0), для заказа в работе цена обязательна и > 0
    if (p == null || (opts.mode === 'reserve' && p <= 0)) return { code: 'badPrice', itemId: l.itemId, name: l.name }
  }
  if (opts.customer.kind === 'new' && !opts.customer.name.trim()) return { code: 'customerName' }
  // Без курса сумму заказа с USD-позициями не рассчитать — сделку не фиксируем
  if (lines.some(l => l.currency === 'USD') && opts.rate == null) return { code: 'rateMissing' }
  return null
}

export interface SalePlanItem {
  inventory_item_id: string
  quantity: number
  price_at_sale: number
  price_at_sale_currency: PriceCurrency
}

export interface SalePlanFinalize {
  itemId: string
  sold_price: number
  price_currency: PriceCurrency
}

export interface SalePlan {
  customer: CustomerChoice
  notes?: string
  /** Позиции для createPartsOrderItem (резерв + проверка остатка) */
  items: SalePlanItem[]
  /** true — после позиций завершить заказ (status=completed + exchange_rate_at_sale) */
  complete: boolean
  rate: number | null
  /** Метки «продано» (sold_price/sold_to_customer_id) — только для полностью проданных позиций и только при complete */
  finalize: SalePlanFinalize[]
  /** Заявка с маркета, из которой создаётся заказ (после создания связывается с ним) */
  marketOrderId?: string
}

/** Маппинг строк формы и режима в вызовы сервисов. Предполагает, что validateSale вернул null. */
export function buildSalePlan(
  lines: SaleLine[],
  opts: { mode: SaleMode; rate: number | null | undefined; customer: CustomerChoice; notes?: string; marketOrderId?: string },
): SalePlan {
  const complete = opts.mode === 'sell'
  const items = lines.map<SalePlanItem>(l => ({
    inventory_item_id: l.itemId,
    quantity: l.quantity,
    price_at_sale: parsePrice(l.price) ?? 0,
    price_at_sale_currency: l.currency,
  }))
  const finalize = complete
    ? lines.filter(isFullySold).map<SalePlanFinalize>(l => ({
        itemId: l.itemId,
        sold_price: parsePrice(l.price) ?? 0,
        price_currency: l.currency,
      }))
    : []
  const notes = opts.notes?.trim()
  return {
    customer: opts.customer,
    notes: notes || undefined,
    items,
    complete,
    rate: opts.rate ?? null,
    finalize,
    marketOrderId: opts.marketOrderId,
  }
}

/** Совпадение телефона по цифрам: запрос — подпоследовательность цифр номера («355253» найдёт «0953552553»). */
export function phoneDigitsMatch(phone: string, queryDigits: string): boolean {
  if (!queryDigits) return false
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.includes(queryDigits)) return true
  let i = 0
  for (let k = 0; k < digits.length && i < queryDigits.length; k++) {
    if (digits[k] === queryDigits[i]) i++
  }
  return i === queryDigits.length
}

/** Телефон только цифрами. */
export function normalizePhone(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '')
}

/** Один и тот же телефон: сравнение по последним 9 цифрам (формат +380/0/без кода не важен). */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = normalizePhone(a)
  const db = normalizePhone(b)
  if (da.length < 9 || db.length < 9) return false
  return da.slice(-9) === db.slice(-9)
}

/** Фильтр клиентов по имени или телефону. */
export function filterCustomers<T extends { full_name: string | null; phone?: string | null }>(customers: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return customers
  const digits = q.replace(/\D/g, '')
  return customers.filter(c =>
    (c.full_name || '').toLowerCase().includes(q) ||
    (digits.length > 0 && phoneDigitsMatch(c.phone || '', digits)),
  )
}
