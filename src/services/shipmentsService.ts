import { supabase } from '@/lib/supabase'

// ============================================================================
// Трекинг посылок (ТТН Новой Почты) по заказам разборки.
// ⚠️ Требует миграции database/migrations/2026-06-16_parts_shipments.sql
// ============================================================================

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/'

/** Маска ТТН: 14 цифр группами 2-4-4-4 → «59 0017 0979 2706». Для хранения/НП снимаем пробелы. */
export function formatTtn(v: string): string {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 14)
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10), d.slice(10, 14)].filter(Boolean).join(' ')
}

/** Краткое авто-происхождение запчасти (для отличия «с какой машины»). */
export interface VehicleBrief {
  make: string | null
  model: string | null
  year: number | null
}

/** Позиция склада, привязанная к ТТН (опционально). */
export interface ShipmentItemRef {
  inventory_item_id: string
  item: { id: string; name: string; part_number: string | null; vehicle: VehicleBrief | null } | null
}

/** Заказ, к которому привязана ТТН (если есть) — для №заказа и клиента. */
export interface ShipmentOrderRef {
  id: string
  order_number: string | null
  customer: { full_name: string | null; phone: string | null } | null
}

/** Метка авто: «Make Model Year» или '' если авто не привязано. */
export function vehicleLabel(v: VehicleBrief | null | undefined): string {
  if (!v) return ''
  return [v.make, v.model, v.year].filter(Boolean).join(' ')
}

export interface PartsShipment {
  id: string
  parts_company_id: string
  order_id: string | null
  ttn: string
  np_ref: string | null
  recipient_name: string | null
  recipient_phone: string | null
  recipient_city: string | null
  recipient_warehouse: string | null
  status: string | null
  status_code: string | null
  cod_amount: number | null
  status_updated_at: string | null
  last_checked_at: string | null
  created_at: string
  /** Запчасти в накладной (необязательно) */
  items?: ShipmentItemRef[]
  /** Привязанный заказ (если ТТН создана из заказа) */
  order?: ShipmentOrderRef | null
}

/** Эффективный клиент ТТН: из заказа, иначе получатель. */
export function shipmentClient(s: PartsShipment): string {
  return s.order?.customer?.full_name || s.recipient_name || ''
}
/** Эффективный телефон ТТН: из заказа, иначе получатель. */
export function shipmentPhone(s: PartsShipment): string {
  return s.order?.customer?.phone || s.recipient_phone || ''
}

const SHIPMENT_SELECT =
  '*, items:parts_shipment_items(inventory_item_id, item:parts_inventory(id, name, part_number, vehicle:parts_vehicles(make, model, year))), order:parts_orders(id, order_number, customer:parts_customers(full_name, phone))'

export async function getShipments(partsCompanyId: string): Promise<PartsShipment[]> {
  const { data, error } = await supabase
    .from('parts_shipments')
    .select(SHIPMENT_SELECT)
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as PartsShipment[]) ?? []
}

/** Одна ТТН по id — для страницы информации. */
export async function getShipment(id: string): Promise<PartsShipment | null> {
  const { data, error } = await supabase
    .from('parts_shipments')
    .select(SHIPMENT_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as PartsShipment | null) ?? null
}

// Поля таблицы parts_shipments для вставки (без агрегатов items/order).
type ShipmentInsert = Omit<PartsShipment, 'id' | 'created_at' | 'status_updated_at' | 'last_checked_at' | 'items' | 'order'>

/** Создать ТТН, вернуть её id (для привязки запчастей). */
export async function createShipment(input: ShipmentInsert): Promise<string> {
  const { data, error } = await supabase.from('parts_shipments').insert(input).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

/** Привязать позиции склада к ТТН (опционально). */
export async function addShipmentItems(
  shipmentId: string,
  partsCompanyId: string,
  inventoryItemIds: string[],
): Promise<void> {
  if (!inventoryItemIds.length) return
  const rows = inventoryItemIds.map((id) => ({
    shipment_id: shipmentId,
    inventory_item_id: id,
    parts_company_id: partsCompanyId,
  }))
  const { error } = await supabase.from('parts_shipment_items').insert(rows)
  if (error) throw error
}

export interface InventoryPick {
  id: string
  name: string
  part_number: string | null
  vehicle: VehicleBrief | null
}

/** Поиск позиций склада для выбора в ТТН (по названию/номеру), с авто-происхождением. */
export async function searchInventoryForShipment(
  partsCompanyId: string,
  query: string,
): Promise<InventoryPick[]> {
  let q = supabase
    .from('parts_inventory')
    .select('id, name, part_number, vehicle:parts_vehicles(make, model, year)')
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
    .limit(20)
  const term = query.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`name.ilike.%${term}%,part_number.ilike.%${term}%`)
  const { data, error } = await q
  if (error) throw error
  return (data as unknown as InventoryPick[]) ?? []
}

export interface NpTrackStatus {
  status: string
  statusCode: string
}

/** Базовый статус посылки по ТТН (НП TrackingDocument; ключ из настроек разборки). */
export async function trackTtn(
  ttn: string,
  phone: string | undefined,
  apiKey: string,
): Promise<NpTrackStatus | null> {
  const res = await fetch(NP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      modelName: 'TrackingDocument',
      calledMethod: 'getStatusDocuments',
      methodProperties: { Documents: [{ DocumentNumber: ttn, Phone: phone || '' }] },
    }),
  })
  if (!res.ok) throw new Error(`Ошибка сети: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.errors?.[0] || 'Ошибка трекинга НП')
  const d = json.data?.[0]
  if (!d) return null
  return { status: d.Status, statusCode: d.StatusCode }
}

export async function refreshShipmentStatus(id: string, status: NpTrackStatus): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('parts_shipments')
    .update({
      status: status.status,
      status_code: status.statusCode,
      status_updated_at: now,
      last_checked_at: now,
    })
    .eq('id', id)
  if (error) throw error
}
