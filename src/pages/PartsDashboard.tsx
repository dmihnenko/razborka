import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Car, ShoppingCart, DollarSign, AlertCircle, ArrowRight, Warehouse, LayoutGrid, Users, BarChart2, Settings, Wrench, Store } from 'lucide-react'
import { getPartsOrderStatusText } from '@/utils/status'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'

export default function PartsDashboard() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { rate: usdRate } = usePartsExchangeRate()

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
        awaiting: data?.filter(v => v.status === 'awaiting').length || 0,
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
      if (!partsCompanyId) return { total: 0, available: 0, lowStock: 0, valueUSD: 0, valueUAH: 0, fromVehicles: 0, fromShop: 0 }

      const { data } = await supabase
        .from('parts_inventory')
        .select('quantity, reserved_quantity, selling_price, price_currency, min_stock_level, status, vehicle_id')
        .eq('parts_company_id', partsCompanyId)

      const available_items = data?.filter(item => item.status !== 'sold') || []
      const total = available_items.reduce((sum, item) => sum + item.quantity, 0)
      const available = available_items.reduce((sum, item) => sum + (item.quantity - item.reserved_quantity), 0)
      const lowStock = available_items.filter(item => item.quantity <= item.min_stock_level).length
      // value будет в USD
      const valueUSD = available_items.reduce((sum, item: any) => {
        const price = item.selling_price || 0
        const qty = item.quantity || 0
        // NULL price_currency = USD (системный дефолт)
        const isUSD = item.price_currency === 'USD' || !item.price_currency
        return sum + (isUSD ? price * qty : 0)
      }, 0)
      const valueUAH = available_items.reduce((sum, item: any) => {
        const price = item.selling_price || 0
        const qty = item.quantity || 0
        const isUAH = item.price_currency === 'UAH'
        return sum + (isUAH ? price * qty : 0)
      }, 0)
      const fromVehicles = available_items.reduce((sum, item) => sum + (item.vehicle_id ? item.quantity : 0), 0)
      const fromShop = available_items.reduce((sum, item) => sum + (!item.vehicle_id ? item.quantity : 0), 0)

      return { total, available, lowStock, valueUSD, valueUAH, fromVehicles, fromShop }
    },
    enabled: !!partsCompanyId,
  })

  // Статистика заказов
  const { data: ordersStats } = useQuery({
    queryKey: ['parts-orders-stats', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return { total: 0, new: 0, in_progress: 0, completed: 0, completedOrders: [] }

      const { data } = await supabase
        .from('parts_orders')
        .select(`
          id, status, total_amount, exchange_rate_at_sale,
          items:parts_order_items(price_at_sale, quantity, price_at_sale_currency)
        `)
        .eq('parts_company_id', partsCompanyId)

      return {
        total: data?.length || 0,
        new: data?.filter(o => o.status === 'new').length || 0,
        in_progress: data?.filter(o => o.status === 'in_progress').length || 0,
        completed: data?.filter(o => o.status === 'completed').length || 0,
        completedOrders: data?.filter(o => o.status === 'completed') || [],
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
          exchange_rate_at_sale,
          customer:parts_customers(full_name),
          items:parts_order_items(price_at_sale, quantity, price_at_sale_currency)
        `)
        .eq('parts_company_id', partsCompanyId)
        .order('order_date', { ascending: false })
        .limit(5)

      return orders || []
    },
    enabled: !!partsCompanyId,
  })

  const computeOrderUSD = (order: any): number | null => {
    if (!order.items || order.items.length === 0) return null
    const rate = order.exchange_rate_at_sale || usdRate
    if (!rate) return null
    return order.items.reduce((sum: number, item: any) => {
      const amount = (item.price_at_sale ?? 0) * (item.quantity ?? 1)
      return sum + (item.price_at_sale_currency === 'USD' ? amount : amount / rate)
    }, 0)
  }

  // Выручка в USD — считаем по каждой позиции с учётом валюты
  const revenueUSD = (ordersStats?.completedOrders || []).reduce((sum: number, order: any) => {
    return sum + (computeOrderUSD(order) ?? 0)
  }, 0)

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (!partsCompanyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-orange-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">Нет доступа к разборке</p>
          <p className="text-xs text-gray-400 mt-1">Обратитесь к администратору</p>
        </div>
      </div>
    )
  }

  const totalInventoryValueUSD = Math.round(
    (inventoryStats?.valueUSD || 0) + (inventoryStats?.valueUAH || 0) / (usdRate || 41)
  )

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Page header ───────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            Авторазборка
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Управление разборкой и складом</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/parts/vehicles')}
            className="btn-secondary btn-sm hidden sm:flex items-center gap-1.5"
          >
            <Car className="w-4 h-4" />
            <span>Авто</span>
          </button>
          <button
            onClick={() => navigate('/parts/orders/create')}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Новый заказ</span>
          </button>
        </div>
      </div>

      {/* ── Alert: new orders ─────────────────────── */}
      {(ordersStats?.new || 0) > 0 && (
        <button
          onClick={() => navigate('/parts/orders')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
          style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(234,179,8,0.15)' }}>
            <AlertCircle className="w-4 h-4" style={{ color: '#CA8A04' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#854D0E' }}>
              {ordersStats.new} новых {ordersStats.new === 1 ? 'заказ' : ordersStats.new < 5 ? 'заказа' : 'заказов'} ожидает обработки
            </p>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: '#CA8A04' }} />
        </button>
      )}

      {/* ── Main KPI row ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Vehicles */}
        <button
          onClick={() => navigate('/parts/vehicles')}
          className="card text-left group hover:shadow-card-hover transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
              <Car className="w-5 h-5" style={{ color: '#2563EB' }} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#2563EB' }} />
          </div>
          <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Автомобили</p>
          <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
            {vehiclesStats?.total || 0}
          </p>
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>В работе</span>
              <span className="font-semibold" style={{ color: '#D97706' }}>{vehiclesStats?.in_progress || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Разобрано</span>
              <span className="font-semibold" style={{ color: '#16A34A' }}>{vehiclesStats?.dismantled || 0}</span>
            </div>
          </div>
        </button>

        {/* Inventory */}
        <button
          onClick={() => navigate('/parts/inventory')}
          className="card text-left group hover:shadow-card-hover transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(234,88,12,0.1)' }}>
              <Wrench className="w-5 h-5" style={{ color: '#EA580C' }} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#EA580C' }} />
          </div>
          <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Запчасти</p>
          <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
            {inventoryStats?.total || 0}
          </p>
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Доступно</span>
              <span className="font-semibold" style={{ color: '#16A34A' }}>{inventoryStats?.available || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Мало на складе</span>
              <span className="font-semibold" style={{ color: inventoryStats?.lowStock ? '#DC2626' : '#94A3B8' }}>
                {inventoryStats?.lowStock || 0}
              </span>
            </div>
          </div>
        </button>

        {/* Orders */}
        <button
          onClick={() => navigate('/parts/orders')}
          className="card text-left group hover:shadow-card-hover transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(234,179,8,0.1)' }}>
              <ShoppingCart className="w-5 h-5" style={{ color: '#CA8A04' }} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#CA8A04' }} />
          </div>
          <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Заказы</p>
          <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
            {ordersStats?.total || 0}
          </p>
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Новые</span>
              <span className="font-semibold" style={{ color: '#2563EB' }}>{ordersStats?.new || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: '#94A3B8' }}>Завершены</span>
              <span className="font-semibold" style={{ color: '#16A34A' }}>{ordersStats?.completed || 0}</span>
            </div>
          </div>
        </button>

        {/* Revenue */}
        <button
          onClick={() => navigate('/parts/customers')}
          className="card text-left group hover:shadow-card-hover transition-all"
          style={{ background: 'linear-gradient(135deg, #1E3A6E 0%, #1E40AF 100%)', border: 'none' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity text-white" />
          </div>
          <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Выручка</p>
          <p className="text-3xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
            {revenueUSD > 0 ? `$${Math.round(revenueUSD).toLocaleString('ru-RU')}` : '—'}
          </p>
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>Клиентов</span>
              <span className="font-semibold text-white">{customersStats?.total || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>Склад USD</span>
              <span className="font-semibold text-white">${totalInventoryValueUSD.toLocaleString('ru-RU')}</span>
            </div>
          </div>
        </button>
      </div>

      {/* ── Bottom layout: left column + right column ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left col (2/3): inventory breakdown + nav tools */}
        <div className="lg:col-span-2 space-y-4">

          {/* Inventory breakdown */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <p className="text-sm font-semibold text-gray-800">Склад</p>
              <button
                onClick={() => navigate('/parts/inventory')}
                className="text-xs font-medium flex items-center gap-1 transition-colors"
                style={{ color: '#2563EB' }}
              >
                Открыть <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 divide-x" style={{ divideColor: '#F1F5F9' }}>
              <button
                onClick={() => navigate('/parts/inventory?source=vehicles')}
                className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(234,88,12,0.1)' }}>
                    <Wrench className="w-3.5 h-3.5" style={{ color: '#EA580C' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#64748B' }}>С разборки</span>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                  {inventoryStats?.fromVehicles || 0}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>позиций</p>
              </button>
              <button
                onClick={() => navigate('/parts/inventory?source=shop')}
                className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(22,163,74,0.1)' }}>
                    <Store className="w-3.5 h-3.5" style={{ color: '#16A34A' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#64748B' }}>Магазин</span>
                </div>
                <p className="text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                  {inventoryStats?.fromShop || 0}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>позиций</p>
              </button>
              <button
                onClick={() => navigate('/parts/inventory/no-price')}
                className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgba(220,38,38,0.08)' }}>
                    <AlertCircle className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#64748B' }}>Без цены</span>
                </div>
                <p className="text-2xl font-bold" style={{ letterSpacing: '-0.03em', color: inventoryStats?.lowStock ? '#DC2626' : '#111827' }}>
                  {inventoryStats?.lowStock || 0}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>нужна цена</p>
              </button>
            </div>
          </div>

          {/* Navigation tools */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <p className="text-sm font-semibold text-gray-800">Управление</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5">
              {[
                { label: 'Склад', icon: Warehouse, path: '/parts/warehouse', color: '#D97706', bg: 'rgba(217,119,6,0.09)' },
                { label: 'Категории', icon: LayoutGrid, path: '/parts/categories', color: '#2563EB', bg: 'rgba(37,99,235,0.09)' },
                { label: 'Сотрудники', icon: Users, path: '/parts/employees', color: '#16A34A', bg: 'rgba(22,163,74,0.09)' },
                { label: 'Аналитика', icon: BarChart2, path: '/parts/analytics', color: '#7C3AED', bg: 'rgba(124,58,237,0.09)' },
                { label: 'Настройки', icon: Settings, path: '/parts/settings', color: '#475569', bg: 'rgba(71,85,105,0.09)' },
              ].map(({ label, icon: Icon, path, color, bg }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center gap-2 py-5 px-3 hover:bg-gray-50 transition-colors group relative"
                  style={{ borderRight: '1px solid #F1F5F9' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ backgroundColor: bg }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right col (1/3): recent orders */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <p className="text-sm font-semibold text-gray-800">Последние заказы</p>
            <button
              onClick={() => navigate('/parts/orders')}
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: '#2563EB' }}
            >
              Все <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentActivity && recentActivity.length > 0 ? (
            <div className="flex-1 overflow-auto divide-y" style={{ divideColor: '#F1F5F9' }}>
              {recentActivity.map((order: any) => {
                const usd = computeOrderUSD(order)
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/parts/orders/${order.id}`)}
                    className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-gray-900 truncate">{order.order_number}</span>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: '#2563EB' }}>
                        {usd != null ? `$${Math.round(usd).toLocaleString('ru-RU')}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ backgroundColor: 'rgba(37,99,235,0.08)', color: '#1D4ED8' }}
                      >
                        {getPartsOrderStatusText(order.status)}
                      </span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{formatDate(order.order_date)}</span>
                    </div>
                    {order.customer?.full_name && (
                      <p className="text-xs mt-1 truncate" style={{ color: '#64748B' }}>{order.customer.full_name}</p>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                <ShoppingCart className="w-6 h-6" style={{ color: '#94A3B8' }} />
              </div>
              <p className="text-sm font-medium text-gray-600">Нет заказов</p>
              <button
                onClick={() => navigate('/parts/orders/create')}
                className="mt-3 text-xs font-medium transition-colors"
                style={{ color: '#2563EB' }}
              >
                Создать первый заказ
              </button>
            </div>
          )}

          {/* Quick action */}
          <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            <button
              onClick={() => navigate('/parts/orders/create')}
              className="btn-primary w-full flex items-center justify-center gap-2 btn-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              Новый заказ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
