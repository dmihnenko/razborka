import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Package, Clock, ChevronDown, ChevronUp, Archive, Car, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { formatCurrency } from '@/utils/currency'
import { useState, useMemo } from 'react'

const ACTIVE_STATUSES = new Set(['new', 'in_progress'])

function OrderCard({ order }: { order: any }) {
  const [itemsOpen, setItemsOpen] = useState(false)

  // Уникальные авто из позиций
  const vehicles = useMemo(() => {
    const map = new Map<string, any>()
    order.items?.forEach((item: any) => {
      const v = item.inventory_item?.vehicle
      if (v?.id) map.set(v.id, v)
    })
    return Array.from(map.values())
  }, [order.items])

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 px-3 sm:px-4 py-3">
        <div className="flex-1 min-w-0">
          {/* Status badge */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPartsOrderStatusColor(order.status)}`}>
              {getPartsOrderStatusText(order.status)}
            </span>
          </div>
          {/* Vehicles */}
          {vehicles.length > 0 ? (
            <div className="space-y-0.5 mb-1">
              {vehicles.map((v: any) => (
                <div key={v.id} className="flex items-center gap-1.5">
                  <Car className="w-3 h-3 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {v.make} {v.model}{v.year ? ` ${v.year}` : ''}
                  </span>
                  {v.vin && (
                    <span className="text-xs font-mono text-gray-400 tracking-wide">{v.vin}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3 shrink-0" />
            {new Date(order.order_date).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
            <span>·</span>
            <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ru })}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-bold text-primary text-sm sm:text-base">
            {formatCurrency(order.total_amount)}
          </div>
          {order.items?.length > 0 && (
            <button
              onClick={() => setItemsOpen(v => !v)}
              className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto mt-0.5"
            >
              {order.items.length} поз.
              {itemsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible items */}
      {itemsOpen && order.items?.length > 0 && (
        <div className="border-t border-gray-100 px-3 sm:px-4 py-2 bg-gray-50 space-y-1.5">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{item.inventory_item?.name || 'Запчасть'}</p>
                {item.inventory_item?.part_number && (
                  <p className="text-gray-400">Арт: {item.inventory_item.part_number}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-600">{item.quantity} шт × {formatCurrency(item.price_at_sale)}</p>
                <p className="font-semibold text-primary">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="border-t border-blue-100 px-3 sm:px-4 py-2 bg-blue-50">
          <p className="text-xs text-gray-600">{order.notes}</p>
        </div>
      )}
    </div>
  )
}

export default function PublicPartsCustomerView() {
  const { id } = useParams<{ id: string }>()
  const [archiveOpen, setArchiveOpen] = useState(false)

  const { data: customer } = useQuery({
    queryKey: ['public-parts-customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_customers')
        .select('full_name, phone')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['public-parts-customer-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_orders')
        .select(`
          *,
          items:parts_order_items(
            id,
            quantity,
            price_at_sale,
            subtotal,
            inventory_item:parts_inventory(
              name,
              part_number,
              vehicle:parts_vehicles(id, make, model, year, vin)
            )
          )
        `)
        .eq('customer_id', id)
        .order('order_date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  const activeOrders = orders?.filter(o => ACTIVE_STATUSES.has(o.status)) ?? []
  const doneOrders   = orders?.filter(o => !ACTIVE_STATUSES.has(o.status)) ?? []

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-2xl mx-auto px-3 sm:px-4">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm px-4 sm:px-6 py-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                ******
              </h1>
              {customer?.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-1 text-xs sm:text-sm text-primary mt-0.5 hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </a>
              )}
              <p className="text-xs text-gray-400 mt-0.5">Авторазборка · публичная страница</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{orders?.length ?? 0}</p>
              <p className="text-xs text-gray-400">всего</p>
            </div>
          </div>
        </div>

        {/* Active orders */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Package className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Активные заявки
            </h2>
            {activeOrders.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                {activeOrders.length}
              </span>
            )}
          </div>
          {activeOrders.length > 0 ? (
            <div className="space-y-2">
              {activeOrders.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <Package className="w-6 h-6 text-gray-200 mx-auto mb-1" />
              <p className="text-sm text-gray-400">Нет активных заявок</p>
            </div>
          )}
        </div>

        {/* Archive */}
        {doneOrders.length > 0 && (
          <div>
            <button
              onClick={() => setArchiveOpen(v => !v)}
              className="w-full flex items-center gap-2 px-1 mb-2 group"
            >
              <Archive className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide group-hover:text-gray-700 transition-colors">
                Архив
              </h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                {doneOrders.length}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${archiveOpen ? 'rotate-180' : ''}`} />
            </button>
            {archiveOpen && (
              <div className="space-y-2">
                {doneOrders.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400 pb-4">
          <p>Страница для отслеживания состояния ваших заказов</p>
        </div>
      </div>
    </div>
  )
}
