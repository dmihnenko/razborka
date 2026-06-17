import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  ShoppingCart, Inbox, Tag, AlertTriangle, DollarSign, Package, Car,
  ArrowRight, ChevronRight, Plus, CheckCircle2, Boxes,
} from 'lucide-react'
import { getPartsOrderStatusText } from '@/utils/status'
import { formatDate } from '@/utils/date'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsDashboardStats } from '@/services/partsService'
import { supabase } from '@/lib/supabase'
import ExchangeRateWidget from '@/components/parts/ExchangeRateWidget'

// ============================================================================
// ПУЛЬТ — операционный дашборд кабинета разборки («Ink & Signal»).
// Сверху «Требует действия» (очередь дел, гаснет при нуле), затем деньги/итоги,
// воронка заказов и последние заказы. Данные — getPartsDashboardStats (RPC).
// ============================================================================

const STATUS_CHIP: Record<string, { bg: string; color: string }> = {
  new:         { bg: 'var(--cab-signal-weak)', color: 'var(--cab-signal)' },
  in_progress: { bg: '#FEF3C7', color: '#B45309' },
  completed:   { bg: '#DCFCE7', color: '#15803D' },
  cancelled:   { bg: '#F3F4F6', color: '#6B7280' },
}

function StatusChip({ status }: { status: string }) {
  const s = STATUS_CHIP[status] ?? STATUS_CHIP.cancelled
  return (
    <span className="cab-chip" style={{ background: s.bg, color: s.color, borderColor: 'transparent' }}>
      {getPartsOrderStatusText(status)}
    </span>
  )
}

