import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, MapPin, Search, Store } from 'lucide-react'
import { getMarketSuppliers } from '@/services/marketplaceService'
import { SupplierCard, pluralizeParts } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// /market/suppliers — список разборок (Graphite)
// ============================================================================

const CITY_KEY = 'tsp_market_supplier_city'

export function MarketSuppliers() {
  const { t } = useTranslation('market')
  const [search, setSearch] = useState('')
  const [city, setCityState] = useState<string>(() => {
    try { return localStorage.getItem(CITY_KEY) || '' } catch { return '' }
  })
  const setCity = (v: string) => {
    setCityState(v)
    try { v ? localStorage.setItem(CITY_KEY, v) : localStorage.removeItem(CITY_KEY) } catch { /* ignore */ }
  }

  const { data: suppliers, isLoading, isError } = useQuery({
    queryKey: ['market', 'suppliers'], queryFn: getMarketSuppliers, staleTime: 5 * 60 * 1000,
  })

  // Список городов (по разборкам с указанным городом)
  const cities = useMemo(() => {
    const set = new Set<string>()
    ;(suppliers ?? []).forEach(s => { const c = s.city?.trim(); if (c) set.add(c) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
  }, [suppliers])

  // Выбранного города уже нет в данных → сбрасываем
  const activeCity = city && cities.includes(city) ? city : ''

  const filtered = useMemo(() => {
    let list = suppliers ?? []
    if (activeCity) list = list.filter(s => (s.city ?? '').trim() === activeCity)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.address ?? '').toLowerCase().includes(q) ||
      (s.city ?? '').toLowerCase().includes(q)
    )
    return list
  }, [suppliers, search, activeCity])

  const hasFilter = !!search.trim() || !!activeCity

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 rounded-xl w-32" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="h-11 rounded-xl max-w-md" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="mk-grid-wide">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="mk-card h-24" aria-hidden="true" />)}</div>
      </div>
    )
  }

  if (isError) {
    return <EmptyState icon={AlertCircle} title={t('suppliersPage.errorTitle')} description={t('suppliersPage.errorDesc')} />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="mk-h1">{t('suppliersPage.title')}</h1>
          <p className="mk-sub mt-1" aria-live="polite">
            {hasFilter
              ? t('suppliersPage.found', { n: filtered.length, total: suppliers?.length ?? 0 })
              : t('suppliersPage.total', { n: suppliers?.length ?? 0 })}
            {activeCity && <span> · {activeCity}</span>}
          </p>
        </div>
        {!hasFilter && suppliers && suppliers.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold self-start sm:self-auto" style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}>
            <Store className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
            {pluralizeParts(suppliers.reduce((s, x) => s + x.availableParts, 0))} {t('suppliersPage.inStock')}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('suppliersPage.searchPlaceholder')} className="mk-input mk-search" aria-label={t('suppliersPage.searchAria')}
          />
        </div>
        {cities.length > 0 && (
          <div className="relative sm:w-56">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" strokeWidth={1.5} aria-hidden="true" />
            <select
              value={activeCity}
              onChange={e => setCity(e.target.value)}
              className="mk-input pl-10 appearance-none cursor-pointer"
              aria-label={t('suppliersPage.cityFilterAria')}
            >
              <option value="">{t('suppliersPage.allCities')}</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title={hasFilter ? t('suppliersPage.emptyFilteredTitle') : t('suppliersPage.emptyTitle')}
          description={hasFilter ? t('suppliersPage.emptyFilteredDesc') : t('suppliersPage.emptyDesc')}
        />
      ) : (
        <div className="mk-grid-wide">{filtered.map(s => <SupplierCard key={s.id} supplier={s} />)}</div>
      )}
    </div>
  )
}

export default MarketSuppliers
