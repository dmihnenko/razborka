import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react'
import type { MarketCondition, MarketFilters, MarketSort } from '@/types/marketplace'
import {
  getMarketCategories,
  getMarketMakes,
  getMarketParts,
  MARKET_PAGE_SIZE,
} from '@/services/marketplaceService'
import { FilterBar } from '@/components/market/FilterBar'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import EmptyState from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

// ============================================================================
// /market/catalog — публичный каталог запчастей (анонимно, внутри MarketLayout)
// Ключевые фильтры синхронизируются с URL (?search/category/make/condition/sort/page)
// ============================================================================

const CONDITIONS: MarketCondition[] = ['new', 'used', 'damaged']
const SORTS: MarketSort[] = ['new', 'price_asc', 'price_desc']

/** Читаем фильтры из query-строки (только валидные значения) */
function filtersFromParams(params: URLSearchParams): MarketFilters {
  const condition = params.get('condition') as MarketCondition | null
  const sort = params.get('sort') as MarketSort | null
  const page = parseInt(params.get('page') ?? '', 10)

  return {
    search: params.get('search')?.trim() || undefined,
    categoryId: params.get('category') || undefined,
    make: params.get('make') || undefined,
    condition: condition && CONDITIONS.includes(condition) ? condition : undefined,
    sort: sort && SORTS.includes(sort) ? sort : undefined,
    page: Number.isFinite(page) && page > 1 ? page : 1,
    pageSize: MARKET_PAGE_SIZE,
  }
}

/** Пишем ключевые фильтры обратно в query-строку (пустые — убираем) */
function paramsFromFilters(f: MarketFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.search) out.search = f.search
  if (f.categoryId) out.category = f.categoryId
  if (f.make) out.make = f.make
  if (f.condition) out.condition = f.condition
  if (f.sort && f.sort !== 'new') out.sort = f.sort
  if (f.page && f.page > 1) out.page = String(f.page)
  return out
}

/** Склонение «N товаров» */
function pluralizeResults(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} товар`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} товара`
  return `${n} товаров`
}

/** Skeleton-карточка для загрузки */
function SkeletonCard() {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="aspect-[4/3] animate-shimmer rounded-t-2xl" />
      <div className="p-4 space-y-2.5">
        <div className="h-3.5 animate-shimmer rounded-lg w-3/4" />
        <div className="h-3 animate-shimmer rounded-lg w-1/2" />
        <div className="h-5 animate-shimmer rounded-lg w-2/5 mt-3" />
        <div className="h-8 animate-shimmer rounded-xl mt-2" />
      </div>
    </div>
  )
}

export function MarketCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<MarketFilters>(() => filtersFromParams(searchParams))

  // Внешнее изменение URL (поиск из шапки, кнопка «назад») → подхватываем в состояние
  useEffect(() => {
    const next = filtersFromParams(searchParams)
    setFilters(prev => {
      const changed =
        prev.search !== next.search ||
        prev.categoryId !== next.categoryId ||
        prev.make !== next.make ||
        prev.condition !== next.condition ||
        prev.sort !== next.sort ||
        (prev.page ?? 1) !== (next.page ?? 1)
      // Локальные minPrice/maxPrice не теряем — они не в URL
      return changed ? { ...prev, ...next } : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const applyFilters = (next: MarketFilters) => {
    setFilters(next)
    setSearchParams(paramsFromFilters(next), { replace: true })
  }

  const setPage = (page: number) => {
    applyFilters({ ...filters, page })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Данные ────────────────────────────────────────────────────────────────

  const { data, isLoading, isError, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['market-parts', filters],
    queryFn: () => getMarketParts(filters),
    placeholderData: keepPreviousData,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['market-categories'],
    queryFn: getMarketCategories,
    staleTime: 5 * 60 * 1000,
  })

  const { data: makes = [] } = useQuery({
    queryKey: ['market-makes'],
    queryFn: getMarketMakes,
    staleTime: 5 * 60 * 1000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageSize = filters.pageSize ?? MARKET_PAGE_SIZE
  const page = filters.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Если после смены фильтров страница «улетела» за пределы — возвращаемся на 1-ю
  useEffect(() => {
    if (!isLoading && !isPlaceholderData && total > 0 && page > totalPages) setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, totalPages, page, isLoading, isPlaceholderData])

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.search ||
          filters.categoryId ||
          filters.make ||
          filters.condition ||
          filters.minPrice ||
          filters.maxPrice
      ),
    [filters]
  )

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      {/* Заголовок */}
      <div>
        <h1 className="page-title">Каталог запчастей</h1>
        <p className="page-subtitle">
          Б/у и новые запчасти от авторазборок — без посредников
        </p>
      </div>

      <FilterBar value={filters} onChange={applyFilters} categories={categories} makes={makes} />

      {/* Счётчик результатов + индикатор фоновой подгрузки */}
      <div className="flex items-center gap-2 min-h-[20px]" aria-live="polite">
        {!isLoading && !isError && total > 0 && (
          <p className="text-sm font-medium text-gray-500">
            Найдено: <span className="font-bold text-gray-700">{pluralizeResults(total)}</span>
          </p>
        )}
        {isFetching && !isLoading && <Spinner size="sm" className="!h-4 !w-4" />}
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </motion.div>
        ) : isError ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyState
              icon={PackageSearch}
              title="Не удалось загрузить каталог"
              description="Проверьте подключение к интернету и попробуйте обновить страницу."
            />
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <EmptyState
              icon={PackageSearch}
              title="Ничего не найдено"
              description={
                hasActiveFilters
                  ? 'Попробуйте изменить запрос или сбросить фильтры.'
                  : 'В каталоге пока нет доступных запчастей — загляните позже.'
              }
              action={
                hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => applyFilters({ sort: filters.sort, page: 1, pageSize })}
                    className="btn-secondary"
                  >
                    Сбросить фильтры
                  </button>
                ) : undefined
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Сетка товаров; при фоновой подгрузке слегка гасим прошлую страницу */}
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 transition-opacity stagger-children ${
                isPlaceholderData ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {items.map(part => (
                <MarketProductCard key={part.id} part={part} />
              ))}
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <nav
                className="flex items-center justify-center gap-3 pt-6 pb-4"
                aria-label="Постраничная навигация"
              >
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1 || isPlaceholderData}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 hover:shadow-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Назад</span>
                </button>

                <div className="flex items-center gap-1">
                  {/* Кнопки страниц */}
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = totalPages <= 5
                      ? i + 1
                      : page <= 3
                        ? i + 1
                        : page >= totalPages - 2
                          ? totalPages - 4 + i
                          : page - 2 + i
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        disabled={isPlaceholderData}
                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all active:scale-[0.95] ${
                          pageNum === page
                            ? 'text-white shadow-glow-blue'
                            : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                        style={pageNum === page ? {
                          backgroundImage: 'linear-gradient(180deg, #3B82F6 0%, #2563EB 100%)',
                        } : undefined}
                        aria-current={pageNum === page ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages || isPlaceholderData}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-gray-300 hover:shadow-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
                >
                  <span className="hidden sm:inline">Вперёд</span>
                  <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </nav>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default MarketCatalog