export default function PartsDashboard() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { rate: usdRate, isStale: rateStale } = usePartsExchangeRate()

  const { data: stats } = useQuery({
    queryKey: ['parts-dashboard-stats', partsCompanyId],
    queryFn: () => getPartsDashboardStats(partsCompanyId!, usdRate || 41),
    enabled: !!partsCompanyId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: recentOrders } = useQuery({
    queryKey: ['parts-recent-activity', partsCompanyId],
    queryFn: async () => {
      if (!partsCompanyId) return []
      const { data } = await supabase
        .from('parts_orders')
        .select(`
          id, order_number, order_date, status, total_amount, exchange_rate_at_sale,
          customer:parts_customers(full_name),
          items:parts_order_items(price_at_sale, quantity, price_at_sale_currency)
        `)
        .eq('parts_company_id', partsCompanyId)
        .order('order_date', { ascending: false })
        .limit(6)
      return data || []
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

  if (!partsCompanyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="empty-state">
          <div className="empty-state-icon"><AlertTriangle className="w-7 h-7 text-orange-500" strokeWidth={1.5} /></div>
          <p className="empty-state-title">Нет доступа к разборке</p>
          <p className="empty-state-text">Обратитесь к администратору</p>
        </div>
      </div>
    )
  }

  // ── Очередь дел ──────────────────────────────────────────────
  const actions = [
    { key: 'new-orders', count: stats?.orders?.new ?? 0,     label: 'Новые заказы',    Icon: ShoppingCart, to: '/parts/orders' },
    { key: 'market',     count: stats?.marketOrders ?? 0,    label: 'Заявки с маркета', Icon: Inbox,        to: '/parts/market-orders' },
    { key: 'no-price',   count: stats?.inventory?.noPrice ?? 0, label: 'Запчасти без цены', Icon: Tag,      to: '/parts/inventory/no-price' },
    { key: 'low-stock',  count: stats?.inventory?.lowStock ?? 0, label: 'Мало на складе',  Icon: AlertTriangle, to: '/parts/inventory?source=vehicles' },
  ].filter(a => a.count > 0)

  // Курс нужно обновить, если он не на сегодня и уже утро (≥9:00)
  const rateNeedsUpdate = rateStale && new Date().getHours() >= 9

  const ink = 'var(--cab-ink)'
  const ink2 = 'var(--cab-ink-2)'
  const ink3 = 'var(--cab-ink-3)'

  const kpis = [
    { label: 'Выручка',  value: (stats?.revenueUSD ?? 0) > 0 ? `$${Math.round(stats!.revenueUSD).toLocaleString('ru-RU')}` : '—', sub: `${stats?.orders?.completed ?? 0} завершено`, Icon: DollarSign, to: '/parts/analytics' },
    { label: 'Заказов',  value: stats?.orders?.total ?? 0, sub: `${stats?.orders?.in_progress ?? 0} в работе`, Icon: ShoppingCart, to: '/parts/orders' },
    { label: 'Запчасти', value: stats?.inventory?.total ?? 0, sub: `${stats?.inventory?.available ?? 0} в наличии`, Icon: Package, to: '/parts/inventory?source=vehicles' },
    { label: 'Авто',     value: stats?.vehicles?.total ?? 0, sub: `${stats?.vehicles?.dismantled ?? 0} разобрано`, Icon: Car, to: '/parts/vehicles' },
  ]

  return (
    <div className="space-y-5" style={{ color: ink }}>

      {/* ── Шапка ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: ink3 }}>Авторазборка</p>
          <h1 className="page-title mt-0.5">Пульт</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/parts/vehicles')} className="cab-btn cab-btn-secondary cab-btn-sm hidden sm:inline-flex">
            <Car className="w-4 h-4" strokeWidth={1.5} /> Авто
          </button>
          <button onClick={() => navigate('/parts/orders/create')} className="cab-btn cab-btn-primary cab-btn-sm">
            <Plus className="w-4 h-4" strokeWidth={2} /> Новый заказ
          </button>
        </div>
      </div>

      {/* ── Требует действия ──────────────────────────────── */}
      {(actions.length > 0 || rateNeedsUpdate) ? (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: ink3 }}>Требует действия</p>

          {/* Напоминание обновить курс — отдельно от карточек-действий */}
          <ExchangeRateWidget />

          {actions.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {actions.map(({ key, count, label, Icon, to }) => (
              <Link key={key} to={to} className="cab-card cab-card-hover p-4 flex items-center gap-3 group">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)' }}>
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color: ink }}>{count}</p>
                  <p className="text-xs mt-1 truncate" style={{ color: ink2 }}>{label}</p>
                </div>
                <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--cab-signal)' }} strokeWidth={1.5} />
              </Link>
            ))}
          </div>
          )}
        </div>
      ) : (
        <div className="cab-card p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#DCFCE7', color: '#15803D' }}>
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-sm font-bold" style={{ color: ink }}>Всё под контролем</p>
            <p className="text-xs mt-0.5" style={{ color: ink2 }}>Новых задач нет — заказы обработаны, склад в порядке.</p>
          </div>
        </div>
      )}

      {/* ── Деньги / итоги ────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, sub, Icon, to }) => (
          <Link key={label} to={to} className="cab-card cab-card-hover p-4 group">
            <div className="flex items-center justify-between mb-2.5">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--cab-surface-2)', color: ink }}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: ink3 }} strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: ink }}>{value}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs font-medium" style={{ color: ink2 }}>{label}</p>
              <p className="text-[11px] tabular-nums" style={{ color: ink3 }}>{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Воронка + последние заказы ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Последние заказы */}
        <div className="cab-card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-4 h-12" style={{ borderBottom: '1px solid var(--cab-border)' }}>
            <p className="text-sm font-bold" style={{ color: ink }}>Последние заказы</p>
            <Link to="/parts/orders" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--cab-signal)' }}>
              Все заказы <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          {(recentOrders?.length ?? 0) === 0 ? (
            <div className="px-4 py-10 text-center">
              <Boxes className="w-8 h-8 mx-auto mb-2" style={{ color: ink3 }} strokeWidth={1.5} />
              <p className="text-sm font-medium" style={{ color: ink2 }}>Заказов пока нет</p>
            </div>
          ) : (
            <div>
              {recentOrders!.map((o: any) => {
                const usd = computeOrderUSD(o)
                return (
                  <button key={o.id} onClick={() => navigate(`/parts/orders/${o.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--cab-surface-2)]"
                    style={{ borderBottom: '1px solid var(--cab-border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: ink }}>
                        {o.order_number}
                        <span className="font-normal ml-2" style={{ color: ink3 }}>
                          {(o.customer as any)?.full_name || 'Без клиента'}
                        </span>
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: ink3 }}>{formatDate(o.order_date)}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: ink }}>
                      {usd != null ? `$${Math.round(usd).toLocaleString('ru-RU')}` : '—'}
                    </span>
                    <StatusChip status={o.status} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Воронка заказов */}
        <div className="cab-card p-4">
          <p className="text-sm font-bold mb-3" style={{ color: ink }}>Воронка заказов</p>
          <div className="space-y-2.5">
            {[
              { label: 'Новые',     value: stats?.orders?.new ?? 0,         color: 'var(--cab-signal)' },
              { label: 'В работе',  value: stats?.orders?.in_progress ?? 0, color: '#B45309' },
              { label: 'Завершены', value: stats?.orders?.completed ?? 0,   color: '#15803D' },
            ].map(({ label, value, color }) => {
              const total = stats?.orders?.total || 1
              const pct = Math.round((value / total) * 100)
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: ink2 }}>{label}</span>
                    <span className="font-bold tabular-nums" style={{ color: ink }}>{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--cab-surface-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <Link to="/parts/customers" className="mt-4 pt-3 flex items-center justify-between text-xs"
            style={{ borderTop: '1px solid var(--cab-border)' }}>
            <span style={{ color: ink2 }}>Клиентов</span>
            <span className="font-bold tabular-nums inline-flex items-center gap-1" style={{ color: ink }}>
              {stats?.customers?.total ?? 0} <ChevronRight className="w-3.5 h-3.5" style={{ color: ink3 }} strokeWidth={1.5} />
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
