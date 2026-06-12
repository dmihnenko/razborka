import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Package,
  Phone,
  Search,
  SearchX,
  Store,
} from 'lucide-react'
import { getMarketParts, getMarketSupplier, MARKET_PAGE_SIZE } from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { cleanPhone, telegramHref } from '@/components/market/SellerContactCard'
import { pluralizeParts } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

// ============================================================================
// /market/supplier/:id — публичная страница разборки: контакты + её товары
// ============================================================================

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M21.94 4.66a1.13 1.13 0 0 0-1.15-.18L2.9 11.4c-.86.34-.83 1.57.04 1.86l4.4 1.47 1.7 5.18c.1.32.35.45.6.45.22 0 .43-.1.57-.27l2.43-2.86 4.46 3.27c.45.33 1.1.09 1.22-.46l3.2-14.9a1.13 1.13 0 0 0-.4-1.15zM9.5 14.1l-.5 3.5-1.2-3.9 9.3-6.2-7.6 6.6z" />
    </svg>
  )
}

/** Skeleton для шапки разборки */
function SkeletonHeader() {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 animate-shimmer rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-5 animate-shimmer rounded-xl w-2/3" />
          <div className="h-3.5 animate-shimmer rounded-lg w-1/2" />
          <div className="h-3.5 animate-shimmer rounded-lg w-3/4" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-10 animate-shimmer rounded-xl flex-1" />
        <div className="h-10 animate-shimmer rounded-xl flex-1" />
      </div>
    </div>
  )
}

