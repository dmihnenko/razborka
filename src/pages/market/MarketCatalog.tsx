import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react'
import type { MarketCondition, MarketFilters, MarketSort } from '@/types/marketplace'
import { getMarketCategories, getMarketCarCatalog, getMarketParts, MARKET_PAGE_SIZE } from '@/services/marketplaceService'
import { FilterBar } from '@/components/market/FilterBar'
import { useFeatureFlag } from '@/hooks/useFeatureFlags'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { usePageMeta } from '@/hooks/usePageMeta'
import { slugify } from '@/utils/slug'

// ============================================================================
// /market/catalog — каталог (Graphite). Фильтры синхронятся с URL.
// ============================================================================

const CONDITIONS: MarketCondition[] = ['new', 'used', 'damaged']
const SORTS: MarketSort[] = ['new', 'price_asc', 'price_desc']

function filtersFromParams(params: URLSearchParams): MarketFilters {
  const condition = params.get('condition') as MarketCondition | null
  const sort = params.get('sort') as MarketSort | null
  const page = parseInt(params.get('page') ?? '', 10)
  const year = parseInt(params.get('year') ?? '', 10)
  const minP = parseInt(params.get('min') ?? '', 10)
  const maxP = parseInt(params.get('max') ?? '', 10)
  return {
    search: params.get('search')?.trim() || undefined,
    categoryId: params.get('category') || undefined,
    make: params.get('make') || undefined,
    model: params.get('model') || undefined,
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    condition: condition && CONDITIONS.includes(condition) ? condition : undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    minPrice: Number.isFinite(minP) && minP >= 0 ? minP : undefined,
    maxPrice: Number.isFinite(maxP) && maxP >= 0 ? maxP : undefined,
    page: Number.isFinite(page) && page > 1 ? page : 1,
    pageSize: MARKET_PAGE_SIZE,
  }
}

function paramsFromFilters(f: MarketFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.search) out.search = f.search
  if (f.categoryId) out.category = f.categoryId
  if (f.make) out.make = f.make
  if (f.model) out.model = f.model
  if (f.year) out.year = String(f.year)
  if (f.condition) out.condition = f.condition
  if (f.sort && f.sort !== 'new') out.sort = f.sort
  if (f.minPrice != null) out.min = String(f.minPrice)
  if (f.maxPrice != null) out.max = String(f.maxPrice)
  if (f.page && f.page > 1) out.page = String(f.page)
  return out
}

function pluralizeResults(n: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return t('catalogPage.resultsOne', { n })
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t('catalogPage.resultsFew', { n })
  return t('catalogPage.resultsMany', { n })
}

function SkeletonCard() {
  return (
    <div className="mk-card overflow-hidden" aria-hidden="true">
      <div className="aspect-[4/3]" style={{ background: 'var(--mk-surface-2)' }} />
      <div className="p-3 space-y-2.5">
        <div className="h-3.5 rounded-lg w-3/4" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="h-3 rounded-lg w-1/2" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="h-7 rounded-xl w-full mt-2" style={{ background: 'var(--mk-surface-2)' }} />
      </div>
    </div>
  )
}

