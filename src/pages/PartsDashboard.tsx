import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useUserProfile, useHasAnyRole } from '@/hooks/useUserProfile'
import {
  ShoppingCart, Inbox, Tag, AlertTriangle, DollarSign, Package, Car,
  ArrowRight, ChevronRight, Plus, CheckCircle2, Boxes, Truck, Wallet,
} from 'lucide-react'
import { getPartsOrderStatusText, statusBadgeClass } from '@/utils/status'
import type { PartsOrderStatus } from '@/utils/status'
import { formatDate } from '@/utils/date'
import { intlLocale } from '@/i18n'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsDashboardStats, getRecentPartsOrders, type DashboardPeriod } from '@/services/partsService'
import { getShipments, type PartsShipment } from '@/services/shipmentsService'
import OnboardingChecklist from '@/components/parts/OnboardingChecklist'
import { QueryState } from '@/components/ui/QueryState'


// ============================================================================
// ПУЛЬТ — операционный дашборд кабинета разборки («Ink & Signal»).
// Сверху «Требует действия» (очередь дел, гаснет при нуле), затем деньги/итоги,
// воронка заказов и последние заказы. Данные — getPartsDashboardStats (RPC).
// ============================================================================

// Строка недавнего заказа (форма supabase-select ниже: parts_orders + join customer/items).
interface RecentOrderItem {
  price_at_sale: number | null
  quantity: number | null
  price_at_sale_currency?: 'UAH' | 'USD' | null
}
interface RecentOrderRow {
  id: string
  order_number: string
  order_date: string
  status: PartsOrderStatus
  total_amount: number
  exchange_rate_at_sale: number | null
  customer: { full_name: string | null } | null
  items: RecentOrderItem[]
}

function StatusChip({ status }: { status: PartsOrderStatus }) {
  return (
    <span className={statusBadgeClass(status)}>
      {getPartsOrderStatusText(status)}
    </span>
  )
}

// НП: 9/10/11 — доставлено/получено; 14/102/103/108 — проблема/возврат; остальное — в пути.
const shipDelivered = (s: PartsShipment) => ['9', '10', '11'].includes(s.status_code || '')
const shipProblem = (s: PartsShipment) => ['14', '102', '103', '108'].includes(s.status_code || '')