export function MarketSupplierPage() {
  const { id } = useParams<{ id: string }>()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // ── Разборка ──────────────────────────────────────────────────────────────
  const {
    data: supplier,
    isLoading: supplierLoading,
    isError: supplierError,
  } = useQuery({
    queryKey: ['market', 'supplier', id],
    queryFn: () => getMarketSupplier(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  // ── Товары разборки (поиск + пагинация внутри страницы) ──────────────────
  const {
    data: partsData,
    isLoading: partsLoading,
    isFetching: partsFetching,
  } = useQuery({
    queryKey: ['market', 'parts', { companyId: id, search, page }],
    queryFn: () =>
      getMarketParts({
        companyId: id!,
        search: search || undefined,
        page,
        pageSize: MARKET_PAGE_SIZE,
      }),
    enabled: !!id && !!supplier,
    placeholderData: prev => prev,
    staleTime: 60 * 1000,
  })

  const items = partsData?.items ?? []
  const total = partsData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE))

  const applySearch = (e: FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
  }

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Состояния загрузки / ошибки / 404 ─────────────────────────────────────
  if (!id || supplierError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Не удалось загрузить разборку"
        description="Проверьте соединение и обновите страницу"
        action={
          <Link to="/market/suppliers" className="btn-primary">
            К списку разборок
          </Link>
        }
      />
    )
  }

  if (supplierLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="h-5 animate-shimmer rounded-lg w-28" />
        <SkeletonHeader />
        <div className="h-5 animate-shimmer rounded-lg w-24" />
        <div className="h-11 animate-shimmer rounded-xl max-w-xs" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden">
              <div className="aspect-[4/3] animate-shimmer rounded-t-2xl" />
              <div className="p-4 space-y-2">
                <div className="h-3.5 animate-shimmer rounded-lg w-3/4" />
                <div className="h-3 animate-shimmer rounded-lg w-1/2" />
                <div className="h-8 animate-shimmer rounded-xl mt-3" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  if (!supplier) {
    return (
      <EmptyState
        icon={SearchX}
        title="Разборка не найдена"
        description="Возможно, она отключена или ссылка устарела"
        action={
          <Link to="/market/suppliers" className="btn-primary">
            К списку разборок
          </Link>
        }
      />
    )
  }

  const phoneRaw = supplier.phone ? cleanPhone(supplier.phone) : null
  const tgHref = telegramHref(supplier.telegram)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <Link
        to="/market/suppliers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        Все разборки
      </Link>

      {/* ── Шапка разборки ─────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <span className="icon-tile-lg bg-blue-50 text-blue-600 flex-shrink-0">
            <Store className="w-6 h-6" strokeWidth={1.5} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-snug tracking-tight">
              {supplier.name}
            </h1>
            <p className="flex items-center gap-1.5 text-sm mt-1">
              <Package
                className={`w-4 h-4 flex-shrink-0 ${supplier.availableParts > 0 ? 'text-green-600' : 'text-gray-400'}`}
                strokeWidth={1.5}
              />
              <span className={`font-semibold ${supplier.availableParts > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
                {supplier.availableParts > 0
                  ? `${pluralizeParts(supplier.availableParts)} в наличии`
                  : 'Нет товаров в наличии'}
              </span>
            </p>
          </div>
        </div>

        {/* Контакты */}
        <div className="mt-4 space-y-2 text-sm">
          {supplier.phone && phoneRaw && (
            <a
              href={`tel:${phoneRaw}`}
              className="flex items-center gap-2 text-gray-700 hover:text-primary transition-colors"
            >
              <span className="icon-tile-sm bg-green-50 text-green-600 flex-shrink-0">
                <Phone className="w-4 h-4" strokeWidth={1.5} />
              </span>
              <span className="font-bold">{supplier.phone}</span>
            </a>
          )}
          {supplier.address && (
            <p className="flex items-start gap-2 text-gray-600">
              <span className="icon-tile-sm bg-orange-50 text-orange-500 flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" strokeWidth={1.5} />
              </span>
              <span className="leading-snug pt-1">{supplier.address}</span>
            </p>
          )}
        </div>

        {supplier.description && (
          <p className="mt-3 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-3">
            {supplier.description}
          </p>
        )}

        {/* Кнопки связи */}
        {(phoneRaw || tgHref) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {phoneRaw && (
              <a
                href={`tel:${phoneRaw}`}
                className="flex-1 min-w-[140px] btn-success"
              >
                <Phone className="w-4 h-4" strokeWidth={1.5} />
                Позвонить
              </a>
            )}
            {tgHref && (
              <a
                href={tgHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 py-2.5 text-white text-sm font-semibold rounded-xl active:scale-[0.97] transition-all"
                style={{ background: 'linear-gradient(180deg, #33B5E5 0%, #229ED9 100%)' }}
              >
                <TelegramIcon className="w-4 h-4 fill-current" />
                Telegram
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Товары ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h2 className="heading-3 flex-shrink-0">
          Товары{total > 0 ? (
            <span className="ml-2 text-base font-semibold text-gray-400">({total})</span>
          ) : ''}
        </h2>
        <form onSubmit={applySearch} className="relative w-full sm:max-w-xs sm:ml-auto">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onBlur={() => {
              const q = searchInput.trim()
              if (q !== search) {
                setSearch(q)
                setPage(1)
              }
            }}
            placeholder="Поиск по товарам разборки…"
            className="form-input pl-10"
            aria-label="Поиск по товарам разборки"
          />
        </form>
      </div>

      {partsLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? 'Ничего не найдено' : 'Товаров пока нет'}
          description={
            search
              ? 'Попробуйте изменить запрос'
              : 'Доступные запчасти этой разборки появятся здесь'
          }
        />
      ) : (
        <>
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 transition-opacity stagger-children ${partsFetching ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {items.map(part => (
              <MarketProductCard key={part.id} part={part} />
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-3 pt-4"
              aria-label="Постраничная навигация"
            >
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.95]"
                aria-label="Предыдущая страница"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>

              <span className="text-sm font-semibold text-gray-600 px-2 tabular-nums">
                <span className="text-gray-900">{page}</span>
                <span className="text-gray-400 mx-1">/</span>
                {totalPages}
              </span>

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.95]"
                aria-label="Следующая страница"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </nav>
          )}
        </>
      )}
    </motion.div>
  )
}

export default MarketSupplierPage
