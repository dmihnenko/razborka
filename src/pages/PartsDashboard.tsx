import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Car, Package, ShoppingCart, Users, DollarSign, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react'

export default function PartsDashboard() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  // Статистика автомобилей
  const { data: vehiclesStats } = useQuery({
    queryKey: ['parts-vehicles-stats', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return { total: 0, awaiting: 0, in_progress: 0, dismantled: 0 }

      const { data } = await supabase
        .from('parts_vehicles')
        .select('status')
        .eq('parts_company_id', partsCompanyId)

      return {
        total: data?.length || 0,
        awaiting: data?.filter(v => v.status === 'awaiting_disassembly').length || 0,
        in_progress: data?.filter(v => v.status === 'in_progress').length || 0,
        dismantled: data?.filter(v => v.status === 'dismantled').length || 0,
      }
    },
    enabled: !!partsCompanyId,
  })

  // Статистика склада
  const { data: inventoryStats } = useQuery({
    queryKey: ['parts-inventory-stats', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return { total: 0, available: 0, lowStock: 0, value: 0 }

      const { data } = await supabase
        .from('parts_inventory')
        .select('quantity, reserved_quantity, selling_price, min_stock_level')
        .eq('parts_company_id', partsCompanyId)

      const total = data?.reduce((sum, item) => sum + item.quantity, 0) || 0
      const available = data?.reduce((sum, item) => sum + (item.quantity - item.reserved_quantity), 0) || 0
      const lowStock = data?.filter(item => item.quantity <= item.min_stock_level).length || 0
      const value = data?.reduce((sum, item) => sum + (item.quantity * item.selling_price), 0) || 0

      return { total, available, lowStock, value }
    },
    enabled: !!partsCompanyId,
  })

  // Статистика заказов
  const { data: ordersStats } = useQuery({
    queryKey: ['parts-orders-stats', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return { total: 0, new: 0, in_progress: 0, completed: 0, revenue: 0 }

      const { data } = await supabase
        .from('parts_orders')
        .select('status, total_amount')
        .eq('parts_company_id', partsCompanyId)

      return {
        total: data?.length || 0,
        new: data?.filter(o => o.status === 'new').length || 0,
        in_progress: data?.filter(o => o.status === 'in_progress').length || 0,
        completed: data?.filter(o => o.status === 'completed').length || 0,
        revenue: data?.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total_amount, 0) || 0,
      }
    },
    enabled: !!partsCompanyId,
  })

  // Статистика клиентов
  const { data: customersStats } = useQuery({
    queryKey: ['parts-customers-stats', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return { total: 0, withOrders: 0 }

      const { data } = await supabase
        .from('parts_customers')
        .select(`
          id,
          orders:parts_orders(id)
        `)
        .eq('parts_company_id', partsCompanyId)

      return {
        total: data?.length || 0,
        withOrders: data?.filter(c => c.orders && c.orders.length > 0).length || 0,
      }
    },
    enabled: !!partsCompanyId,
  })

  // Последняя активность
  const { data: recentActivity } = useQuery({
    queryKey: ['parts-recent-activity', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []

      const { data: orders } = await supabase
        .from('parts_orders')
        .select(`
          id,
          order_number,
          order_date,
          status,
          total_amount,
          customer:parts_customers(full_name)
        `)
        .eq('parts_company_id', partsCompanyId)
        .order('order_date', { ascending: false })
        .limit(5)

      return orders || []
    },
    enabled: !!partsCompanyId,
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ₴'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      new: 'bg-blue-100 text-blue-800 border-blue-200',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    const labels = {
      new: 'Новый',
      in_progress: 'В работе',
      completed: 'Завершен',
      cancelled: 'Отменен',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">У вас нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Дашборд разборки</h1>
          <p className="text-sm text-gray-600 mt-1">Управление авторазборкой</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Stats - Main Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Vehicles Card */}
          <button
            onClick={() => navigate('/parts/vehicles')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-5 text-left group"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="bg-blue-100 p-2 sm:p-3 rounded-lg group-hover:bg-blue-200 transition-colors">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Автомобилей</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{vehiclesStats?.total || 0}</p>
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">В работе:</span>
                <span className="font-medium text-yellow-600">{vehiclesStats?.in_progress || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-500">Разобрано:</span>
                <span className="font-medium text-green-600">{vehiclesStats?.dismantled || 0}</span>
              </div>
            </div>
          </button>

          {/* Inventory Card */}
          <button
            onClick={() => navigate('/parts/inventory')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-5 text-left group"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="bg-green-100 p-2 sm:p-3 rounded-lg group-hover:bg-green-200 transition-colors">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Запчастей на складе</p>
            <p className="text-3xl font-bold text-gray-900">{inventoryStats?.total || 0}</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Доступно:</span>
                <span className="font-medium text-green-600">{inventoryStats?.available || 0}</span>
              </div>
              {inventoryStats?.lowStock ? (
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-gray-500">Низкий остаток:</span>
                  <span className="font-medium text-red-600">{inventoryStats.lowStock}</span>
                </div>
              ) : null}
            </div>
          </button>

          {/* Orders Card */}
          <button
            onClick={() => navigate('/parts/orders')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-5 text-left group"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="bg-yellow-100 p-2 sm:p-3 rounded-lg group-hover:bg-yellow-200 transition-colors">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Заказов</p>
            <p className="text-3xl font-bold text-gray-900">{ordersStats?.total || 0}</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Новые:</span>
                <span className="font-medium text-blue-600">{ordersStats?.new || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-500">В работе:</span>
                <span className="font-medium text-yellow-600">{ordersStats?.in_progress || 0}</span>
              </div>
            </div>
          </button>

          {/* Revenue Card */}
          <button
            onClick={() => navigate('/parts/customers')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-5 text-left group"
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="bg-purple-100 p-2 sm:p-3 rounded-lg group-hover:bg-purple-200 transition-colors">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Выручка</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(ordersStats?.revenue || 0)}</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Клиентов:</span>
                <span className="font-medium text-purple-600">{customersStats?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-500">С заказами:</span>
                <span className="font-medium text-green-600">{customersStats?.withOrders || 0}</span>
              </div>
            </div>
          </button>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Inventory Value */}
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Стоимость склада</p>
              <TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(inventoryStats?.value || 0)}</p>
          </div>

          {/* Completed Orders */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Завершено заказов</p>
              <ShoppingCart className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{ordersStats?.completed || 0}</p>
          </div>

          {/* Active Vehicles */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Авто в ожидании</p>
              <Car className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{vehiclesStats?.awaiting || 0}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Последние заказы</h2>
              <button
                onClick={() => navigate('/parts/orders')}
                className="text-sm text-primary hover:underline"
              >
                Все заказы
              </button>
            </div>
          </div>

          {recentActivity && recentActivity.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {recentActivity.map((order: any) => (
                <button
                  key={order.id}
                  onClick={() => navigate(`/parts/orders/${order.id}`)}
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">{order.order_number}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <span className="font-bold text-primary">{formatCurrency(order.total_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{order.customer?.full_name || 'Без клиента'}</span>
                    <span>{formatDate(order.order_date)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Нет заказов</p>
              <button
                onClick={() => navigate('/parts/orders/create')}
                className="mt-4 text-primary hover:underline"
              >
                Создать первый заказ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
