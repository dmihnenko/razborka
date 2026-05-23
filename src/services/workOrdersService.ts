import { supabase } from '../lib/supabase'
import { moveToTrash } from './trashService'

export async function fetchWorkOrders(stoCompanyId: string, assignedTo?: string) {
  let query = supabase
    .from('work_orders')
    .select(`
      *,
      customers(name, phone),
      vehicles(brand, model, license_plate),
      created_by_profile:user_profiles!created_by(full_name, email),
      assigned_to_profile:user_profiles!assigned_to(full_name, email)
    `)
    .eq('sto_company_id', stoCompanyId)

  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function deleteWorkOrder(
  id: string,
  workOrder: any,
  stoCompanyId?: string | null
) {
  const label = workOrder
    ? `Заказ-наряд: ${workOrder.customers?.name || ''} — ${workOrder.vehicles?.brand || ''} ${workOrder.vehicles?.model || ''}`.trim()
    : 'Заказ-наряд'

  await moveToTrash({
    entityType: 'work_order',
    entityId: id,
    entityLabel: label,
    entityData: workOrder || { id },
    stoCompanyId,
  })

  const { error } = await supabase.from('work_orders').delete().eq('id', id)
  if (error) throw error
}
