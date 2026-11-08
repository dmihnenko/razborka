import { supabase } from '@/lib/supabase'
import {
  createPartsCustomer,
  createPartsOrder,
  createPartsOrderItem,
  deletePartsOrder,
  updatePartsInventoryItem,
  updatePartsOrderTotal,
} from '@/services/partsService'
import { samePhone, type SalePlan } from '@/components/parts/sale/saleLogic'

/**
 * Выполняет план продажи (см. buildSalePlan): клиент → заказ → позиции (проверка
 * свободного остатка + резерв) → итог → (опц.) завершение заказа → метки «продано».
 * Любая ошибка до завершения откатывает заказ через delete_parts_order (снимает резервы),
 * поэтому «висящего» пустого заказа не остаётся. PartsStockError пробрасывается как есть.
 * Новый клиент: сначала ищется существующий по телефону (последние 9 цифр), иначе создаётся;
 * о созданном клиенте сообщает onCustomerCreated (чтобы повтор после ошибки не плодил дубль).
 * Если не удалась только простановка меток «продано» после завершения заказа — продажа состоялась:
 * возвращается finalizeFailed: true, ошибка не бросается.
 */
export async function createPartsSale(
  partsCompanyId: string,
  plan: SalePlan,
  opts: { onCustomerCreated?: (customerId: string) => void } = {},
): Promise<{ orderId: string; finalizeFailed: boolean }> {
  let customerId: string | null = null
  if (plan.customer.kind === 'existing') {
    customerId = plan.customer.id
  } else if (plan.customer.kind === 'new') {
    const phone = plan.customer.phone.trim()
    if (phone) {
      const { data: candidates } = await supabase
        .from('parts_customers')
        .select('id, phone')
        .eq('parts_company_id', partsCompanyId)
        .not('phone', 'is', null)
      customerId = (candidates || []).find((c) => samePhone(c.phone, phone))?.id ?? null
    }
    if (!customerId) {
      const created = await createPartsCustomer(
        { full_name: plan.customer.name.trim(), phone: phone || undefined },
        partsCompanyId,
      )
      customerId = created.id
      opts.onCustomerCreated?.(created.id)
    }
  }

  const order = await createPartsOrder(partsCompanyId, {
    customer_id: customerId,
    notes: plan.notes,
    order_date: new Date().toISOString(),
  })

  try {
    for (const item of plan.items) await createPartsOrderItem(order.id, item)
    await updatePartsOrderTotal(order.id, plan.rate)
    if (plan.complete) {
      // Триггер complete_parts_order() ставит sold и списывает quantity
      const { error } = await supabase
        .from('parts_orders')
        .update({ status: 'completed', ...(plan.rate != null ? { exchange_rate_at_sale: plan.rate } : {}) })
        .eq('id', order.id)
      if (error) throw error
    }
  } catch (e) {
    try { await deletePartsOrder(order.id) } catch (cleanupErr) { console.error('cleanup order failed', cleanupErr) }
    throw e
  }

  // Метки покупателя/цены — только для полностью проданных позиций (при частичной продаже триггер уже вычел количество)
  let finalizeFailed = false
  for (const f of plan.finalize) {
    try {
      await updatePartsInventoryItem(f.itemId, {
        sold_price: f.sold_price || undefined,
        price_currency: f.price_currency,
        sold_to_customer_id: customerId || undefined,
      })
    } catch (e) {
      finalizeFailed = true
      console.error('finalize sold marks failed', e)
    }
  }
  return { orderId: order.id, finalizeFailed }
}
