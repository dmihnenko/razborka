import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { PartsOrder } from '@/types/parts'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Grid, List, ShoppingCart, DollarSign } from 'lucide-react'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import PartsPageHeader from '@/components/parts/PartsPageHeader'

type ViewMode = 'grid' | 'list'

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
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

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
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Создать заказ</span>
          </button>
        }
      />

      {/* Content */}
      <div className="w-full py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4 sm:mb-6">
          {[
            { key: 'all',        label: 'Всего',    value: stats.total,       dot: 'bg-gray-400',   text: 'text-gray-900',   ring: 'ring-primary' },
            { key: 'new',        label: 'Новые',    value: stats.new,         dot: 'bg-blue-500',   text: 'text-blue-600',   ring: 'ring-blue-500' },
            { key: 'in_progress',label: 'В работе', value: stats.in_progress, dot: 'bg-amber-400',  text: 'text-amber-600',  ring: 'ring-amber-400' },
            { key: 'completed',  label: 'Завершены',value: stats.completed,   dot: 'bg-emerald-500',text: 'text-emerald-600',ring: 'ring-emerald-500' },
          ].map(({ key, label, value, dot, text, ring }) => (
            <button key={key} onClick={() => setStatusFilter(key as any)}
              className={`stat-card cursor-pointer text-left transition-all ${statusFilter === key ? `ring-2 ${ring}` : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500">{label}</p>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${dot}`} />
              </div>
              <p className={`text-3xl font-extrabold ${text}`} style={{ letterSpacing: '-0.03em' }}>{value}</p>
            </button>
          ))}
          <div className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500">Выручка</p>
              <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5 bg-purple-400" />
            </div>
            <p className="text-2xl font-extrabold text-purple-600" style={{ letterSpacing: '-0.03em' }}>{formatUSD(stats.totalRevenue)}</p>
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="card p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Поиск по номеру, клиенту, телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-10"
              />
            </div>

            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Grid className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {statusFilter !== 'all' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                Фильтр: <span className="font-bold">{statusFilter === 'new' ? 'Новые' : statusFilter === 'in_progress' ? 'В работе' : statusFilter === 'completed' ? 'Завершенные' : 'Отмененные'}</span>
              </span>
              <button
                onClick={() => setStatusFilter('all')}
                className="ml-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Сбросить
              </button>
            </div>
          )}
        </div>

        {/* Orders List/Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="icon-tile-lg bg-gray-100 text-gray-300 mx-auto mb-4">
              <ShoppingCart className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">
              {searchQuery || statusFilter !== 'all' ? 'Заказы не найдены' : 'Нет заказов'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => navigate('/parts/orders/create')}
                className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Создать первый заказ
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/parts/orders/${order.id}`)}
                className="card card-interactive p-0 overflow-hidden group"
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-2 flex-1">
                      {order.items && order.items.length > 0
                        ? order.items.map((i: any) => i.inventory_item?.name).filter(Boolean).join(', ')
                        : '—'}
                    </h3>
                    <span className={`badge flex-shrink-0 ${getPartsOrderStatusColor(order.status)}`}>
                      {getPartsOrderStatusText(order.status)}
                    </span>
                  </div>

                  {/* Customer Info */}
                  {order.customer && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-700">{order.customer.full_name}</p>
                      {order.customer.phone && (
                        <p className="text-xs text-gray-400 mt-0.5">{order.customer.phone}</p>
                      )}
                    </div>
                  )}

                  {/* Order Details */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span>{formatDate(order.order_date)}</span>
                    {order.items && order.items.length > 0 && (
                      <span className="font-medium">{order.items.length} поз.</span>
                    )}
                  </div>

                  {/* Total Amount */}
                  <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-400">Сумма</span>
                    <span className="text-lg font-extrabold text-blue-600" style={{ letterSpacing: '-0.02em' }}>{formatUSD(computeOrderUSD(order))}</span>
                  </div>

                  {order.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 line-clamp-2">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header-cell">Запчасти</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 hidden md:table-cell" style={{ letterSpacing: '0.06em' }}>Клиент</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 hidden lg:table-cell" style={{ letterSpacing: '0.06em' }}>Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 hidden sm:table-cell" style={{ letterSpacing: '0.06em' }}>Статус</th>
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
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100">
                        <div className="font-semibold text-gray-900 group-hover/row:text-blue-600 transition-colors line-clamp-2 max-w-xs">
                          {order.items && order.items.length > 0
                            ? order.items.map((i: any) => i.inventory_item?.name).filter(Boolean).join(', ')
                            : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 hidden md:table-cell">
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
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 whitespace-nowrap hidden lg:table-cell">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 whitespace-nowrap hidden sm:table-cell">
                        <span className={`badge ${getPartsOrderStatusColor(order.status)}`}>
                          {getPartsOrderStatusText(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border-b border-gray-100 whitespace-nowrap text-right">
                        <span className="text-base font-extrabold text-blue-600" style={{ letterSpacing: '-0.02em' }}>{formatUSD(computeOrderUSD(order))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
