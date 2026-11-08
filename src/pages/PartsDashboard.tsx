import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useUserProfile, useHasAnyRole } from '@/hooks/useUserProfile'
import {
  ShoppingCart, Inbox, Tag, AlertTriangle, Package, Car, Truck, Search, Check,
  ChevronRight, Plus, CheckCircle2, Boxes, Wrench,
} from 'lucide-react'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import GlobalSearch from '@/components/GlobalSearch'
import { formatDate } from '@/utils/date'
import { intlLocale } from '@/i18n'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsDashboardStats, getRecentPartsOrders, type DashboardPeriod } from '@/services/partsService'
import { getShipments, type PartsShipment } from '@/services/shipmentsService'
import OnboardingChecklist from '@/components/parts/OnboardingChecklist'
import { QueryState } from '@/components/ui/QueryState'
import type { PartsOrderStatus } from '@/utils/status'

// ============================================================================
// ПУЛЬТ — экран «что сделать сейчас»: поиск, быстрые действия, «Нужно сделать»,
// справа «Склад сейчас» и последние продажи. Данные — getPartsDashboardStats (RPC).
// ============================================================================

// Строка недавнего заказа (форма supabase-select: parts_orders + join customer/items).
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

// НП: 14/102/103/108 — проблема/возврат.
const shipProblem = (s: PartsShipment) => ['14', '102', '103', '108'].includes(s.status_code || '')

