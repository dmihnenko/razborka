import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { formatPrice } from '@/utils/currency'
import { getPartsAnalytics } from '@/services/partsService'
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
import i18n from '@/i18n'

export default function PartsAnalytics() {
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { rate: globalRate } = usePartsExchangeRate()
  const { hasAnalytics } = useSubscriptionLimits()

  const { data } = useQuery({
    queryKey: ['parts-analytics', partsCompanyId, globalRate],
    staleTime: 1000 * 60 * 30,
    queryFn: () => getPartsAnalytics(partsCompanyId!, globalRate!),
    enabled: !!partsCompanyId && globalRate != null,
  })

  // Transform server monthly array → [label, {revenue, orders}][] for the chart
  const monthlyRevenue: [string, { revenue: number; orders: number }][] = (data?.monthly ?? []).map(
    (m: { month: string; revenue: number; orders: number }) => [
      new Date(m.month + '-01').toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
      { revenue: m.revenue, orders: m.orders },
    ]
  )

  const topParts: { name: string; sold_quantity: number; revenue: number }[] = data?.topParts ?? []

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title={i18n.t('cabinet:pages.analytics')}
        subtitle={i18n.t('cabinet:pages.analyticsSub')}
        backPath="/parts/dashboard"
      />

      {/* Content */}
      <div className={`w-full py-6 relative${!hasAnalytics ? ' select-none' : ''}`}>

        {/* ── Paywall overlay ─────────────────────────────────── */}
        {!hasAnalytics && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 py-20 pointer-events-none">
            <div className="pointer-events-auto max-w-sm w-full cab-card p-8 flex flex-col items-center text-center gap-5 animate-fade-in">
              <div className="icon-tile-lg bg-primary/10">
                <Lock className="w-6 h-6 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="page-title text-lg">{t('analyticsPage.paywallTitle')}</p>
                <p className="page-subtitle mt-2">
                  {t('analyticsPage.paywallTextBefore')}{' '}
                  <span className="font-semibold text-gray-700">{t('analyticsPage.paywallPlan')}</span> {t('analyticsPage.paywallTextAfter')}
                </p>
              </div>
              <Link to="/parts/subscription" className="cab-btn cab-btn-primary w-full text-center justify-center">
                {t('analyticsPage.openAnalytics')}
              </Link>
            </div>
          </div>
        )}

        {/* ── Analytics content (blurred preview when !hasAnalytics) ── */}
        <div className={!hasAnalytics ? 'blur-sm pointer-events-none' : ''}>

          {/* ── Primary KPI row ──────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 sm:mb-6 stagger-children">

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-slate-100 text-slate-700">
                  <TrendingUp className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">{t('analyticsPage.totalRevenue')}</p>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>
                {formatPrice(data?.totalRevenue ?? 0, 'USD')}
              </p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                {t('analyticsPage.completedOrders', { n: data?.completedOrders ?? 0 })}
              </p>
            </div>

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-slate-100 text-slate-700">
                  <BarChart3 className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">{t('analyticsPage.avgCheck')}</p>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>
                {formatPrice(data?.avgCheck ?? 0, 'USD')}
              </p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                {t('analyticsPage.basedOnOrders', { n: data?.completedOrders ?? 0 })}
              </p>
            </div>

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-slate-100 text-slate-700">
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">{t('analyticsPage.soldParts')}</p>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>{data?.totalSoldParts ?? 0}</p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                {t('analyticsPage.inventoryLabel')} {formatPrice(data?.inventoryValue ?? 0, 'USD')}
              </p>
            </div>

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="icon-tile bg-slate-100 text-slate-700">
                  <Calendar className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kicker mb-1">{t('analyticsPage.dismantledVehicles')}</p>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>{data?.dismantledVehicles ?? 0}</p>
              <p className="text-mobile-sm text-gray-500 mt-2">
                {t('analyticsPage.outOfTotal', { n: data?.totalVehicles ?? 0 })}
              </p>
            </div>
          </div>

          {/* ── Маржа склада ─────────────────────────────────── */}
          {(data?.potentialMargin ?? 0) !== 0 && (
            <div className="cab-card p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="icon-tile bg-slate-100 text-slate-700 flex-shrink-0">
                <TrendingUp className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="kicker mb-0.5">{t('analyticsPage.potentialMargin')}</p>
                <p className="text-mobile-sm text-gray-500">
                  {t('analyticsPage.potentialMarginHint')}
                </p>
              </div>
              <p className={`heading-2 tabular flex-shrink-0 ${(data?.potentialMargin ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(data?.potentialMargin ?? 0) >= 0 ? '+' : ''}
                {formatPrice(data?.potentialMargin ?? 0, 'USD')}
              </p>
            </div>
          )}

          {/* ── Charts row ────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

            {/* Monthly Revenue Chart */}
            <div className="cab-card p-4">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="kicker mb-1">{t('analyticsPage.dynamicsKicker')}</p>
                  <h2 className="heading-3">{t('analyticsPage.revenueByMonth')}</h2>
                </div>
                <div className="icon-tile bg-slate-100 text-slate-700">
                  <BarChart3 className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>

              {monthlyRevenue.length > 0 ? (
                <div className="flex items-end justify-between gap-1 h-44">
                  {monthlyRevenue.map(([month, mdata]) => {
                    const maxRevenue = Math.max(...monthlyRevenue.map(([, d]) => d.revenue))
                    const heightPercent = maxRevenue > 0 ? (mdata.revenue / maxRevenue) * 100 : 0

                    return (
                      <div key={month} className="flex flex-col items-center gap-1 flex-1 min-w-0 group">
                        <span className="text-[var(--fs-2xs)] font-semibold text-gray-500 whitespace-nowrap tabular-nums leading-none">
                          {mdata.revenue > 0 ? formatPrice(mdata.revenue, 'USD') : ''}
                        </span>
                        <div className="w-full flex items-end" style={{ height: '120px' }}>
                          <div
                            className="w-full bg-primary hover:bg-primary/80 rounded-t transition-colors cursor-default"
                            style={{ height: `${Math.max(heightPercent, 4)}%` }}
                            title={`${month}: ${formatPrice(mdata.revenue, 'USD')} · ${t('analyticsPage.ordersShort', { n: mdata.orders })}`}
                          />
                        </div>
                        <span className="text-xs text-gray-500 leading-none truncate w-full text-center">{month.replace(' г.', '')}</span>
                        <span className="kicker leading-none whitespace-nowrap">{t('analyticsPage.ordersShort', { n: mdata.orders })}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <BarChart3 className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <p className="empty-state-title">{t('analyticsPage.noSalesData')}</p>
                  <p className="empty-state-text">{t('analyticsPage.noSalesDataHint')}</p>
                </div>
              )}
            </div>

            {/* Top Parts */}
            <div className="cab-card p-4">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="kicker mb-1">{t('analyticsPage.ratingKicker')}</p>
                  <h2 className="heading-3">{t('analyticsPage.topParts')}</h2>
                </div>
                <div className="icon-tile bg-slate-100 text-slate-700">
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>

              {topParts.length > 0 ? (
                <div className="grid-hairline">
                  {topParts.map((part, index) => (
                    <div key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-slate-700">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{part.name}</p>
                        <p className="text-mobile-sm text-gray-500">{t('analyticsPage.soldQty', { n: part.sold_quantity })}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900 tabular">
                          {formatPrice(part.revenue, 'USD')}
                        </p>
                        <p className="text-mobile-sm text-gray-500 tabular">
                          {formatPrice(part.sold_quantity > 0 ? part.revenue / part.sold_quantity : 0, 'USD')}{t('analyticsPage.perPiece')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <Package className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <p className="empty-state-title">{t('analyticsPage.noSoldParts')}</p>
                  <p className="empty-state-text">{t('analyticsPage.noSoldPartsHint')}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Secondary KPI row ────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 sm:mt-6 stagger-children">

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">{t('analyticsPage.totalOrders')}</p>
                <ShoppingCart className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>{data?.totalOrders ?? 0}</p>
            </div>

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">{t('analyticsPage.completionRate')}</p>
                <TrendingUp className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>
                {data?.totalOrders
                  ? Math.round(((data.completedOrders ?? 0) / data.totalOrders) * 100)
                  : 0}
                %
              </p>
            </div>

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">{t('analyticsPage.avgPrice')}</p>
                <Package className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>
                {data?.totalSoldParts && data?.totalRevenue
                  ? formatPrice(data.totalRevenue / data.totalSoldParts, 'USD')
                  : '$0'}
              </p>
            </div>

            <div className="cab-card p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="kicker">{t('analyticsPage.dismantlingProgress')}</p>
                <Car className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
              </div>
              <p className="heading-2 tabular" style={{ color: 'var(--cab-ink)' }}>
                {data?.totalVehicles
                  ? Math.round(((data.dismantledVehicles ?? 0) / data.totalVehicles) * 100)
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
