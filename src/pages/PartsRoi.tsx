import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Wallet,
  TrendingUp,
  Package,
  Coins,
  Car,
  Search,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
} from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { getVehicleRoi } from '@/services/partsService'
import { formatPrice } from '@/utils/currency'
import type { VehicleRoi } from '@/types/parts'

type Payback = 'paid' | 'progress' | 'loss' | 'nodata'
type Filter = 'all' | Payback
type Sort = 'profit' | 'payback' | 'invested'

/** Классификация окупаемости авто. */
function classify(r: VehicleRoi): Payback {
  if (r.investment_usd == null || r.investment_usd <= 0) return 'nodata'
  if (r.realized_usd >= r.investment_usd) return 'paid'
  if (r.realized_usd + r.stock_usd < r.investment_usd) return 'loss'
  return 'progress'
}

const PAYBACK_META: Record<Payback, { cls: string; Icon: typeof CheckCircle2 }> = {
  paid: { cls: 'text-emerald-700 bg-emerald-50 ring-emerald-100', Icon: CheckCircle2 },
  progress: { cls: 'text-amber-700 bg-amber-50 ring-amber-100', Icon: CircleDashed },
  loss: { cls: 'text-red-700 bg-red-50 ring-red-100', Icon: AlertTriangle },
  nodata: { cls: 'text-gray-500 bg-gray-50 ring-gray-100', Icon: CircleDashed },
}

