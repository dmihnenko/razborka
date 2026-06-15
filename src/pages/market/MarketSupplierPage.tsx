import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, MapPin, Package, Phone, Search, SearchX, Store } from 'lucide-react'
import { getMarketParts, getMarketSupplier, MARKET_PAGE_SIZE } from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { cleanPhone, telegramHref } from '@/components/market/SellerContactCard'
import { pluralizeParts } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

// ============================================================================
// /market/supplier/:id — страница разборки (Graphite)
// ============================================================================

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M21.94 4.66a1.13 1.13 0 0 0-1.15-.18L2.9 11.4c-.86.34-.83 1.57.04 1.86l4.4 1.47 1.7 5.18c.1.32.35.45.6.45.22 0 .43-.1.57-.27l2.43-2.86 4.46 3.27c.45.33 1.1.09 1.22-.46l3.2-14.9a1.13 1.13 0 0 0-.4-1.15zM9.5 14.1l-.5 3.5-1.2-3.9 9.3-6.2-7.6 6.6z" />
    </svg>
  )
}

const TILE = 'inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0'

export function MarketSupplierPage() {
  const { id } = useParams<{ id: string }>()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const { data: supplier, isLoading: supplierLoading, isError: supplierError } = useQuery({
    queryKey: ['market', 'supplier', id], queryFn: () => getMarketSupplier(id!), enabled: !!id, staleTime: 5 * 60 * 1000,
  })

  const { data: partsData, isLoading: partsLoading, isFetching: partsFetching } = useQuery({
    queryKey: ['market', 'parts', { companyId: id, search, page }],
    queryFn: () => getMarketParts({ companyId: id!, search: search || undefined, page, pageSize: MARKET_PAGE_SIZE }),
    enabled: !!id && !!supplier, placeholderData: prev => prev, staleTime: 60 * 1000,
  })

  const items = partsData?.items ?? []
  const total = partsData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE))

  const applySearch = (e: FormEvent) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1) }
  const goToPage = (p: number) => { setPage(Math.min(Math.max(1, p), totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (!id || supplierError) {
    return <EmptyState icon={AlertCircle} title="Не удалось загрузить разборку" description="Проверьте соединение и обновите страницу" action={<Link to="/market/suppliers" className="mk-btn mk-btn-accent">К списку разборок</Link>} />
  }

  if (supplierLoading) {
    return (
      <div className="space-y-4">
        <div className="h-5 rounded-lg w-28" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="mk-card h-32" />
        <div className="mk-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="mk-card aspect-[4/3]" aria-hidden="true" />)}</div>
      </div>
    )
  }

  if (!supplier) {
    return <EmptyState icon={SearchX} title="Разборка не найдена" description="Возможно, она отключена или ссылка устарела" action={<Link to="/market/suppliers" className="mk-btn mk-btn-accent">К списку разборок</Link>} />
  }

  const phoneRaw = supplier.phone ? cleanPhone(supplier.phone) : null
  const tgHref = telegramHref(supplier.telegram)

  return (
    <div className="space-y-5">
      <Link to="/market/suppliers" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold mk-link">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Все разборки
      </Link>

      {/* Шапка разборки */}
      <div className="mk-card p-5">
        <div className="flex items-start gap-4">
          <span className="mk-tile-icon w-12 h-12 rounded-2xl flex-shrink-0"><Store className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold leading-snug tracking-tight" style={{ color: 'var(--mk-text)' }}>{supplier.name}</h1>
            <p className="flex items-center gap-1.5 text-sm mt-1" style={{ color: supplier.availableParts > 0 ? 'var(--mk-text-2)' : 'var(--mk-text-3)' }}>
              <Package className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-semibold">{supplier.availableParts > 0 ? `${pluralizeParts(supplier.availableParts)} в наличии` : 'Нет товаров в наличии'}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {supplier.phone && phoneRaw && (
            <a href={`tel:${phoneRaw}`} className="flex items-center gap-2 transition-colors" style={{ color: 'var(--mk-text-2)' }} aria-label={`Позвонить ${supplier.phone}`}>
              <span className={TILE} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}><Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /></span>
              <span className="font-bold" style={{ color: 'var(--mk-text)' }}>{supplier.phone}</span>
            </a>
          )}
          {supplier.address && (
            <p className="flex items-start gap-2" style={{ color: 'var(--mk-text-2)' }}>
              <span className={`${TILE} mt-0.5`} style={{ background: 'var(--mk-surface-2)', color: 'var(--mk-text-2)' }}><MapPin className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /></span>
              <span className="leading-snug pt-1">{supplier.address}</span>
            </p>
          )}
        </div>

        {supplier.description && (
          <p className="mt-3 text-xs leading-relaxed whitespace-pre-wrap pt-3 mk-meta mk-divider">{supplier.description}</p>
        )}

        {(phoneRaw || tgHref) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {phoneRaw && (
              <a href={`tel:${phoneRaw}`} className="mk-btn mk-btn-accent flex-1 sm:flex-none min-w-[140px]" aria-label={`Позвонить ${supplier.phone}`}>
                <Phone className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" /> Позвонить
              </a>
            )}
            {tgHref && (
              <a href={tgHref} target="_blank" rel="noopener noreferrer" className="mk-btn mk-btn-outline flex-1 sm:flex-none min-w-[140px]" aria-label="Открыть Telegram разборки">
                <TelegramIcon className="w-4 h-4 fill-current" /> Telegram
              </a>
            )}
          </div>
        )}
      </div>

      {/* Товары */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="mk-title flex-shrink-0">
          Товары{total > 0 ? <span className="ml-2 text-base font-semibold mk-meta">({total})</span> : ''}
        </h2>
        <form onSubmit={applySearch} role="search" className="relative w-full sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none mk-meta" strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search" value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onBlur={() => { const q = searchInput.trim(); if (q !== search) { setSearch(q); setPage(1) } }}
            placeholder="Поиск по товарам разборки…" className="mk-input mk-search" aria-label="Поиск по товарам разборки"
          />
        </form>
      </div>

      {partsLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title={search ? 'Ничего не найдено' : 'Товаров пока нет'} description={search ? 'Попробуйте изменить запрос' : 'Доступные запчасти этой разборки появятся здесь'} />
      ) : (
        <>
          <div className={`mk-grid transition-opacity ${partsFetching ? 'opacity-60 pointer-events-none' : ''}`}>
            {items.map(part => <MarketProductCard key={part.id} part={part} />)}
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pt-4" aria-label="Постраничная навигация">
              <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="mk-page-btn !px-0" aria-label="Предыдущая страница">
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold px-2 tabular-nums" style={{ color: 'var(--mk-text-2)' }}>
                <span style={{ color: 'var(--mk-text)' }}>{page}</span> <span className="mk-meta">/</span> {totalPages}
              </span>
              <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="mk-page-btn !px-0" aria-label="Следующая страница">
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

export default MarketSupplierPage