export function MarketCatalog() {
  const { t } = useTranslation('market')
  const pathParams = useParams<{ makeSlug?: string; modelSlug?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<MarketFilters>(() => filtersFromParams(searchParams))
  const showPriceFilter = useFeatureFlag('market_price_filter')

  const { data: carCatalog = [] } = useQuery({ queryKey: ['market-car-catalog'], queryFn: getMarketCarCatalog, staleTime: 5 * 60 * 1000 })

  // SEO-лендинг по марке/модели (/market/catalog/tesla/model-3): резолвим slug → название
  const landing = useMemo(() => {
    if (!pathParams.makeSlug) return null
    const mk = (carCatalog as any[]).find((m) => slugify(m.make) === pathParams.makeSlug)
    if (!mk) return null
    const md = pathParams.modelSlug ? (mk.models || []).find((x: any) => slugify(x.model) === pathParams.modelSlug) : null
    return { make: mk.make as string, model: md ? (md.model as string) : undefined }
  }, [pathParams.makeSlug, pathParams.modelSlug, carCatalog])

  const landingLabel = landing ? [landing.make, landing.model].filter(Boolean).join(' ') : ''

  usePageMeta(
    landing ? `${t('catalogPage.brandTitlePrefix')} ${landingLabel} — Razborka.net`
            : 'Каталог автозапчастей — Razborka.net',
    landing ? `${t('catalogPage.brandTitlePrefix')} ${landingLabel} ${t('catalogPage.brandMetaSuffix')}`
            : 'Каталог б/у и новых автозапчастей от авторазборок. Фильтр по марке, модели, году и состоянию.',
  )

  // Применяем марку/модель из пути к фильтрам (как только справочник загрузился)
  useEffect(() => {
    if (!landing) return
    setFilters(prev =>
      prev.make === landing.make && prev.model === landing.model
        ? prev
        : { ...prev, make: landing.make, model: landing.model, page: 1 },
    )
  }, [landing])

  useEffect(() => {
    const next = filtersFromParams(searchParams)
    setFilters(prev => {
      const changed =
        prev.search !== next.search || prev.categoryId !== next.categoryId ||
        prev.make !== next.make || prev.model !== next.model || prev.year !== next.year ||
        prev.condition !== next.condition ||
        prev.sort !== next.sort || prev.minPrice !== next.minPrice || prev.maxPrice !== next.maxPrice ||
        (prev.page ?? 1) !== (next.page ?? 1)
      return changed ? { ...prev, ...next } : prev
    })
     
  }, [searchParams])

  const applyFilters = (next: MarketFilters) => {
    setFilters(next)
    setSearchParams(paramsFromFilters(next), { replace: true })
  }

  const setPage = (page: number) => {
    applyFilters({ ...filters, page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { data, isLoading, isError, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['market-parts', filters],
    queryFn: () => getMarketParts(filters),
    placeholderData: keepPreviousData,
  })
  const { data: categories = [] } = useQuery({ queryKey: ['market-categories'], queryFn: getMarketCategories, staleTime: 5 * 60 * 1000 })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageSize = filters.pageSize ?? MARKET_PAGE_SIZE
  const page = filters.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (!isLoading && !isPlaceholderData && total > 0 && page > totalPages) setPage(1)
     
  }, [total, totalPages, page, isLoading, isPlaceholderData])

  const hasActiveFilters = useMemo(
    () => Boolean(filters.search || filters.categoryId || filters.make || filters.model || filters.year || filters.condition || filters.minPrice || filters.maxPrice),
    [filters]
  )

  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, i) =>
    totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mk-h1">{landing ? `${t('catalogPage.brandTitlePrefix')} ${landingLabel}` : t('catalogPage.title')}</h1>
      </div>

      <FilterBar value={filters} onChange={applyFilters} categories={categories} carCatalog={carCatalog} showPriceFilter={showPriceFilter} />

      <div className="flex items-center gap-2 min-h-[20px]" aria-live="polite">
        {!isLoading && !isError && total > 0 && (
          <p className="text-sm mk-meta">{t('catalogPage.found')}: <span className="font-bold" style={{ color: 'var(--mk-text)' }}>{pluralizeResults(total, t)}</span></p>
        )}
        {isFetching && !isLoading && <Spinner size="sm" className="!h-4 !w-4" />}
      </div>

      {isLoading ? (
        <div className="mk-grid">{Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : isError ? (
        <EmptyState icon={PackageSearch} title={t('catalogPage.errorTitle')} description={t('catalogPage.errorDesc')} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t('catalogPage.emptyTitle')}
          description={hasActiveFilters ? t('catalogPage.emptyFiltered') : t('catalogPage.emptyAll')}
          action={hasActiveFilters ? (
            <button type="button" onClick={() => applyFilters({ sort: filters.sort, page: 1, pageSize })} className="mk-btn mk-btn-outline">{t('catalogPage.resetFilters')}</button>
          ) : undefined}
        />
      ) : (
        <>
          <div className={`mk-grid transition-opacity ${isPlaceholderData ? 'opacity-60 pointer-events-none' : ''}`}>
            {items.map(part => <MarketProductCard key={part.id} part={part} />)}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-6 pb-2" aria-label={t('catalogPage.paginationNav')}>
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1 || isPlaceholderData} className="mk-page-btn" aria-label={t('catalogPage.prevPage')}>
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                <span className="hidden sm:inline">{t('catalogPage.back')}</span>
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map(n => (
                  <button key={n} type="button" onClick={() => setPage(n)} disabled={isPlaceholderData} className={`mk-page-btn !px-0 w-11 ${n === page ? 'active' : ''}`} aria-label={t('catalogPage.pageN', { n })} aria-current={n === page ? 'page' : undefined}>
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages || isPlaceholderData} className="mk-page-btn" aria-label={t('catalogPage.nextPage')}>
                <span className="hidden sm:inline">{t('catalogPage.forward')}</span>
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

export default MarketCatalog
