import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, X, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/utils/currency'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import {
  getPartsCustomers,
  createPartsCustomer,
  createPartsOrder,
  createPartsOrderItem,
  updatePartsOrderTotal,
  updatePartsInventoryItem,
} from '@/services/partsService'
import type { PartsInventoryItem, PartsCustomer } from '@/types/parts'

interface SellPartModalProps {
  item: PartsInventoryItem
  partsCompanyId: string
  onClose: () => void
  onSold?: () => void
}

/**
 * Модалка продажи запчасти. Создаёт клиента (опц.), заказ, позицию заказа,
 * завершает заказ (триггер ставит статус 'sold' и списывает количество).
 * Используется и в списке запчастей, и на карточке товара — без редиректа.
 */
export function SellPartModal({ item, partsCompanyId, onClose, onSold }: SellPartModalProps) {
  const queryClient = useQueryClient()
  const { rate: usdRate } = usePartsExchangeRate()

  const [sellPrice, setSellPrice] = useState(item.selling_price ? String(item.selling_price) : '')
  const [sellCurrency, setSellCurrency] = useState<'UAH' | 'USD'>((item.price_currency as 'UAH' | 'USD') || 'USD')
  const [sellCustomerId, setSellCustomerId] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const { data: customers = [] } = useQuery<PartsCustomer[]>({
    queryKey: ['parts-customers', partsCompanyId],
    queryFn: () => getPartsCustomers(partsCompanyId),
    enabled: !!partsCompanyId,
  })

  const sellMutation = useMutation({
    mutationFn: async ({ price, currency, customerId, newCustomer }: {
      price: number
      currency: 'UAH' | 'USD'
      customerId?: string
      newCustomer?: { name: string; phone: string }
    }) => {
      let resolvedCustomerId: string | null = customerId || null

      if (newCustomer?.name?.trim()) {
        const created = await createPartsCustomer(
          { full_name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || undefined },
          partsCompanyId
        )
        resolvedCustomerId = created.id
      }

      const order = await createPartsOrder(partsCompanyId, {
        customer_id: resolvedCustomerId,
        order_date: new Date().toISOString(),
      })

      await createPartsOrderItem(order.id, {
        inventory_item_id: item.id,
        quantity: 1,
        price_at_sale: price,
        price_at_sale_currency: currency,
      })

      await updatePartsOrderTotal(order.id, usdRate)

      const { error: completeError } = await supabase
        .from('parts_orders')
        .update({ status: 'completed', exchange_rate_at_sale: usdRate })
        .eq('id', order.id)
      if (completeError) throw completeError

      return updatePartsInventoryItem(item.id, {
        sold_price: price,
        price_currency: currency,
        sold_to_customer_id: resolvedCustomerId || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory-item', item.id] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      toast.success('Запчасть продана, заказ создан')
      onSold?.()
      onClose()
    },
    onError: (err: any) => {
      console.error('Sell error:', err)
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      toast.error(`Ошибка при сохранении: ${msg}`)
    },
  })

  const handleSell = () => {
    const price = parseFloat(sellPrice)
    if (isNaN(price) || price < 0) {
      toast.error('Введите корректную сумму')
      return
    }
    if (showNewCustomer && !newCustomerName.trim()) {
      toast.error('Введите имя клиента')
      return
    }
    sellMutation.mutate({
      price,
      currency: sellCurrency,
      customerId: sellCustomerId || undefined,
      newCustomer: showNewCustomer ? { name: newCustomerName, phone: newCustomerPhone } : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-dvh items-end sm:items-center justify-center p-0 sm:px-4">
        <div className="fixed inset-0 bg-gray-500/75 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-5 sm:p-6 z-10">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Продать запчасть</h3>
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.name}</p>

          {/* Цена */}
          <label className="block text-sm font-medium text-gray-700 mb-1">Цена продажи</label>
          {item.selling_price && (
            <p className="text-xs text-gray-400 mb-2">Объявленная: {formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')}</p>
          )}
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              min="0"
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="0"
              autoFocus
              className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setSellCurrency(c => c === 'USD' ? 'UAH' : 'USD')}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90 w-12 text-center"
            >
              {sellCurrency === 'USD' ? '$' : '₴'}
            </button>
          </div>

          {/* Клиент */}
          <label className="block text-sm font-medium text-gray-700 mb-1">Клиент <span className="text-gray-400 font-normal">(необязательно)</span></label>
          {!showNewCustomer ? (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <select
                  value={sellCustomerId}
                  onChange={(e) => setSellCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary appearance-none pr-8"
                >
                  <option value="">— Без клиента —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}{c.phone ? ` (${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 flex-shrink-0"
                title="Новый клиент"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">Новый клиент</span>
                <button type="button" onClick={() => setShowNewCustomer(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Имя *"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Телефон"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="flex gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={sellMutation.isPending}
              onClick={handleSell}
              className="flex-1 px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {sellMutation.isPending ? 'Сохранение...' : 'Продать'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SellPartModal
