import { supabase } from '@/lib/supabase'
import type {
  PartsVehicle,
  PartsInventoryItem,
  PartsCategory,
  PartsCustomer,
  PartsOrder,
  PartsOrderItem,
} from '@/types/parts'

export type TrashEntityType =
  | 'parts_order'
  | 'parts_vehicle'
  | 'parts_inventory'
  | 'parts_category'
  | 'parts_customer'

export const ENTITY_LABELS: Record<TrashEntityType, string> = {
  parts_order: 'Заказ разборки',
  parts_vehicle: 'Авто на разборку',
  parts_inventory: 'Запчасть',
  parts_category: 'Категория',
  parts_customer: 'Клиент разборки',
}

/** Снимок авто на разборку: сама машина + её запчасти (для каскадного восстановления) */
export interface TrashVehicleSnapshot {
  vehicle: PartsVehicle
  parts: PartsInventoryItem[]
}

/** Снимок заказа: заказ + его позиции */
export interface TrashOrderSnapshot {
  order: PartsOrder
  items: PartsOrderItem[]
}

/**
 * JSON-снимок удалённой сущности (колонка trash_bin.entity_data, jsonb — без статической
 * схемы). Хранит гетерогенные формы по entity_type (составные TrashVehicleSnapshot/
 * TrashOrderSnapshot либо одиночная row-строка). Тип `unknown` (не `any`) заставляет
 * restoreFromTrash явно сузить снимок к конкретной форме по entity_type (parseSnapshot).
 */
export type TrashEntityData = unknown

export interface TrashItem {
  id: string
  entity_type: TrashEntityType
  entity_id: string
  entity_data: TrashEntityData
  entity_label: string
  deleted_at: string
  expires_at: string
  parts_company_id: string | null
}

interface MoveToTrashParams {
  entityType: TrashEntityType
  entityId: string
  entityLabel: string
  entityData: TrashEntityData
  partsCompanyId?: string | null
}

export async function moveToTrash(params: MoveToTrashParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('trash_bin').insert([{
    entity_type: params.entityType,
    entity_id: params.entityId,
    entity_data: params.entityData,
    entity_label: params.entityLabel,
    deleted_by: user?.id ?? null,
    parts_company_id: params.partsCompanyId ?? null,
  }])
  if (error) {
    console.error('moveToTrash error:', JSON.stringify(error))
    throw error
  }
}

export async function getTrashItems(params: {
  partsCompanyId?: string | null
}): Promise<TrashItem[]> {
  let query = supabase
    .from('trash_bin')
    .select('*')
    .order('deleted_at', { ascending: false })

  if (params.partsCompanyId) {
    query = query.eq('parts_company_id', params.partsCompanyId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TrashItem[]
}

/**
 * Разбор JSON-снимка entity_data к конкретной форме по entity_type.
 * entity_data — jsonb без статической схемы, поэтому мост через unknown здесь
 * оправдан (форму гарантирует entity_type, записанный при moveToTrash).
 */
function parseSnapshot<T>(data: TrashEntityData): T {
  return data as T
}

export async function restoreFromTrash(item: TrashItem): Promise<void> {
  const { entity_type, entity_data } = item

  switch (entity_type) {
    case 'parts_vehicle': {
      const { vehicle, parts } = parseSnapshot<TrashVehicleSnapshot>(entity_data)
      const { error: ve } = await supabase.from('parts_vehicles').upsert([vehicle])
      if (ve) throw ve
      if (parts?.length) {
        const { error: pe } = await supabase.from('parts_inventory').upsert(parts)
        if (pe) throw pe
      }
      break
    }

    case 'parts_inventory': {
      const { error } = await supabase.from('parts_inventory').upsert([parseSnapshot<PartsInventoryItem>(entity_data)])
      if (error) throw error
      break
    }

    case 'parts_category': {
      const { error } = await supabase.from('parts_categories').upsert([parseSnapshot<PartsCategory>(entity_data)])
      if (error) throw error
      break
    }

    case 'parts_customer': {
      const { error } = await supabase.from('parts_customers').upsert([parseSnapshot<PartsCustomer>(entity_data)])
      if (error) throw error
      break
    }

    case 'parts_order': {
      const { order, items } = parseSnapshot<TrashOrderSnapshot>(entity_data)
      const { error: oe } = await supabase.from('parts_orders').upsert([order])
      if (oe) throw oe
      if (items?.length) {
        const { error: ie } = await supabase.from('parts_order_items').upsert(items)
        if (ie) throw ie
      }
      break
    }

    default:
      throw new Error(`Неизвестный тип: ${entity_type}`)
  }

  // Удаляем из корзины после успешного восстановления
  const { error: de } = await supabase.from('trash_bin').delete().eq('id', item.id)
  if (de) throw de
}

export async function permanentlyDelete(trashId: string): Promise<void> {
  const { error } = await supabase.from('trash_bin').delete().eq('id', trashId)
  if (error) throw error
}