export default function PartsRoi() {
  const { t } = useTranslation('cabinet')
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const { rate: globalRate } = usePartsExchangeRate()

  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('profit')
  const [search, setSearch] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['vehicle-roi', partsCompanyId, globalRate],
    staleTime: 1000 * 60 * 30,
    enabled: !!partsCompanyId,
    queryFn: () => getVehicleRoi(partsCompanyId!, globalRate),
  })

  // Сводка по всем авто (для KPI). Вложено — только там, где есть цена покупки.
  const totals = useMemo(() => {
    let invested = 0, realized = 0, stock = 0, paid = 0, withPrice = 0
    for (const r of data) {
      realized += r.realized_usd
      stock += r.stock_usd
      if (r.investment_usd != null && r.investment_usd > 0) {
        invested += r.investment_usd
        withPrice++
        if (classify(r) === 'paid') paid++
      }
    }
    return { invested, realized, stock, profit: realized - invested, paid, withPrice, count: data.length }
  }, [data])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = data
    if (filter !== 'all') list = list.filter((r) => classify(r) === filter)
    if (q) list = list.filter((r) => `${r.make} ${r.model} ${r.year ?? ''}`.toLowerCase().includes(q))
    const sorted = [...list]
    if (sort === 'profit') sorted.sort((a, b) => b.profit_usd - a.profit_usd)
    else if (sort === 'payback') sorted.sort((a, b) => (b.payback_pct ?? -1) - (a.payback_pct ?? -1))
    else sorted.sort((a, b) => (b.investment_usd ?? 0) - (a.investment_usd ?? 0))
    return sorted
  }, [data, filter, sort, search])

  if (!partsCompanyId) return <PartsAccessDenied />

  const subtitle = t('roiPage.subtitle', {
    count: totals.count,
    invested: formatPrice(totals.invested, 'USD'),
    realized: formatPrice(totals.realized, 'USD'),
  })

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader title={t('roiPage.title')} subtitle={subtitle} backPath="/parts/dashboard" />

      <div className="w-full py-5 sm:py-6">
        {/* ── KPI ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger-children">
          <Kpi icon={<Wallet className="w-5 h-5" strokeWidth={1.5} />} label={t('roiPage.kpiInvested')}
            value={formatPrice(totals.invested, 'USD')} hint={t('roiPage.kpiInvestedHint', { n: totals.withPrice })} />
          <Kpi icon={<Coins className="w-5 h-5" strokeWidth={1.5} />} label={t('roiPage.kpiRealized')}
            value={formatPrice(totals.realized, 'USD')} hint={t('roiPage.kpiPaidBack', { n: totals.paid })} />
          <Kpi icon={<Package className="w-5 h-5" strokeWidth={1.5} />} label={t('roiPage.kpiStock')}
            value={formatPrice(totals.stock, 'USD')} hint={t('roiPage.kpiStockHint')} />
          <Kpi icon={<TrendingUp className="w-5 h-5" strokeWidth={1.5} />} label={t('roiPage.kpiProfit')}
            value={`${totals.profit >= 0 ? '+' : ''}${formatPrice(totals.profit, 'USD')}`}
            valueClass={totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
            hint={t('roiPage.kpiProfitHint')} />
        </div>

        {/* ── Фильтры ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" strokeWidth={1.5} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('roiPage.searchPlaceholder')} className="form-input pl-9" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['all', 'paid', 'progress', 'loss'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}>
                {t(`roiPage.filter_${f}`)}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="form-select sm:w-44">
            <option value="profit">{t('roiPage.sortProfit')}</option>
            <option value="payback">{t('roiPage.sortPayback')}</option>
            <option value="invested">{t('roiPage.sortInvested')}</option>
          </select>
        </div>

        {/* ── Список ──────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : rows.length === 0 ? (
          <div className="cab-card p-4 text-center py-16">
            <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-500 font-medium">{t('roiPage.emptyTitle')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('roiPage.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((r) => <RoiRow key={r.vehicle_id} r={r} t={t} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, hint, valueClass }: {
  icon: React.ReactNode; label: string; value: string; hint: string; valueClass?: string
}) {
  return (
    <div className="cab-card p-4">
      <div className="icon-tile bg-slate-100 text-slate-700 mb-3">{icon}</div>
      <p className="kicker mb-1">{label}</p>
      <p className={`heading-2 tabular ${valueClass ?? ''}`} style={valueClass ? undefined : { color: 'var(--cab-ink)' }}>{value}</p>
      <p className="text-mobile-sm text-gray-500 mt-2">{hint}</p>
    </div>
  )
}

function RoiRow({ r, t }: { r: VehicleRoi; t: (k: string, o?: any) => string }) {
  const status = classify(r)
  const { cls, Icon } = PAYBACK_META[status]
  const inv = r.investment_usd ?? 0
  const realizedFrac = inv > 0 ? Math.min(r.realized_usd / inv, 1) : 0
  const stockFrac = inv > 0 ? Math.min(r.stock_usd / inv, Math.max(0, 1 - realizedFrac)) : 0

  return (
    <Link to={`/parts/vehicles/${r.vehicle_id}`}
      className="cab-card p-4 block hover:ring-1 hover:ring-primary/30 transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {r.make} {r.model} {r.year ? <span className="text-gray-400 font-normal">· {r.year}</span> : null}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('roiPage.partsLine', { sold: r.parts_sold, stock: r.parts_in_stock, total: r.parts_total })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-semibold ring-1 flex-shrink-0 ${cls}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          {r.payback_pct != null ? `${r.payback_pct}%` : t('roiPage.badgeNoData')}
        </span>
      </div>

      {/* Прогресс окупаемости: сплошной — вернулось, светлый — потенциал склада */}
      {inv > 0 ? (
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex mb-3" title={t('roiPage.barTitle')}>
          <div className={status === 'paid' ? 'bg-emerald-500/80' : 'bg-amber-400/80'} style={{ width: `${realizedFrac * 100}%` }} />
          <div className="bg-amber-300/40" style={{ width: `${stockFrac * 100}%` }} />
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3 italic">{t('roiPage.noPriceNote')}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        <Metric label={t('roiPage.invested')} value={formatPrice(r.investment_usd, 'USD')} />
        <Metric label={t('roiPage.realized')} value={formatPrice(r.realized_usd, 'USD')} />
        <Metric label={t('roiPage.stock')} value={formatPrice(r.stock_usd, 'USD')} />
        <Metric label={t('roiPage.profit')}
          value={`${r.profit_usd >= 0 ? '+' : ''}${formatPrice(r.profit_usd, 'USD')}`}
          valueClass={r.profit_usd >= 0 ? 'text-emerald-600' : 'text-red-600'} />
      </div>
    </Link>
  )
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-semibold tabular-nums truncate ${valueClass ?? 'text-gray-800'}`}>{value}</p>
    </div>
  )
}