export default function PartsDashboard() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  // Финансы (выручка/прибыль) видят владелец и админ; рядовой работник — нет.
  const canSeeFinance = useHasAnyRole(['parts_owner', 'admin'])
  // Период для финансовых метрик (выручка). Операционные счётчики — всегда текущее состояние.
  const [period, setPeriod] = useState<DashboardPeriod>('all')
  const { rate: usdRate } = usePartsExchangeRate() // курс глобальный, обновляется кроном (read-only)

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    // usdRate убран из ключа (передаётся в queryFn) — иначе каждое обновление курса
    // плодило новую кэш-запись; курс глобальный, меняется кроном 2×/сутки.
    queryKey: ['parts-dashboard-stats', partsCompanyId, period],
    queryFn: () => getPartsDashboardStats(partsCompanyId!, usdRate!, period),
    enabled: !!partsCompanyId && usdRate != null,
    staleTime: 5 * 60 * 1000,
  })

  // Доставка — агрегат активных/проблемных/доставленных ТТН для блока на дашборде
  const { data: shipments = [] } = useQuery({
    queryKey: ['parts-shipments', partsCompanyId],
    queryFn: () => getShipments(partsCompanyId!),
    enabled: !!partsCompanyId,
    staleTime: 5 * 60 * 1000,
  })
  const delivery = {
    active: shipments.filter((s) => !shipDelivered(s) && !shipProblem(s)).length,
    problem: shipments.filter(shipProblem).length,
    delivered: shipments.filter(shipDelivered).length,
  }

  const { data: recentOrders } = useQuery({
    queryKey: ['parts-recent-activity', partsCompanyId],
    queryFn: () => getRecentPartsOrders(partsCompanyId!),
    enabled: !!partsCompanyId,
  })

  const computeOrderUSD = (order: RecentOrderRow): number | null => {
    if (!order.items || order.items.length === 0) return null
    const rate = order.exchange_rate_at_sale || usdRate
    if (!rate) return null
    return order.items.reduce((sum: number, item: RecentOrderItem) => {
      const amount = (item.price_at_sale ?? 0) * (item.quantity ?? 1)
      return sum + (item.price_at_sale_currency === 'USD' ? amount : amount / rate)
    }, 0)
  }

  if (!partsCompanyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="empty-state">
          <div className="empty-state-icon"><AlertTriangle className="w-7 h-7 text-orange-500" strokeWidth={1.5} /></div>
          <p className="empty-state-title">{t('dashboard.noAccess')}</p>
          <p className="empty-state-text">{t('dashboard.contactAdmin')}</p>
        </div>
      </div>
    )
  }

  // ── Очередь дел ──────────────────────────────────────────────
  const actions = [
    { key: 'new-orders', count: stats?.orders?.new ?? 0,     label: t('dashboard.actNewOrders'),    Icon: ShoppingCart, to: '/parts/orders' },
    { key: 'market',     count: stats?.marketOrders ?? 0,    label: t('dashboard.actMarket'), Icon: Inbox,        to: '/parts/market-orders' },
    { key: 'needs-fill', count: stats?.inventory?.needsFill ?? 0, label: t('dashboard.actNeedsFill'), Icon: Tag,    to: '/parts/inventory/no-price' },
    { key: 'low-stock',  count: stats?.inventory?.lowStock ?? 0, label: t('dashboard.actLowStock'),  Icon: AlertTriangle, to: '/parts/inventory?source=vehicles' },
  ].filter(a => a.count > 0)

  const ink = 'var(--cab-ink)'
  const ink2 = 'var(--cab-ink-2)'
  const ink3 = 'var(--cab-ink-3)'

  // Финансовые KPI — владельцу/админу выручка + прибыль; работнику «Доставка в пути».
  const moneyKpis = canSeeFinance
    ? [
        { label: t('dashboard.kpiRevenue'), value: (stats?.revenueUSD ?? 0) > 0 ? `$${Math.round(stats!.revenueUSD).toLocaleString(intlLocale())}` : '—', sub: t('dashboard.kpiCompleted', { n: stats?.revenueOrders ?? stats?.orders?.completed ?? 0 }), Icon: DollarSign, to: '/parts/analytics' },
        { label: t('dashboard.kpiProfit'), value: (stats?.profitUSD ?? 0) !== 0 ? `$${Math.round(stats!.profitUSD!).toLocaleString(intlLocale())}` : '—', sub: t('dashboard.kpiProfitItems', { n: stats?.profitItems ?? 0 }), Icon: Wallet, to: '/parts/analytics' },
      ]
    : [
        { label: t('dashboard.kpiDelivery'), value: delivery.active, sub: t('dashboard.kpiDelivered', { n: delivery.delivered }), Icon: Truck, to: '/parts/shipments' },
      ]
  const kpis = [
    ...moneyKpis,
    { label: t('dashboard.kpiOrders'),  value: stats?.orders?.total ?? 0, sub: t('dashboard.kpiInProgress', { n: (stats?.orders?.assembling ?? 0) + (stats?.orders?.shipped ?? 0) + (stats?.orders?.in_progress ?? 0) }), Icon: ShoppingCart, to: '/parts/orders' },
    { label: t('dashboard.kpiParts'), value: stats?.inventory?.total ?? 0, sub: t('dashboard.kpiAvailable', { n: stats?.inventory?.available ?? 0 }), Icon: Package, to: '/parts/inventory?source=vehicles' },
    { label: t('dashboard.kpiVehicles'),     value: stats?.vehicles?.total ?? 0, sub: t('dashboard.kpiDismantled', { n: stats?.vehicles?.dismantled ?? 0 }), Icon: Car, to: '/parts/vehicles' },
  ]
  const kpiGridCls = canSeeFinance ? 'grid grid-cols-2 lg:grid-cols-5 gap-3' : 'grid grid-cols-2 lg:grid-cols-4 gap-3'

  return (
    <div className="space-y-5" style={{ color: ink }}>

      {/* ── Шапка ─────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="kicker" style={{ color: ink3 }}>{t('dashboard.kicker')}</p>
          <h1 className="page-title mt-0.5">{t('dashboard.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Курс — read-only (обновляется автоматически кроном) */}
          <span className="cab-btn cab-btn-secondary cab-btn-sm cursor-default" title={t('dashboard.updateRate')}>
            <DollarSign className="w-4 h-4" strokeWidth={1.5} />
            <span className="tabular-nums">{usdRate != null ? `${usdRate} ₴/$` : '—'}</span>
          </span>
          <button onClick={() => navigate('/parts/vehicles')} className="cab-btn cab-btn-secondary cab-btn-sm hidden sm:inline-flex">
            <Car className="w-4 h-4" strokeWidth={1.5} /> {t('dashboard.vehicles')}
          </button>
          <button onClick={() => navigate('/parts/orders/create')} className="cab-btn cab-btn-primary cab-btn-sm">
            <Plus className="w-4 h-4" strokeWidth={2} /> {t('dashboard.newOrder')}
          </button>
        </div>
      </div>

      {/* Ошибка загрузки статистики — видимое состояние с «Повторить» вместо тихих нулей */}
      {statsError && !statsLoading && (
        <QueryState isError onRetry={() => { void refetchStats() }}>{null}</QueryState>
      )}

      {/* ── Чек-лист настройки разборки (категории, авто, фото, Telegram и т.д.) ─ */}
      {partsCompanyId && <OnboardingChecklist partsCompanyId={partsCompanyId} />}

      {/* ── Требует действия ──────────────────────────────── */}
      {actions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: ink3 }}>{t('dashboard.needsAction')}</p>

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
          <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-sm font-bold" style={{ color: ink }}>{t('dashboard.allGoodTitle')}</p>
            <p className="text-xs mt-0.5" style={{ color: ink2 }}>{t('dashboard.allGoodText')}</p>
          </div>
        </div>
      )}

      {/* ── Период (для финансовых метрик) ─────────────────── */}
      {canSeeFinance && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="kicker" style={{ color: ink3 }}>{t('dashboard.results')}</p>
          <div className="inline-flex rounded-lg p-0.5" style={{ background: 'var(--cab-surface-2)' }}>
            {(['today', '7d', 'month', 'all'] as DashboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
                style={period === p
                  ? { background: 'var(--cab-surface)', color: ink, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                  : { color: ink3 }}
              >
                {t(`dashboard.period_${p}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Деньги / итоги ────────────────────────────────── */}
      <div className={kpiGridCls}>
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
            <p className="text-sm font-bold" style={{ color: ink }}>{t('dashboard.recentOrders')}</p>
            <Link to="/parts/orders" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--cab-signal)' }}>
              {t('dashboard.allOrders')} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </Link>
          </div>
          {(recentOrders?.length ?? 0) === 0 ? (
            <div className="px-4 py-10 text-center">
              <Boxes className="w-8 h-8 mx-auto mb-2" style={{ color: ink3 }} strokeWidth={1.5} />
              <p className="text-sm font-medium" style={{ color: ink2 }}>{t('dashboard.noOrders')}</p>
            </div>
          ) : (
            <div>
              {recentOrders!.map((o) => {
                const usd = computeOrderUSD(o)
                return (
                  <button key={o.id} onClick={() => navigate(`/parts/orders/${o.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--cab-surface-2)]"
                    style={{ borderBottom: '1px solid var(--cab-border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: ink }}>
                        {o.order_number}
                        <span className="font-normal ml-2" style={{ color: ink3 }}>
                          {o.customer?.full_name || t('dashboard.noCustomer')}
                        </span>
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: ink3 }}>{formatDate(o.order_date)}</p>
                    </div>
                    {canSeeFinance && (
                      <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: ink }}>
                        {usd != null ? `$${Math.round(usd).toLocaleString(intlLocale())}` : '—'}
                      </span>
                    )}
                    <StatusChip status={o.status} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Правая колонка: воронка + доставка */}
        <div className="space-y-4">
        {/* Воронка заказов */}
        <div className="cab-card p-4">
          <p className="text-sm font-bold mb-3" style={{ color: ink }}>{t('dashboard.funnel')}</p>
          <div className="space-y-2.5">
            {[
              { label: t('dashboard.fNew'),        value: stats?.orders?.new ?? 0,        color: 'var(--cab-signal)' },
              { label: t('dashboard.fAssembling'),  value: stats?.orders?.assembling ?? 0, color: 'var(--cab-warning)' },
              { label: t('dashboard.fShipped'),     value: stats?.orders?.shipped ?? 0,    color: 'var(--cab-signal)' },
              { label: t('dashboard.fCompleted'),   value: stats?.orders?.completed ?? 0,  color: 'var(--cab-success)' },
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
            <span style={{ color: ink2 }}>{t('dashboard.customers')}</span>
            <span className="font-bold tabular-nums inline-flex items-center gap-1" style={{ color: ink }}>
              {stats?.customers?.total ?? 0} <ChevronRight className="w-3.5 h-3.5" style={{ color: ink3 }} strokeWidth={1.5} />
            </span>
          </Link>
        </div>

        {/* Доставка (Новая Почта) */}
        <Link to="/parts/shipments" className="cab-card cab-card-hover p-4 block group">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-2 text-sm font-bold" style={{ color: ink }}>
              <Truck className="w-4 h-4" strokeWidth={1.5} /> {t('dashboard.delivery')}
            </span>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--cab-signal)' }} strokeWidth={1.5} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--cab-signal)' }}>{delivery.active}</p>
              <p className="text-[11px] mt-1" style={{ color: ink2 }}>{t('dashboard.delInTransit')}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color: delivery.problem > 0 ? 'var(--cab-danger)' : ink3 }}>{delivery.problem}</p>
              <p className="text-[11px] mt-1" style={{ color: ink2 }}>{t('dashboard.delProblem')}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--cab-success)' }}>{delivery.delivered}</p>
              <p className="text-[11px] mt-1" style={{ color: ink2 }}>{t('dashboard.delDelivered')}</p>
            </div>
          </div>
        </Link>
        </div>
      </div>
    </div>
  )
}
