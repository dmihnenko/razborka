import { supabase } from '@/lib/supabase'

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

export interface TrashItem {
  id: string
  entity_type: TrashEntityType
  entity_id: string
  entity_data: any
  entity_label: string
  deleted_at: string
  expires_at: string
  parts_company_id: string | null
}

interface MoveToTrashParams {
  entityType: TrashEntityType
  entityId: string
  entityLabel: string
  entityData: any
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

export async function restoreFromTrash(item: TrashItem): Promise<void> {
  const { entity_type, entity_data } = item

  switch (entity_type) {
    case 'parts_vehicle': {
      const { vehicle, parts } = entity_data as { vehicle: any; parts: any[] }
      const { error: ve } = await supabase.from('parts_vehicles').upsert([vehicle])
      if (ve) throw ve
      if (parts?.length) {
        const { error: pe } = await supabase.from('parts_inventory').upsert(parts)
        if (pe) throw pe
      }
      break
    }

    case 'parts_inventory': {
      const { error } = await supabase.from('parts_inventory').upsert([entity_data])
      if (error) throw error
      break
    }

    case 'parts_category': {
      const { error } = await supabase.from('parts_categories').upsert([entity_data])
      if (error) throw error
      break
    }

    case 'parts_customer': {
      const { error } = await supabase.from('parts_customers').upsert([entity_data])
      if (error) throw error
      break
    }

    case 'parts_order': {
      const { order, items } = entity_data as { order: any; items: any[] }
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
