import { supabase } from '@/lib/supabase'

// ============================================================================
// Трекинг посылок (ТТН Новой Почты) по заказам разборки.
// ⚠️ Требует миграции database/migrations/2026-06-16_parts_shipments.sql
// ============================================================================

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/'

/** Позиция склада, привязанная к ТТН (опционально). */
export interface ShipmentItemRef {
  inventory_item_id: string
  item: { id: string; name: string; part_number: string | null } | null
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
}

export async function getShipments(partsCompanyId: string): Promise<PartsShipment[]> {
  const { data, error } = await supabase
    .from('parts_shipments')
    .select('*, items:parts_shipment_items(inventory_item_id, item:parts_inventory(id, name, part_number))')
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as PartsShipment[]) ?? []
}

// Поля таблицы parts_shipments для вставки (без агрегата items).
type ShipmentInsert = Omit<PartsShipment, 'id' | 'created_at' | 'status_updated_at' | 'last_checked_at' | 'items'>

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

export interface InventoryPick { id: string; name: string; part_number: string | null }

/** Поиск позиций склада для выбора в ТТН (по названию/номеру). */
export async function searchInventoryForShipment(
  partsCompanyId: string,
  query: string,
): Promise<InventoryPick[]> {
  let q = supabase
    .from('parts_inventory')
    .select('id, name, part_number')
    .eq('parts_company_id', partsCompanyId)
    .order('created_at', { ascending: false })
    .limit(20)
  const term = query.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`name.ilike.%${term}%,part_number.ilike.%${term}%`)
  const { data, error } = await q
  if (error) throw error
  return (data as InventoryPick[]) ?? []
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
