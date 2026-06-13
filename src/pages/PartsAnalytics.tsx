import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { formatPrice } from '@/utils/currency'
import {
  BarChart3,
  TrendingUp,
  Package,
  ShoppingCart,
  Car,
  Calendar,
  Lock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { useSubscriptionLimits } from '@/hooks/useSubscription'

export default function PartsAnalytics() {
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { rate: globalRate } = usePartsExchangeRate()
  const { hasAnalytics } = useSubscriptionLimits()

  // Общая статистика
  const { data: overallStats } = useQuery({
    queryKey: ['parts-analytics-overall', partsCompanyId, globalRate],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!partsCompanyId) return null

      const [ordersRes, inventoryRes, vehiclesRes] = await Promise.all([
        supabase
          .from('parts_orders')
          .select('status, order_date, items:parts_order_items(price_at_sale, price_at_sale_currency, quantity)')
          .eq('parts_company_id', partsCompanyId),
        supabase
          .from('parts_inventory')
          .select('quantity, selling_price, sold_price, purchase_price, status, price_currency, vehicle_id')
          .eq('parts_company_id', partsCompanyId),
        supabase
          .from('parts_vehicles')
          .select('id, status, exchange_rate')
          .eq('parts_company_id', partsCompanyId),
      ])

      const orders = ordersRes.data || []
      const inventory = inventoryRes.data || []
      const vehicles = vehiclesRes.data || []

      // Карта курсов по автомобилю
      const vehicleRateMap: Record<string, number> = {}
      for (const v of vehicles) {
        if (v.id && v.exchange_rate) vehicleRateMap[v.id] = v.exchange_rate
      }

      // Конвертация в USD
      const toUSD = (price: number, currency: string | null | undefined, vehicleId: string | null | undefined): number => {
        if (!price) return 0
        if (currency === 'USD') return price
        const rate = (vehicleId && vehicleRateMap[vehicleId]) || globalRate || 41
        return price / rate
      }

      // Выручка из проданных запчастей (status='sold')
      const soldItems = inventory.filter(i => i.status === 'sold')
      const totalRevenue = soldItems.reduce((sum, i) => {
        const price = i.sold_price || i.selling_price || 0
        return sum + toUSD(price, i.price_currency, i.vehicle_id)
      }, 0)

      // Count by status='sold'
      const totalSoldParts = soldItems.length

      const completedOrders = orders.filter((o: any) => o.status === 'completed')
      const avgCheck = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0

      // Стоимость склада (не проданные)
      const inventoryValue = inventory
        .filter(i => i.status !== 'sold')
        .reduce((sum, i) => sum + toUSD(i.quantity * (i.selling_price || 0), i.price_currency, i.vehicle_id), 0)

      // Потенциальная маржа склада: позиции в наличии, у которых есть и selling_price, и purchase_price > 0
      const potentialMargin = inventory
        .filter(i => i.status !== 'sold' && (i.selling_price ?? 0) > 0 && (i.purchase_price ?? 0) > 0)
        .reduce((sum, i) => {
          const qty = i.quantity || 1
          const marginPerUnit = (i.selling_price! - i.purchase_price!) * qty
          return sum + toUSD(marginPerUnit, i.price_currency, i.vehicle_id)
        }, 0)

      // Данные по месяцам — суммируем позиции заказов с конвертацией
      const monthlyData: Record<string, { revenue: number; orders: number }> = {}
      completedOrders.forEach((order: any) => {
        const monthKey = new Date(order.order_date).toISOString().slice(0, 7) // 'YYYY-MM'
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { revenue: 0, orders: 0 }
        }
        const orderRevenue = (order.items || []).reduce((s: number, item: any) => {
          const amount = (item.price_at_sale || 0) * (item.quantity || 1)
          return s + toUSD(amount, item.price_at_sale_currency, null)
        }, 0)
        monthlyData[monthKey].revenue += orderRevenue
        monthlyData[monthKey].orders += 1
      })

      const monthlyRevenue = Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([key, data]) => [
          new Date(key + '-01').toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
          data,
        ] as [string, { revenue: number; orders: number }])

      return {
        totalRevenue,
        totalOrders: orders.length,
        completedOrders: completedOrders.length,
        totalSoldParts,
        avgCheck,
        inventoryValue,
        potentialMargin,
        totalVehicles: vehicles.length,
        dismantledVehicles: vehicles.filter((v: any) => v.status === 'dismantled').length,
        monthlyRevenue,
      }
    },
    enabled: !!partsCompanyId,
  })

  // Топ запчастей
  const { data: topParts } = useQuery({
    queryKey: ['parts-analytics-top-parts', partsCompanyId, globalRate],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!partsCompanyId) return []

      // Fetch sold items + vehicles for per-vehicle exchange rate
      const [inventoryRes, vehiclesRes] = await Promise.all([
        supabase
          .from('parts_inventory')
          .select('name, sold_price, selling_price, price_currency, vehicle_id')
          .eq('parts_company_id', partsCompanyId)
          .eq('status', 'sold'),
        supabase
          .from('parts_vehicles')
          .select('id, exchange_rate')
          .eq('parts_company_id', partsCompanyId),
      ])

      const vehicleRateMap: Record<string, number> = {}
      for (const v of vehiclesRes.data || []) {
        if (v.id && v.exchange_rate) vehicleRateMap[v.id] = v.exchange_rate
      }

      const toUSD = (price: number, currency: string | null | undefined, vehicleId: string | null | undefined): number => {
        if (!price) return 0
        if (currency === 'USD') return price
        const rate = (vehicleId && vehicleRateMap[vehicleId]) || globalRate || 41
        return price / rate
      }

      const grouped: Record<string, { name: string; sold_quantity: number; revenue: number; selling_price: number }> = {}
      for (const item of inventoryRes.data || []) {
        const rawPrice = item.sold_price || item.selling_price || 0
        const priceUSD = toUSD(rawPrice, item.price_currency, item.vehicle_id)
        if (!grouped[item.name]) {
          grouped[item.name] = { name: item.name, sold_quantity: 0, revenue: 0, selling_price: priceUSD }
        }
        grouped[item.name].sold_quantity += 1
        grouped[item.name].revenue += priceUSD
      }

      return Object.values(grouped)
        .sort((a, b) => b.sold_quantity - a.sold_quantity)
        .slice(0, 5)
    },
    enabled: !!partsCompanyId,
  })

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title="Аналитика"
        subtitle="Статистика разборки"
        backPath="/parts/dashboard"
      />

      {/* Content */}
      <div className={`w-full py-6 relative${!hasAnalytics ? ' select-none' : ''}`}>

        {/* ── Paywall overlay ─────────────────────────────────── */}
        {!hasAnalytics && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 py-20 pointer-events-none">
            <div className="pointer-events-auto max-w-sm w-full bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 flex flex-col items-center text-center gap-5 animate-fade-in">
              <div className="icon-tile-lg bg-primary/10">
                <Lock className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="page-title text-lg">Аналитика и окупаемость</p>
                <p className="page-subtitle mt-2">
                  Подробная статистика, топ запчастей и история выручки доступны в тарифе{' '}
                  <span className="font-semibold text-gray-700">Профи</span> и выше.
                </p>
              </div>
              <Link to="/parts/subscription" className="btn-primary w-full text-center justify-center">
                Открыть аналитику
              </Link>
            </div>
          </div>
        )}

        {/* ── Analytics content (blurred preview when !hasAnalytics) ── */}
        <div className={!hasAnalytics ? 'blur-sm pointer-events-none' : ''}>

          {/* ── Primary KPI row ──────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6 stagger-children">

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-green-50 text-green-600">
                  <TrendingUp className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">Общая выручка</p>
              <p className="heading-2 tabular">
                {formatPrice(overallStats?.totalRevenue || 0, 'USD')}
              </p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                {overallStats?.completedOrders || 0} завершённых заказов
              </p>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-blue-50 text-blue-600">
                  <BarChart3 className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">Средний чек</p>
              <p className="heading-2 tabular">
                {formatPrice(overallStats?.avgCheck || 0, 'USD')}
              </p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                На основе {overallStats?.completedOrders || 0} заказов
              </p>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-green-50 text-green-600">
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">Продано запчастей</p>
              <p className="heading-2 tabular">{overallStats?.totalSoldParts || 0}</p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                Склад: {formatPrice(overallStats?.inventoryValue || 0, 'USD')}
              </p>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-slate-100 text-slate-500">
                  <Calendar className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">Разобрано авто</p>
              <p className="heading-2 tabular">{overallStats?.dismantledVehicles || 0}</p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                Из {overallStats?.totalVehicles || 0} всего
              </p>
            </div>
          </div>

          {/* ── Маржа склада ─────────────────────────────────── */}
          {(overallStats?.potentialMargin ?? 0) !== 0 && (
            <div className="stat-card mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="icon-tile bg-emerald-50 text-emerald-600 flex-shrink-0">
                <TrendingUp className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="kicker mb-0.5">Потенциальная маржа склада</p>
                <p className="text-mobile-sm text-gray-500">
                  По позициям, у которых указана закупочная цена
                </p>
              </div>
              <p className={`heading-2 tabular flex-shrink-0 ${(overallStats?.potentialMargin ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(overallStats?.potentialMargin ?? 0) >= 0 ? '+' : ''}
                {formatPrice(overallStats?.potentialMargin || 0, 'USD')}
              </p>
            </div>
          )}

          {/* ── Charts row ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

            {/* Monthly Revenue Chart */}
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="kicker mb-1">Динамика</p>
                  <h2 className="heading-3">Выручка по месяцам</h2>
                </div>
                <div className="icon-tile bg-blue-50 text-blue-500">
                  <BarChart3 className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>

              {overallStats?.monthlyRevenue && overallStats.monthlyRevenue.length > 0 ? (
                <div className="flex items-end justify-between gap-1 h-44">
                  {overallStats.monthlyRevenue.map(([month, data]) => {
                    const maxRevenue = Math.max(
                      ...overallStats.monthlyRevenue.map(([, d]) => d.revenue)
                    )
                    const heightPercent = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0

                    return (
                      <div key={month} className="flex flex-col items-center gap-1 flex-1 min-w-0 group">
                        <span className="text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular">
                          {formatPrice(data.revenue, 'USD')}
                        </span>
                        <div className="w-full flex items-end" style={{ height: '120px' }}>
                          <div
                            className="w-full bg-primary hover:bg-blue-400 rounded-t transition-colors cursor-default"
                            style={{ height: `${Math.max(heightPercent, 4)}%` }}
                            title={`${month}: ${formatPrice(data.revenue, 'USD')} · ${data.orders} зак.`}
                          />
                        </div>
                        <span className="text-xs text-gray-500 leading-none truncate w-full text-center">{month.replace(' г.', '')}</span>
                        <span className="kicker leading-none">{data.orders}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <BarChart3 className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <p className="empty-state-title">Нет данных о продажах</p>
                  <p className="empty-state-text">Завершите первые заказы, чтобы увидеть динамику</p>
                </div>
              )}
            </div>

            {/* Top Parts */}
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="kicker mb-1">Рейтинг</p>
                  <h2 className="heading-3">Топ запчастей</h2>
                </div>
                <div className="icon-tile bg-purple-50 text-purple-500">
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>

              {topParts && topParts.length > 0 ? (
                <div className="grid-hairline">
                  {topParts.map((part, index) => (
                    <div key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-600">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{part.name}</p>
                        <p className="text-mobile-sm text-gray-500">Продано: {part.sold_quantity} шт</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900 tabular">
                          {formatPrice(part.revenue, 'USD')}
                        </p>
                        <p className="text-mobile-sm text-gray-500 tabular">{formatPrice(part.selling_price, 'USD')}/шт</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <Package className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <p className="empty-state-title">Нет проданных запчастей</p>
                  <p className="empty-state-text">Статистика появится после первых продаж</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Secondary KPI row ────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 sm:mt-6 stagger-children">

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">Всего заказов</p>
                <ShoppingCart className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular">{overallStats?.totalOrders || 0}</p>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">Коэф. завершения</p>
                <TrendingUp className="w-4 h-4 text-green-500" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular">
                {overallStats?.totalOrders
                  ? Math.round((overallStats.completedOrders / overallStats.totalOrders) * 100)
                  : 0}
                %
              </p>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">Средняя цена</p>
                <Package className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular">
                {overallStats?.totalSoldParts && overallStats?.totalRevenue
                  ? formatPrice(overallStats.totalRevenue / overallStats.totalSoldParts, 'USD')
                  : '$0'}
              </p>
            </div>

            <div className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">Прогресс разборки</p>
                <Car className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular">
                {overallStats?.totalVehicles
                  ? Math.round((overallStats.dismantledVehicles / overallStats.totalVehicles) * 100)
                  : 0}
                %
              </p>
            </div>
          </div>

        </div>{/* /analytics content blur wrapper */}
      </div>
    </div>
  )
}
