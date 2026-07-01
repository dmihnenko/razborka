import { useParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Package, Clock, ChevronDown, ChevronUp, Archive, Car, Phone } from 'lucide-react'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { statusBadgeClass, getPartsOrderStatusText, type PartsOrderStatus } from '@/utils/status'
import { formatCurrency } from '@/utils/currency'
import { useState, useMemo } from 'react'

const ACTIVE_STATUSES = new Set(['new', 'in_progress'])

// ── Формы строк публичного запроса заказов (нетипизированный supabase-клиент) ──
interface PublicOrderVehicle {
  id: string
  make: string
  model: string
  year?: number | null
  vin?: string | null
}
interface PublicOrderItem {
  id: string
  quantity: number
  price_at_sale: number
  subtotal: number
  inventory_item?: {
    name?: string | null
    part_number?: string | null
    vehicle?: PublicOrderVehicle | null
  } | null
}
interface PublicOrder {
  id: string
  status: PartsOrderStatus
  order_date: string
  created_at: string
  total_amount: number
  notes?: string | null
  items?: PublicOrderItem[] | null
}

function OrderCard({ order }: { order: PublicOrder }) {
  const [itemsOpen, setItemsOpen] = useState(false)

  // Уникальные авто из позиций
  const vehicles = useMemo(() => {
    const map = new Map<string, PublicOrderVehicle>()
    order.items?.forEach((item) => {
      const v = item.inventory_item?.vehicle
      if (v?.id) map.set(v.id, v)
    })
    return Array.from(map.values())
  }, [order.items])

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header: авто+VIN слева, статус справа */}
      <div className="px-3 sm:px-4 pt-3 pb-2">
        {vehicles.length > 0 ? vehicles.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Car className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-sm font-semibold text-gray-900 shrink-0">
                {v.make} {v.model}{v.year ? ` ${v.year}` : ''}
              </span>
              {v.vin && (
                <span className="font-mono text-xs text-gray-400 truncate">{v.vin}</span>
              )}
            </div>
            <span className={`${statusBadgeClass(order.status)} shrink-0`}>
              {getPartsOrderStatusText(order.status)}
            </span>
          </div>
        )) : (
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm text-gray-400">Без авто</span>
            <span className={`${statusBadgeClass(order.status)} shrink-0`}>
              {getPartsOrderStatusText(order.status)}
            </span>
          </div>
        )}

        {/* Дата + сумма */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3 shrink-0" />
            {new Date(order.order_date).toLocaleDateString('ru-RU', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
            <span>·</span>
            <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ru })}</span>
          </div>
          <span className="font-bold text-primary text-sm shrink-0">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      {/* Toggle items */}
      {order.items && order.items.length > 0 && (
        <button
          onClick={() => setItemsOpen(v => !v)}
          className="w-full flex items-center gap-1.5 px-3 sm:px-4 py-1.5 border-t border-gray-100 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
        >
          {itemsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {itemsOpen ? 'Скрыть' : 'Показать'} позиции ({order.items.length})
        </button>
      )}

      {/* Collapsible items */}
      {itemsOpen && order.items && order.items.length > 0 && (
        <div className="border-t border-gray-100 px-3 sm:px-4 py-2 bg-gray-50 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 truncate">{item.inventory_item?.name || 'Запчасть'}</p>
                {item.inventory_item?.part_number && (
                  <p className="text-gray-400">Арт: {item.inventory_item.part_number}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-500">{item.quantity} шт × {formatCurrency(item.price_at_sale)}</p>
                <p className="font-semibold text-primary">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          ))}
          {/* Итог */}
          <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 text-xs font-semibold">
            <span className="text-gray-600">Итого</span>
            <span className="text-primary text-sm">{formatCurrency(order.total_amount)}</span>
          </div>
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
      return (data ?? []) as PublicOrder[]
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-slate-50 flex flex-col">
        <PublicBrandHeader subtitle="Авторазборка · заказы" />
        <div className="flex-1 flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  const activeOrders = orders?.filter(o => ACTIVE_STATUSES.has(o.status)) ?? []
  const doneOrders   = orders?.filter(o => !ACTIVE_STATUSES.has(o.status)) ?? []
  const activeTotal  = activeOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)
  const doneTotal    = doneOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0)

  return (
    <div className="min-h-dvh bg-slate-50">
      <PublicBrandHeader subtitle="Авторазборка · заказы" />
      <div className="py-4 sm:py-8">
      <div className="max-w-2xl mx-auto px-3 sm:px-4">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm px-4 sm:px-6 py-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">******</h1>
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
            <div className="flex gap-3 sm:gap-4 shrink-0">
              <div className="text-center">
                <p className="text-xs text-gray-400">Активных</p>
                <p className="text-base sm:text-xl font-bold text-blue-600">{activeOrders.length}</p>
                {activeTotal > 0 && <p className="text-xs text-blue-400">{formatCurrency(activeTotal)}</p>}
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Завершённых</p>
                <p className="text-base sm:text-xl font-bold text-gray-500">{doneOrders.length}</p>
                {doneTotal > 0 && <p className="text-xs text-gray-400">{formatCurrency(doneTotal)}</p>}
              </div>
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
    </div>
  )
}
