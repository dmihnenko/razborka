import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Car, ShoppingCart, DollarSign, AlertCircle, ArrowRight, Warehouse, LayoutGrid, Users, BarChart2, Settings, Wrench, Store, Sparkles } from 'lucide-react'
import { getPartsOrderStatusText } from '@/utils/status'
import { formatDate } from '@/utils/date'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import ContactsReminder from '@/components/dashboard/ContactsReminder'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import OnboardingChecklist from '@/components/parts/OnboardingChecklist'

export default function PartsDashboard() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { rate: usdRate } = usePartsExchangeRate()
  const { hasSubscription, plan } = useSubscriptionLimits()

  // Кол-во заявок с маркетплейса (для upsell-баннера)
  const { data: marketOrdersCount = 0 } = useQuery({
    queryKey: ['marketplace-orders-count', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return 0
      const { count } = await supabase
        .from('marketplace_orders')
        .select('id', { count: 'exact', head: true })
        .eq('parts_company_id', partsCompanyId)
      return count || 0
    },
    enabled: !!partsCompanyId && (!hasSubscription || plan?.price === 0),
    staleTime: 5 * 60 * 1000,
  })

  const isDemo = !hasSubscription || plan?.price === 0

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
      const noPrice = available_items.filter(item => !item.selling_price).length
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

      return { total, available, lowStock, noPrice, valueUSD, valueUAH, fromVehicles, fromShop }
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

  if (!partsCompanyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="empty-state">
          <div className="empty-state-icon">
            <AlertCircle className="w-7 h-7 text-orange-500" strokeWidth={1.5} />
          </div>
          <p className="empty-state-title">Нет доступа к разборке</p>
          <p className="empty-state-text">Обратитесь к администратору</p>
        </div>
      </div>
    )
  }

  const totalInventoryValueUSD = Math.round(
    (inventoryStats?.valueUSD || 0) + (inventoryStats?.valueUAH || 0) / (usdRate || 41)
  )

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">

      {/* ── Page header ───────────────────────────── */}
      <div className="page-header">
        <div>
          <p className="kicker mb-1">Авторозборка</p>
          <h1 className="page-title">Дашборд</h1>
          <p className="page-subtitle">Управление разборкой и складом</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => navigate('/parts/vehicles')}
            className="btn-secondary btn-sm hidden sm:flex items-center gap-1.5"
          >
            <Car className="w-4 h-4" strokeWidth={1.5} />
            <span>Авто</span>
          </button>
          <button
            onClick={() => navigate('/parts/orders/create')}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
            <span>Новый заказ</span>
          </button>
        </div>
      </div>

      {/* Напоминание заполнить контакты разборки */}
      <ContactsReminder kind="parts" companyId={partsCompanyId} />

      {/* ── Онбординг-чек-лист (только для владельца, пока не всё настроено) ── */}
      <OnboardingChecklist partsCompanyId={partsCompanyId} />

      {/* ── Marketplace upsell banner ─────────────── */}
      {isDemo && marketOrdersCount > 0 && (
        <Link
          to="/parts/subscription"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-[0.99] border border-primary/20 bg-primary/5 hover:bg-primary/10 animate-fade-in"
        >
          <div className="icon-tile-sm bg-primary/15 text-primary flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">
              Покупатели интересуются вашими запчастями
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {marketOrdersCount} {marketOrdersCount === 1 ? 'заявка' : marketOrdersCount < 5 ? 'заявки' : 'заявок'} с маркетплейса — откройте полный доступ
            </p>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0 text-primary" strokeWidth={1.5} />
        </Link>
      )}

      {/* ── Alert: new orders ─────────────────────── */}
      {(ordersStats?.new || 0) > 0 && (
        <button
          onClick={() => navigate('/parts/orders')}
          className="alert alert-warning w-full text-left transition-all active:scale-[0.99] hover:bg-yellow-100/60 rounded-xl"
        >
          <div className="icon-tile-sm bg-yellow-100 text-yellow-600 flex-shrink-0">
            <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-800">
              {ordersStats?.new} новых {ordersStats?.new === 1 ? 'заказ' : (ordersStats?.new ?? 0) < 5 ? 'заказа' : 'заказов'} ожидает обработки
            </p>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0 text-yellow-600" strokeWidth={1.5} />
        </button>
      )}

      {/* ── Main KPI row ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">

        {/* Vehicles */}
        <button
          onClick={() => navigate('/parts/vehicles')}
          className="stat-card cursor-pointer text-left group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="icon-tile bg-blue-50 text-blue-600">
              <Car className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" strokeWidth={1.5} />
          </div>
          <p className="kicker mb-1">Автомобілі</p>
          <p className="heading-2 tabular">
            {vehiclesStats?.total || 0}
          </p>
          <div className="mt-3 pt-3 space-y-1 border-t border-gray-100">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">В работе</span>
              <span className="font-bold text-amber-600 tabular">{vehiclesStats?.in_progress || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Розібрано</span>
              <span className="font-bold text-green-600 tabular">{vehiclesStats?.dismantled || 0}</span>
            </div>
          </div>
        </button>

        {/* Inventory */}
        <button
          onClick={() => navigate('/parts/inventory')}
          className="stat-card cursor-pointer text-left group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="icon-tile bg-orange-50 text-orange-500">
              <Wrench className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-orange-500" strokeWidth={1.5} />
          </div>
          <p className="kicker mb-1">Запчасти</p>
          <p className="heading-2 tabular">
            {inventoryStats?.total || 0}
          </p>
          <div className="mt-3 pt-3 space-y-1 border-t border-gray-100">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Доступно</span>
              <span className="font-bold text-green-600 tabular">{inventoryStats?.available || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Мало на складе</span>
              <span className={`font-bold tabular ${(inventoryStats?.lowStock ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {inventoryStats?.lowStock || 0}
              </span>
            </div>
          </div>
        </button>

        {/* Orders */}
        <button
          onClick={() => navigate('/parts/orders')}
          className="stat-card cursor-pointer text-left group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="icon-tile bg-amber-50 text-amber-600">
              <ShoppingCart className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" strokeWidth={1.5} />
          </div>
          <p className="kicker mb-1">Заказы</p>
          <p className="heading-2 tabular">
            {ordersStats?.total || 0}
          </p>
          <div className="mt-3 pt-3 space-y-1 border-t border-gray-100">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Новые</span>
              <span className="font-bold text-blue-600 tabular">{ordersStats?.new || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Завершены</span>
              <span className="font-bold text-green-600 tabular">{ordersStats?.completed || 0}</span>
            </div>
          </div>
        </button>

        {/* Revenue */}
        <button
          onClick={() => navigate('/parts/customers')}
          className="stat-card cursor-pointer text-left group"
          style={{ background: 'var(--brand-gradient)', border: 'none' }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="icon-tile flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <DollarSign className="w-5 h-5 text-white" strokeWidth={1.5} />
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity text-white" strokeWidth={1.5} />
          </div>
          <p className="kicker mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Выручка</p>
          <p className="heading-2 tabular text-white">
            {revenueUSD > 0 ? `$${Math.round(revenueUSD).toLocaleString('ru-RU')}` : '—'}
          </p>
          <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>Клиентов</span>
              <span className="font-bold text-white tabular">{customersStats?.total || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>Склад USD</span>
              <span className="font-bold text-white tabular">${totalInventoryValueUSD.toLocaleString('ru-RU')}</span>
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
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100">
              <p className="kicker">Склад</p>
              <button
                onClick={() => navigate('/parts/inventory')}
                className="text-xs font-semibold flex items-center gap-1 text-primary hover:text-blue-700 transition-colors"
              >
                Открыть <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <button
                onClick={() => navigate('/parts/inventory?source=vehicles')}
                className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group active:bg-gray-100 min-h-[44px]"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="icon-tile-sm bg-orange-50 text-orange-500">
                    <Wrench className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                  <span className="kicker">С разборки</span>
                </div>
                <p className="heading-3 tabular">
                  {inventoryStats?.fromVehicles || 0}
                </p>
                <p className="text-xs mt-0.5 text-gray-400">позиций</p>
              </button>
              <button
                onClick={() => navigate('/parts/inventory?source=shop')}
                className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group active:bg-gray-100 min-h-[44px]"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="icon-tile-sm bg-green-50 text-green-600">
                    <Store className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                  <span className="kicker">Магазин</span>
                </div>
                <p className="heading-3 tabular">
                  {inventoryStats?.fromShop || 0}
                </p>
                <p className="text-xs mt-0.5 text-gray-400">позиций</p>
              </button>
              <button
                onClick={() => navigate('/parts/inventory/no-price')}
                className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group active:bg-gray-100 min-h-[44px]"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="icon-tile-sm bg-red-50 text-red-500">
                    <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                  <span className="kicker">Без цены</span>
                </div>
                <p className={`heading-3 tabular ${(inventoryStats?.noPrice ?? 0) > 0 ? 'text-red-600' : ''}`}>
                  {inventoryStats?.noPrice ?? 0}
                </p>
                <p className="text-xs mt-0.5 text-gray-400">нужна цена</p>
              </button>
            </div>
          </div>

          {/* Navigation tools */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="kicker">Управление</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5">
              {[
                { label: 'Склад',      icon: Warehouse,  path: '/parts/warehouse',  iconCls: 'icon-tile bg-amber-50 text-amber-600' },
                { label: 'Категории',  icon: LayoutGrid, path: '/parts/categories', iconCls: 'icon-tile bg-blue-50 text-blue-600' },
                { label: 'Сотрудники', icon: Users,       path: '/parts/employees',  iconCls: 'icon-tile bg-green-50 text-green-600' },
                { label: 'Аналитика',  icon: BarChart2,   path: '/parts/analytics',  iconCls: 'icon-tile bg-purple-50 text-purple-600' },
                { label: 'Настройки',  icon: Settings,    path: '/parts/settings',   iconCls: 'icon-tile bg-gray-100 text-gray-500' },
              ].map(({ label, icon: Icon, path, iconCls }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center gap-2 py-5 px-3 hover:bg-gray-50 transition-colors group active:bg-gray-100 border-r border-gray-100 last:border-r-0 min-h-[44px]"
                >
                  <div className={`${iconCls} transition-transform group-hover:scale-105`}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right col (1/3): recent orders */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
            <p className="kicker">Последние заказы</p>
            <button
              onClick={() => navigate('/parts/orders')}
              className="text-xs font-semibold flex items-center gap-1 text-primary hover:text-blue-700 transition-colors"
            >
              Все <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {recentActivity && recentActivity.length > 0 ? (
            <div className="flex-1 overflow-auto grid-hairline">
              {recentActivity.map((order: any) => {
                const usd = computeOrderUSD(order)
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate(`/parts/orders/${order.id}`)}
                    className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left group active:bg-gray-100 min-h-[44px]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors truncate">{order.order_number}</span>
                      <span className="text-sm font-extrabold flex-shrink-0 text-primary tabular">
                        {usd != null ? `$${Math.round(usd).toLocaleString('ru-RU')}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="badge badge-blue">
                        {getPartsOrderStatusText(order.status)}
                      </span>
                      <span className="text-xs text-gray-400 tabular">{formatDate(order.order_date)}</span>
                    </div>
                    {order.customer?.full_name && (
                      <p className="text-xs mt-1.5 truncate text-gray-500">{order.customer.full_name}</p>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
              <div className="empty-state-icon">
                <ShoppingCart className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
              </div>
              <p className="empty-state-title">Нет заказов</p>
              <button
                onClick={() => navigate('/parts/orders/create')}
                className="mt-3 text-xs font-semibold text-primary hover:text-blue-700 transition-colors"
              >
                Создать первый заказ
              </button>
            </div>
          )}

          {/* Quick action */}
          <div className="flex-shrink-0 p-3 border-t border-gray-100">
            <button
              onClick={() => navigate('/parts/orders/create')}
              className="btn-primary w-full flex items-center justify-center gap-2 btn-sm"
            >
              <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
              Новый заказ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
