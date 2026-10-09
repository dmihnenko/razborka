// Общие для списка запчастей (PartsInventory) и формы (PartsInventoryModal) чистые
// хелперы/типы. Выделены отдельно, чтобы страницы не импортировали друг у друга.
import type { PartsVehicle, PartsCategory, StorageLocation } from '@/types/parts'

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
