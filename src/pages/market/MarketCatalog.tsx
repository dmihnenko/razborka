import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Каталог запчастей</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Б/у и новые запчасти от авторазборок — без посредников
        </p>
      </div>

      <FilterBar value={filters} onChange={applyFilters} categories={categories} makes={makes} />

      {/* Счётчик результатов + индикатор фоновой подгрузки */}
      <div className="flex items-center gap-2 min-h-[20px]" aria-live="polite">
        {!isLoading && !isError && (
          <p className="text-sm text-gray-500">
            {total > 0 ? `Найдено ${pluralizeResults(total)}` : ''}
          </p>
        )}
        {isFetching && !isLoading && <Spinner size="sm" className="!h-4 !w-4" />}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState
          icon={PackageSearch}
          title="Не удалось загрузить каталог"
          description="Проверьте подключение к интернету и попробуйте обновить страницу."
        />
      ) : items.length === 0 ? (
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
      ) : (
        <>
          {/* Сетка товаров; при фоновой подгрузке слегка гасим прошлую страницу */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity ${
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
              className="flex items-center justify-center gap-3 pt-2 pb-4"
              aria-label="Постраничная навигация"
            >
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isPlaceholderData}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Назад</span>
              </button>

              <span className="text-sm text-gray-600 tabular-nums">
                Страница <span className="font-semibold">{page}</span> из {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isPlaceholderData}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Вперёд</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

export default MarketCatalog