export default function PartsDashboard() {
  const { t } = useTranslation('cabinet')
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  // Финансы (суммы) видят владелец и админ; рядовой работник — нет.
  const canSeeFinance = useHasAnyRole(['parts_owner', 'admin'])
  const { hasAnalytics } = useSubscriptionLimits()
  const [searchOpen, setSearchOpen] = useState(false)
  const period: DashboardPeriod = 'all' // ключ запроса прежний — инвалидации из других экранов работают
  const { rate: usdRate } = usePartsExchangeRate() // курс глобальный, обновляется кроном (read-only)

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['parts-dashboard-stats', partsCompanyId, period],
    queryFn: () => getPartsDashboardStats(partsCompanyId!, usdRate!, period),
    enabled: !!partsCompanyId && usdRate != null,
    staleTime: 5 * 60 * 1000,
  })

  const { data: shipments = [] } = useQuery({
    queryKey: ['parts-shipments', partsCompanyId],
    queryFn: () => getShipments(partsCompanyId!),
    enabled: !!partsCompanyId,
    staleTime: 5 * 60 * 1000,
  })
  const problemShipments = shipments.filter(shipProblem).length

  const { data: recentOrders, isLoading: recentLoading, isError: recentError, refetch: refetchRecent } = useQuery({
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

  const ink = 'var(--cab-ink)'
  const ink2 = 'var(--cab-ink-2)'
  const ink3 = 'var(--cab-ink-3)'

  // ── «Нужно сделать»: строки-задачи; нули — приглушённые с галочкой ──
  const todo = [
    { key: 'market',   count: stats?.marketOrders ?? 0,        label: t('dashboard.actMarket'),     Icon: Inbox,        to: '/parts/sales?tab=inbox' },
    { key: 'new',      count: stats?.orders?.new ?? 0,          label: t('dashboard.actNewOrders'),  Icon: ShoppingCart, to: '/parts/sales?tab=orders' },
    { key: 'assemble', count: stats?.orders?.assembling ?? 0 /* RPC уже включает in_progress */, label: t('dashboard.tdAssemble'), Icon: Wrench, to: '/parts/sales?tab=orders' },
    { key: 'problem',  count: problemShipments,                 label: t('dashboard.tdProblemShip'), Icon: Truck,        to: '/parts/sales?tab=shipments' },
    { key: 'noprice',  count: stats?.inventory?.needsFill ?? 0, label: t('dashboard.actNeedsFill'),  Icon: Tag,          to: '/parts/inventory?filter=noPrice' },
  ]
  const allDone = todo.every((a) => a.count === 0)
  const money = (v: number) => `$${Math.round(v).toLocaleString(intlLocale())}`

  return (
    <div className="space-y-4" style={{ color: ink }}>
      <h1 className="page-title">{t('dashboard.pultTitle')}</h1>

      {/* ── Поиск (открывает глобальный поиск кабинета) ───── */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="cab-card w-full flex items-center gap-2 px-3 h-11 text-left"
        style={{ color: ink3 }}
      >
        <Search className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-sm truncate">{t('dashboard.searchPlaceholder')}</span>
      </button>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── Быстрые действия ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => navigate('/parts/inventory/new')} className="cab-btn cab-btn-secondary cab-btn-lg justify-center px-2">
          <Plus className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> <span className="truncate">{t('dashboard.qaPart')}</span>
        </button>
        <button onClick={() => navigate('/parts/vehicles?new=1')} className="cab-btn cab-btn-secondary cab-btn-lg justify-center px-2">
          <Plus className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> <span className="truncate">{t('dashboard.qaVehicle')}</span>
        </button>
        <button onClick={() => navigate('/parts/orders/create')} className="cab-btn cab-btn-primary cab-btn-lg justify-center px-2">
          <Plus className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> <span className="truncate">{t('dashboard.qaSale')}</span>
        </button>
      </div>

      {statsError && !statsLoading && (
        <QueryState isError onRetry={() => { void refetchStats() }}>{null}</QueryState>
      )}

      {/* ── Чек-лист настройки (для новых компаний) ───────── */}
      <OnboardingChecklist partsCompanyId={partsCompanyId} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">

        {/* ── Нужно сделать ──────────────────────────────── */}
        <div className="cab-card overflow-hidden">
          <div className="px-4 h-12 flex items-center" style={{ borderBottom: '1px solid var(--cab-border)' }}>
            <p className="text-sm font-bold">{t('dashboard.todoTitle')}</p>
          </div>
          {statsLoading ? (
            <QueryState isLoading>{null}</QueryState>
          ) : allDone ? (
            <div className="px-4 py-5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--cab-success)' }} strokeWidth={1.5} />
              <p className="text-sm font-medium">{t('dashboard.allDone')}</p>
            </div>
          ) : (
            todo.map(({ key, count, label, Icon, to }, i) => {
              const zero = count === 0
              return (
                <Link key={key} to={to}
                  className="flex items-center gap-3 px-4 min-h-[48px] py-2 transition-colors hover:bg-[var(--cab-surface-2)]"
                  style={{ borderBottom: i < todo.length - 1 ? '1px solid var(--cab-border)' : undefined, opacity: zero ? 0.55 : 1 }}>
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: zero ? ink3 : 'var(--cab-signal)' }} strokeWidth={1.5} />
                  <span className="text-sm flex-1 min-w-0 truncate">{label}</span>
                  {zero ? (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: ink3 }}>
                      <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> {t('dashboard.allOk')}
                    </span>
                  ) : (
                    <span className="text-sm font-bold tabular-nums">{count}</span>
                  )}
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: ink3 }} strokeWidth={1.5} />
                </Link>
              )
            })
          )}
        </div>

        {/* ── Справа: склад + последние продажи ──────────── */}
        <div className="space-y-4">
          <div className="cab-card p-4">
            <p className="text-sm font-bold mb-3">{t('dashboard.stockNow')}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2" style={{ color: ink2 }}><Package className="w-4 h-4" strokeWidth={1.5} />{t('dashboard.inStock')}</dt>
                <dd className="font-bold tabular-nums">{stats?.inventory?.available ?? 0}</dd>
              </div>
              {canSeeFinance && (
                <div className="flex items-center justify-between gap-3">
                  <dt style={{ color: ink2 }}>{t('dashboard.stockValue')}</dt>
                  <dd className="font-bold tabular-nums">{money((stats?.inventory?.valueUSD ?? 0) + (usdRate ? (stats?.inventory?.valueUAH ?? 0) / usdRate : 0))}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="inline-flex items-center gap-2" style={{ color: ink2 }}><Car className="w-4 h-4" strokeWidth={1.5} />{t('dashboard.vehiclesInWork')}</dt>
                <dd className="font-bold tabular-nums">{stats?.vehicles?.in_progress ?? 0}</dd>
              </div>
            </dl>
            {hasAnalytics && canSeeFinance && (
              <Link to="/parts/analytics" className="mt-3 pt-3 flex items-center justify-between text-xs font-semibold"
                style={{ borderTop: '1px solid var(--cab-border)', color: 'var(--cab-signal)' }}>
                {t('dashboard.reports')} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            )}
          </div>

          <div className="cab-card overflow-hidden">
            <div className="flex items-center justify-between px-4 h-12" style={{ borderBottom: '1px solid var(--cab-border)' }}>
              <p className="text-sm font-bold">{t('dashboard.recentSales')}</p>
              <Link to="/parts/sales?tab=orders" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: 'var(--cab-signal)' }}>
                {t('dashboard.allOrders')} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            </div>
            {recentError ? (
              <QueryState isError onRetry={() => { void refetchRecent() }}>{null}</QueryState>
            ) : recentLoading ? (
              <QueryState isLoading>{null}</QueryState>
            ) : (recentOrders?.length ?? 0) === 0 ? (
              <div className="px-4 py-8 text-center">
                <Boxes className="w-7 h-7 mx-auto mb-2" style={{ color: ink3 }} strokeWidth={1.5} />
                <p className="text-sm" style={{ color: ink2 }}>{t('dashboard.noOrders')}</p>
              </div>
            ) : (
              recentOrders!.slice(0, 5).map((o, i, arr) => {
                const usd = computeOrderUSD(o)
                return (
                  <button key={o.id} onClick={() => navigate(`/parts/orders/${o.id}`)}
                    className="w-full flex items-center gap-3 px-4 min-h-[48px] py-2 text-left transition-colors hover:bg-[var(--cab-surface-2)]"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--cab-border)' : undefined }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{o.order_number}</p>
                      <p className="text-[11px] tabular-nums" style={{ color: ink3 }}>{formatDate(o.order_date)}</p>
                    </div>
                    {canSeeFinance && (
                      <span className="text-sm font-bold tabular-nums flex-shrink-0">{usd != null ? money(usd) : '—'}</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
