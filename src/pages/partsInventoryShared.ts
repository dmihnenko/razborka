// Общие для списка запчастей (PartsInventory) и формы (PartsInventoryModal) чистые
// хелперы/типы. Выделены отдельно, чтобы страницы не импортировали друг у друга.
import type { PartsVehicle, PartsCategory, StorageLocation, PartsInventoryStatus, CreatePartsInventoryInput } from '@/types/parts'
import type { ImgbbPhoto } from '@/services/imgbbService'

/** Строка выпадающего списка авто (id, make, model, year из parts_vehicles) */
export type VehicleDropdownRow = Pick<PartsVehicle, 'id' | 'make' | 'model' | 'year'>
/** Строка выпадающего списка категорий (id, name, brand, model из parts_categories) */
export type CategoryDropdownRow = Pick<PartsCategory, 'id' | 'name' | 'brand' | 'model'>

/** Плоский список мест хранения с путём (Стеллаж → Полка → Ячейка) для селектов. */
export function buildLocationOptions(locations: StorageLocation[]): { id: string; label: string }[] {
  const map = new Map<string, StorageLocation>()
  locations.forEach((l) => map.set(l.id, l))

  function getPath(id: string): string {
    const node = map.get(id)
    if (!node) return ''
    if (!node.parent_id) return node.name
    return getPath(node.parent_id) + ' → ' + node.name
  }

  return locations
    .map((l) => ({ id: l.id, label: getPath(l.id) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Строка пакетного добавления («Списком с фото»). */
export interface BulkRow {
  /** Стабильный ключ строки: фоновые загрузки фото находят её по id, а не по индексу. */
  id: string
  name: string
  selling_price: string
  part_number: string
  status: PartsInventoryStatus
  photos: ImgbbPhoto[]
  /** Фото, которые ещё грузятся (превью по localUrl). */
  pending: { id: string; localUrl: string }[]
}

export interface BulkShared {
  category_id: string
  vehicle_id: string
  condition: string
  storage_location_id: string
  price_currency: string
}

let bulkRowSeq = 0
export function newBulkRow(init: Partial<Pick<BulkRow, 'name' | 'selling_price' | 'part_number' | 'status'>> = {}): BulkRow {
  bulkRowSeq += 1
  return { id: `bulk-${Date.now()}-${bulkRowSeq}`, name: '', selling_price: '', part_number: '', status: 'available', photos: [], pending: [], ...init }
}

/** Строки пачки → входные данные для создания позиций (пустые названия отбрасываются). */
export function buildBulkInputs(rows: BulkRow[], shared: BulkShared): CreatePartsInventoryInput[] {
  return rows
    .filter(r => r.name.trim())
    .map(r => ({
      name: r.name.trim(),
      selling_price: Number(r.selling_price) || undefined,
      part_number: r.part_number.trim().toUpperCase() || undefined,
      category_id: shared.category_id || undefined,
      vehicle_id: shared.vehicle_id || undefined,
      condition: shared.condition,
      storage_location_id: shared.storage_location_id || undefined,
      price_currency: shared.price_currency as CreatePartsInventoryInput['price_currency'],
      quantity: 1,
      // photo_url синхронизирует триггер БД (2026-06-22_inventory_photo_url_sync) — как у одиночной формы
      photos: r.photos,
      status: r.status,
    }))
}

/** Есть ли у пачки незавершённые загрузки фото. */
export function bulkHasPending(rows: BulkRow[]): boolean {
  return rows.some(r => r.pending.length > 0)
}
