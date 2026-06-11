import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
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
    <div className="space-y-4">
      <Link
        to="/market/suppliers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Все разборки
      </Link>

      {/* ── Шапка разборки ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
              {supplier.name}
            </h1>
            <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {supplier.availableParts > 0
                ? `${pluralizeParts(supplier.availableParts)} в наличии`
                : 'Нет товаров в наличии'}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          {supplier.phone && phoneRaw && (
            <a
              href={`tel:${phoneRaw}`}
              className="flex items-center gap-2 text-gray-700 hover:text-primary transition-colors"
            >
              <Phone className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="font-semibold">{supplier.phone}</span>
            </a>
          )}
          {supplier.address && (
            <p className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{supplier.address}</span>
            </p>
          )}
        </div>

        {supplier.description && (
          <p className="mt-3 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
            {supplier.description}
          </p>
        )}

        {(phoneRaw || tgHref) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {phoneRaw && (
              <a
                href={`tel:${phoneRaw}`}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                <Phone className="w-4 h-4" /> Позвонить
              </a>
            )}
            {tgHref && (
              <a
                href={tgHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 bg-[#229ED9] text-white text-sm font-semibold rounded-lg hover:bg-[#1c8dc2] active:scale-[0.98] transition-all"
              >
                <TelegramIcon className="w-4 h-4 fill-current" /> Telegram
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Товары ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <h2 className="text-base font-bold text-gray-900 flex-shrink-0">
          Товары{total > 0 ? ` (${total})` : ''}
        </h2>
        <form onSubmit={applySearch} className="relative w-full sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
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
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 ${partsFetching ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {items.map(part => (
              <MarketProductCard key={part.id} part={part} />
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Предыдущая страница"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 px-2">
                {page} из {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Следующая страница"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MarketSupplierPage
