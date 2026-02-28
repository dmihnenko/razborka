import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsOrder } from '@/types/parts'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Search, Grid, List, ShoppingCart, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'

type ViewMode = 'grid' | 'list'

export default function PartsOrders() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  const { rate: usdRate } = usePartsExchangeRate()

  const formatUSD = (amount?: number | null) => {
    if (!amount || !usdRate) return formatCurrency(amount)
    return `$${Math.round(amount / usdRate).toLocaleString('ru-RU')}`
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
          items:parts_order_items(id, quantity, subtotal)
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
    totalRevenue: orders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total_amount, 0),
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">У вас нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => navigate('/parts')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Заказы</h1>
                <p className="text-sm text-gray-500 hidden sm:block">Всего: {stats.total}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/parts/orders/create')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Создать заказ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'all' ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Всего</p>
              <ShoppingCart className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
          </button>

          <button
            onClick={() => setStatusFilter('new')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'new' ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Новые</p>
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.new}</p>
          </button>

          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'in_progress' ? 'ring-2 ring-yellow-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">В работе</p>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{stats.in_progress}</p>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'completed' ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Завершены</p>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.completed}</p>
          </button>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Выручка</p>
              <DollarSign className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-purple-600">{formatUSD(stats.totalRevenue)}</p>
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по номеру, клиенту, телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {statusFilter !== 'all' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Фильтр: <span className="font-medium capitalize">{statusFilter === 'new' ? 'Новые' : statusFilter === 'in_progress' ? 'В работе' : statusFilter === 'completed' ? 'Завершенные' : 'Отмененные'}</span>
              </span>
              <button
                onClick={() => setStatusFilter('all')}
                className="ml-2 text-sm text-primary hover:underline"
              >
                Сбросить
              </button>
            </div>
          )}
        </div>

        {/* Orders List/Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'Заказы не найдены' : 'Нет заказов'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => navigate('/parts/orders/create')}
                className="mt-4 text-primary hover:underline"
              >
                Создать первый заказ
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/parts/orders/${order.id}`)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group"
              >
                <div className="p-3 sm:p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                      {order.order_number}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPartsOrderStatusColor(order.status)} border-current`}>
                      {getPartsOrderStatusText(order.status)}
                    </span>
                  </div>

                  {/* Customer Info */}
                  {order.customer && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Клиент:</span> {order.customer.full_name}
                      </p>
                      {order.customer.phone && (
                        <p className="text-xs text-gray-500">{order.customer.phone}</p>
                      )}
                    </div>
                  )}

                  {/* Order Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Дата:</span>
                      <span className="font-medium">{formatDate(order.order_date)}</span>
                    </div>
                    {order.items && order.items.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Позиций:</span>
                        <span className="font-medium">{order.items.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Total Amount */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Сумма:</span>
                      <span className="text-xl font-bold text-primary">{formatUSD(order.total_amount)}</span>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Примечание:</p>
                      <p className="text-sm text-gray-600 line-clamp-2">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Номер заказа
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Клиент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Дата
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Сумма
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/parts/orders/${order.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">{order.order_number}</div>
                          {order.items && order.items.length > 0 && (
                            <div className="text-xs text-gray-500">{order.items.length} позиций</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        {order.customer ? (
                          <div>
                            <div className="text-sm text-gray-900">{order.customer.full_name}</div>
                            {order.customer.phone && (
                              <div className="text-xs text-gray-500">{order.customer.phone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap hidden sm:table-cell">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPartsOrderStatusColor(order.status)} border-current`}>
                          {getPartsOrderStatusText(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="text-lg font-bold text-primary">{formatUSD(order.total_amount)}</div>
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
