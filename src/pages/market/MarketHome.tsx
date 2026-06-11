import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Car, Package, Search, Store, Tag } from 'lucide-react'
import {
  getMarketCategories,
  getMarketMakes,
  getMarketParts,
  getMarketSuppliers,
} from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { SupplierCard } from '@/components/market/SupplierCard'
import { Spinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// Главная маркетплейса (/market) — рендерится в <Outlet/> внутри MarketLayout
// ============================================================================

const FRESH_PAGE_SIZE = 12
const MAX_CATEGORIES = 8
const MAX_MAKES = 10
const MAX_SUPPLIERS = 6

/** Заголовок секции со ссылкой «Все …» справа */
function SectionHeader({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-base sm:text-lg font-bold text-gray-900">{title}</h2>
      <Link
        to={to}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0"
      >
        {linkLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

export function MarketHome() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: fresh, isLoading: freshLoading } = useQuery({
    queryKey: ['market', 'parts', { sort: 'new', pageSize: FRESH_PAGE_SIZE }],
    queryFn: () => getMarketParts({ sort: 'new', pageSize: FRESH_PAGE_SIZE }),
    staleTime: 60_000,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['market', 'categories'],
    queryFn: getMarketCategories,
    staleTime: 5 * 60_000,
  })

  const { data: makes = [] } = useQuery({
    queryKey: ['market', 'makes'],
    queryFn: getMarketMakes,
    staleTime: 5 * 60_000,
  })

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['market', 'suppliers'],
    queryFn: getMarketSuppliers,
    staleTime: 5 * 60_000,
  })

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  const topCategories = categories.slice(0, MAX_CATEGORIES)
  const topMakes = makes.slice(0, MAX_MAKES)
  const topSuppliers = (suppliers ?? []).slice(0, MAX_SUPPLIERS)

  return (
    <div className="space-y-8 sm:space-y-10">

      {/* ── Герой с крупным поиском ──────────────────────────────────── */}
      <section className="rounded-2xl bg-gradient-to-br from-primary to-blue-700 px-4 py-8 sm:px-8 sm:py-12 text-center">
        <h1 className="text-xl sm:text-3xl font-bold text-white leading-tight">
          Запчасти от авторазборок
        </h1>
        <p className="mt-2 text-sm sm:text-base text-blue-100">
          Б/у и новые запчасти с фото и ценами — напрямую от разборок
        </p>

        <form onSubmit={handleSearch} className="mt-5 sm:mt-6 max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Название запчасти или артикул…"
                className="w-full pl-11 pr-3 py-3 text-sm sm:text-base rounded-xl border-0 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-label="Поиск по каталогу запчастей"
              />
            </div>
            <button
              type="submit"
              className="px-4 sm:px-6 py-3 rounded-xl bg-gray-900 text-white text-sm sm:text-base font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all flex-shrink-0"
            >
              Найти
            </button>
          </div>
        </form>
      </section>

      {/* ── Быстрые ссылки: категории ────────────────────────────────── */}
      {topCategories.length > 0 && (
        <section aria-label="Популярные категории">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Категории</h2>
          <div className="flex flex-wrap gap-2">
            {topCategories.map(cat => (
              <Link
                key={cat.id}
                to={`/market/catalog?categoryId=${encodeURIComponent(cat.id)}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-gray-200 text-sm text-gray-700 font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                {cat.name}
                <span className="text-xs text-gray-400">{cat.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Быстрые ссылки: марки авто ───────────────────────────────── */}
      {topMakes.length > 0 && (
        <section aria-label="Марки автомобилей">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">Марки авто</h2>
          <div className="flex flex-wrap gap-2">
            {topMakes.map(make => (
              <Link
                key={make}
                to={`/market/catalog?make=${encodeURIComponent(make)}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-gray-200 text-sm text-gray-700 font-medium hover:border-primary hover:text-primary transition-colors"
              >
                <Car className="w-3.5 h-3.5 text-gray-400" />
                {make}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Свежие поступления ───────────────────────────────────────── */}
      <section aria-label="Свежие поступления">
        <SectionHeader title="Свежие поступления" to="/market/catalog" linkLabel="Весь каталог" />

        {freshLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (fresh?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Package}
            title="Пока нет товаров"
            description="Разборки ещё не добавили запчасти в каталог — загляните позже"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {fresh!.items.map(part => (
              <MarketProductCard key={part.id} part={part} />
            ))}
          </div>
        )}
      </section>

      {/* ── Разборки ─────────────────────────────────────────────────── */}
      <section aria-label="Разборки">
        <SectionHeader title="Разборки" to="/market/suppliers" linkLabel="Все разборки" />

        {suppliersLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : topSuppliers.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Разборок пока нет"
            description="Скоро здесь появятся продавцы запчастей"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {topSuppliers.map(s => (
              <SupplierCard key={s.id} supplier={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default MarketHome
