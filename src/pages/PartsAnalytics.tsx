import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '@/utils/currency'
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart,
  Car,
  Calendar,
  AlertCircle
} from 'lucide-react'

export default function PartsAnalytics() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  // Общая статистика
  const { data: overallStats } = useQuery({
    queryKey: ['parts-analytics-overall', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return null

      const [ordersRes, inventoryRes, vehiclesRes] = await Promise.all([
        supabase
          .from('parts_orders')
          .select('status, total_amount, order_date, items:parts_order_items(quantity, subtotal)')
          .eq('parts_company_id', partsCompanyId),
        supabase
          .from('parts_inventory')
          .select('quantity, sold_quantity, selling_price, status')
          .eq('parts_company_id', partsCompanyId),
        supabase
          .from('parts_vehicles')
          .select('status')
          .eq('parts_company_id', partsCompanyId),
      ])

      const orders = ordersRes.data || []
      const inventory = inventoryRes.data || []
      const vehicles = vehiclesRes.data || []

      const completedOrders = orders.filter(o => o.status === 'completed')
      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0)
      const totalSoldParts = inventory.reduce((sum, i) => sum + i.sold_quantity, 0)
      const avgCheck = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0
      const inventoryValue = inventory
        .filter(i => i.status !== 'sold')
        .reduce((sum, i) => sum + (i.quantity * (i.selling_price || 0)), 0)

      // Данные по месяцам
      const monthlyData: Record<string, { revenue: number; orders: number }> = {}
      completedOrders.forEach(order => {
        const month = new Date(order.order_date).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
        if (!monthlyData[month]) {
          monthlyData[month] = { revenue: 0, orders: 0 }
        }
        monthlyData[month].revenue += order.total_amount
        monthlyData[month].orders += 1
      })

      const monthlyRevenue = Object.entries(monthlyData)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .slice(-6)

      return {
        totalRevenue,
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        totalSoldParts,
        avgCheck,
        inventoryValue,
        totalVehicles: vehicles.length,
        dismantledVehicles: vehicles.filter(v => v.status === 'dismantled').length,
        monthlyRevenue,
      }
    },
    enabled: !!partsCompanyId,
  })

  // Топ запчастей
  const { data: topParts } = useQuery({
    queryKey: ['parts-analytics-top-parts', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []

      const { data } = await supabase
        .from('parts_inventory')
        .select('name, sold_quantity, selling_price')
        .eq('parts_company_id', partsCompanyId)
        .gt('sold_quantity', 0)
        .order('sold_quantity', { ascending: false })
        .limit(5)

      return data || []
    },
    enabled: !!partsCompanyId,
  })



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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <button
              onClick={() => navigate('/parts')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Аналитика</h1>
              <p className="text-sm text-gray-500 hidden sm:block">Статистика разборки</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Общая выручка</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(overallStats?.totalRevenue || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {overallStats?.completedOrders || 0} завершенных заказов
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-100 p-3 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Средний чек</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(overallStats?.avgCheck || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              На основе {overallStats?.completedOrders || 0} заказов
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Продано запчастей</p>
            <p className="text-2xl font-bold text-gray-900">{overallStats?.totalSoldParts || 0}</p>
            <p className="text-xs text-gray-500 mt-2">
              Стоимость склада: {formatCurrency(overallStats?.inventoryValue || 0)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Car className="w-6 h-6 text-yellow-600" />
              </div>
              <Calendar className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Разобрано авто</p>
            <p className="text-2xl font-bold text-gray-900">{overallStats?.dismantledVehicles || 0}</p>
            <p className="text-xs text-gray-500 mt-2">
              Из {overallStats?.totalVehicles || 0} всего
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Monthly Revenue Chart */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Выручка по месяцам</h2>
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </div>

            {overallStats?.monthlyRevenue && overallStats.monthlyRevenue.length > 0 ? (
              <div className="space-y-4">
                {overallStats.monthlyRevenue.map(([month, data]) => {
                  const maxRevenue = Math.max(
                    ...overallStats.monthlyRevenue.map(([, d]) => d.revenue)
                  )
                  const widthPercent = (data.revenue / maxRevenue) * 100

                  return (
                    <div key={month}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">{month}</span>
                        <span className="text-gray-900 font-semibold">
                          {formatCurrency(data.revenue)}
                        </span>
                      </div>
                      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg transition-all"
                          style={{ width: `${widthPercent}%` }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-end pr-3">
                          <span className="text-xs text-gray-600 font-medium">
                            {data.orders} {data.orders === 1 ? 'заказ' : 'заказов'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Нет данных о продажах</p>
              </div>
            )}
          </div>

          {/* Top Parts */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Топ запчастей</h2>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </div>

            {topParts && topParts.length > 0 ? (
              <div className="space-y-4">
                {topParts.map((part, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-600">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{part.name}</p>
                        <p className="text-xs text-gray-500">Продано: {part.sold_quantity} шт</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(part.selling_price * part.sold_quantity)}
                      </p>
                      <p className="text-xs text-gray-500">{formatCurrency(part.selling_price)}/шт</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Нет проданных запчастей</p>
              </div>
            )}
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Всего заказов</p>
              <ShoppingCart className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{overallStats?.totalOrders || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Коэффициент завершения</p>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {overallStats?.totalOrders
                ? Math.round((overallStats.completedOrders / overallStats.totalOrders) * 100)
                : 0}
              %
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Средняя цена запчасти</p>
              <Package className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {overallStats?.totalSoldParts && overallStats?.totalRevenue
                ? formatCurrency(overallStats.totalRevenue / overallStats.totalSoldParts)
                : '₴0'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Прогресс разборки</p>
              <Car className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {overallStats?.totalVehicles
                ? Math.round((overallStats.dismantledVehicles / overallStats.totalVehicles) * 100)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
