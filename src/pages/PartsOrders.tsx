import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { PartsOrder } from '@/types/parts'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ShoppingCart } from 'lucide-react'
import { getPartsOrderStatusText } from '@/utils/status'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import PartsPageHeader from '@/components/parts/PartsPageHeader'

// Map parts order status → badge-* token (badge component palette)
const STATUS_BADGE: Record<string, string> = {
  new:         'badge badge-blue',
  in_progress: 'badge badge-yellow',
  completed:   'badge badge-green',
  cancelled:   'badge badge-red',
}

function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? 'badge badge-gray'
}

export default function PartsOrders() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const { rate: usdRate } = usePartsExchangeRate()

  const formatUSD = (amount?: number | null) => {
    if (amount == null || amount === 0) return '—'
    return `$${Math.round(amount).toLocaleString('ru-RU')}`
  }

  // Считаем сумму заказа в USD: USD-позиции напрямую, UAH-позиции делим на курс
  const computeOrderUSD = (order: any): number | null => {
    if (!order.items || order.items.length === 0) return null
    // Используем курс, зафиксированный при закрытии заказа, или текущий глобальный
    const rate = order.exchange_rate_at_sale || usdRate
    if (!rate) return null
    return order.items.reduce((sum: number, item: any) => {
      const amount = (item.price_at_sale ?? 0) * (item.quantity ?? 1)
      return sum + (item.price_at_sale_currency === 'USD' ? amount : amount / rate)
    }, 0)
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Получить список заказов
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['parts-orders', partsCompanyId, statusFilter],
    queryFn: async () => {
      if (!partsCompanyId) return []

      let query = supabase
        .from('parts_orders')
        .select(`
          *,
          customer:parts_customers(id, full_name, phone),
          items:parts_order_items(id, quantity, subtotal, price_at_sale, price_at_sale_currency, inventory_item:parts_inventory(name))
        `)
        .eq('parts_company_id', partsCompanyId)
        .order('order_date', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      return data as PartsOrder[]
    },
    enabled: !!partsCompanyId,
  })

  // Фильтрация по поиску
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer?.full_name?.toLowerCase().includes(query) ||
      order.customer?.phone?.toLowerCase().includes(query)
    )
  })

  // Statistics
  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    totalRevenue: (() => {
      if (!usdRate) return 0
      return orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (computeOrderUSD(o) ?? 0), 0)
    })(),
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title="Заказы"
        subtitle={`Всего: ${stats.total}`}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => navigate('/parts/orders/create')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Создать заказ</span>
          </button>
        }
      />

      {/* Content */}
      <div className="page-container">

        {/* Stats — фильтр-плитки */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
          {[
            { key: 'all',         label: 'Всего',     value: stats.total,       dot: 'bg-gray-400',    text: 'text-gray-900',    ring: 'ring-primary' },
            { key: 'new',         label: 'Новые',     value: stats.new,         dot: 'bg-blue-500',    text: 'text-blue-600',    ring: 'ring-blue-500' },
            { key: 'in_progress', label: 'В работе',  value: stats.in_progress, dot: 'bg-amber-400',   text: 'text-amber-600',   ring: 'ring-amber-400' },
            { key: 'completed',   label: 'Завершены', value: stats.completed,   dot: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500' },
          ].map(({ key, label, value, dot, text, ring }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`stat-card cursor-pointer text-left transition-all ${statusFilter === key ? `ring-2 ${ring}` : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">{label}</p>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${dot}`} />
              </div>
              <p className={`text-3xl font-extrabold tabular ${text}`} style={{ letterSpacing: '-0.03em' }}>
                {value}
              </p>
            </button>
          ))}

          {/* Выручка */}
          <div className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <p className="kicker">Выручка</p>
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5 bg-purple-400" />
            </div>
            <p className="text-2xl font-extrabold tabular text-purple-600" style={{ letterSpacing: '-0.03em' }}>
              {formatUSD(stats.totalRevenue)}
            </p>
          </div>
        </div>

        {/* Поиск + фильтр-чипы */}
        <div className="card p-4 mb-4">
          {/* Поиск */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по номеру, клиенту, телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-10"
            />
          </div>

          {/* Чипы статуса */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all',         label: 'Все' },
              { key: 'new',         label: 'Новые' },
              { key: 'in_progress', label: 'В работе' },
              { key: 'completed',   label: 'Завершены' },
              { key: 'cancelled',   label: 'Отменены' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`chip ${statusFilter === key ? 'chip-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Список заказов */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <ShoppingCart className="w-7 h-7 text-gray-400" />
              </div>
              <p className="empty-state-title">
                {searchQuery || statusFilter !== 'all' ? 'Заказы не найдены' : 'Нет заказов'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <p className="empty-state-text">
                  <button
                    onClick={() => navigate('/parts/orders/create')}
                    className="text-primary font-semibold hover:underline"
                  >
                    Создать первый заказ
                  </button>
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop — таблица (md+) */}
            <div className="card p-0 overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header-cell">№ заказа</th>
                      <th className="table-header-cell">Запчасти</th>
                      <th className="table-header-cell">Клиент</th>
                      <th className="table-header-cell">Дата</th>
                      <th className="table-header-cell">Статус</th>
                      <th className="table-header-cell text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/parts/orders/${order.id}`)}
                        className="table-row cursor-pointer group/row"
                      >
                        <td className="table-cell">
                          <span className="kicker text-gray-400">{order.order_number}</span>
                        </td>
                        <td className="table-cell">
                          <div className="font-semibold text-gray-900 group-hover/row:text-primary transition-colors line-clamp-2 max-w-xs">
                            {order.items && order.items.length > 0
                              ? order.items.map((i: any) => i.inventory_item?.name).filter(Boolean).join(', ')
                              : '—'}
                          </div>
                          {order.items && order.items.length > 0 && (
                            <span className="text-xs text-gray-400 mt-0.5 block">{order.items.length} поз.</span>
                          )}
                        </td>
                        <td className="table-cell">
                          {order.customer ? (
                            <div>
                              <div className="font-semibold text-gray-800">{order.customer.full_name}</div>
                              {order.customer.phone && (
                                <div className="text-xs text-gray-400 mt-0.5">{order.customer.phone}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="table-cell whitespace-nowrap text-gray-500">
                          {formatDate(order.order_date)}
                        </td>
                        <td className="table-cell whitespace-nowrap">
                          <span className={statusBadge(order.status)}>
                            {getPartsOrderStatusText(order.status)}
                          </span>
                        </td>
                        <td className="table-cell whitespace-nowrap text-right">
                          <span className="text-base font-extrabold tabular text-primary" style={{ letterSpacing: '-0.02em' }}>
                            {formatUSD(computeOrderUSD(order))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile — плоские карточки (<md) */}
            <div className="flex flex-col gap-2 md:hidden stagger-children">
              {filteredOrders.map((order) => {
                const itemNames = order.items && order.items.length > 0
                  ? order.items.map((i: any) => i.inventory_item?.name).filter(Boolean).join(', ')
                  : '—'
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/parts/orders/${order.id}`)}
                    className="card card-interactive p-4"
                  >
                    {/* Строка 1: клиент + сумма */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {order.customer?.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{itemNames}</p>
                      </div>
                      <span className="text-base font-extrabold tabular text-primary flex-shrink-0" style={{ letterSpacing: '-0.02em' }}>
                        {formatUSD(computeOrderUSD(order))}
                      </span>
                    </div>
                    {/* Строка 2: дата · статус */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>{formatDate(order.order_date)}</span>
                      <span>·</span>
                      <span className={statusBadge(order.status)}>
                        {getPartsOrderStatusText(order.status)}
                      </span>
                      {order.items && order.items.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{order.items.length} поз.</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
