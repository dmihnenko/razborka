import { supabase } from '@/lib/supabase'

export type TrashEntityType =
  | 'customer'
  | 'vehicle'
  | 'service'
  | 'work_order'
  | 'appointment'
  | 'parts_order'
  | 'parts_vehicle'
  | 'parts_inventory'
  | 'parts_category'
  | 'parts_customer'

export const ENTITY_LABELS: Record<TrashEntityType, string> = {
  customer: 'Клиент',
  vehicle: 'Автомобиль',
  service: 'Услуга',
  work_order: 'Заказ-наряд',
  appointment: 'Заявка',
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
  sto_company_id: string | null
  parts_company_id: string | null
}

interface MoveToTrashParams {
  entityType: TrashEntityType
  entityId: string
  entityLabel: string
  entityData: any
  stoCompanyId?: string | null
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
    sto_company_id: params.stoCompanyId ?? null,
    parts_company_id: params.partsCompanyId ?? null,
  }])
  if (error) {
    console.error('moveToTrash error:', JSON.stringify(error))
    throw error
  }
}

export async function getTrashItems(params: {
  stoCompanyId?: string | null
  partsCompanyId?: string | null
}): Promise<TrashItem[]> {
  let query = supabase
    .from('trash_bin')
    .select('*')
    .order('deleted_at', { ascending: false })

  if (params.stoCompanyId) {
    query = query.eq('sto_company_id', params.stoCompanyId)
  } else if (params.partsCompanyId) {
    query = query.eq('parts_company_id', params.partsCompanyId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TrashItem[]
}

export async function restoreFromTrash(item: TrashItem): Promise<void> {
  const { entity_type, entity_data } = item

  switch (entity_type) {
    case 'customer': {
      const { customer, vehicles, appointments } = entity_data as {
        customer: any
        vehicles: any[]
        appointments: any[]
      }
      const { error: ce } = await supabase.from('customers').upsert([customer])
      if (ce) throw ce
      if (vehicles?.length) {
        const { error: ve } = await supabase.from('vehicles').upsert(vehicles)
        if (ve) throw ve
      }
      if (appointments?.length) {
        const { error: ae } = await supabase.from('appointments').upsert(appointments)
        if (ae) throw ae
      }
      break
    }

    case 'vehicle': {
      const { vehicle, appointments } = entity_data as {
        vehicle: any
        appointments: any[]
      }
      const { error: ve } = await supabase.from('vehicles').upsert([vehicle])
      if (ve) throw ve
      if (appointments?.length) {
        const { error: ae } = await supabase.from('appointments').upsert(appointments)
        if (ae) throw ae
      }
      break
    }

    case 'service': {
      const { error } = await supabase.from('services').upsert([entity_data])
      if (error) throw error
      break
    }

    case 'work_order': {
      const { error } = await supabase.from('work_orders').upsert([entity_data])
      if (error) throw error
      break
    }

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

    case 'appointment': {
      const { error } = await supabase.from('appointments').upsert([entity_data])
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
