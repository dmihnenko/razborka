import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, Car, Package, Search, Sparkles, Store, Tag, Zap } from 'lucide-react'
import {
  getMarketCategories,
  getMarketMakes,
  getMarketParts,
  getMarketSuppliers,
} from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { SupplierCard } from '@/components/market/SupplierCard'
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
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="heading-3">{title}</h2>
      <Link
        to={to}
        className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-blue-700 transition-colors flex-shrink-0"
      >
        {linkLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
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

/** Skeleton для карточки разборки */
function SkeletonSupplierCard() {
  return (
    <div className="card p-4 flex items-start gap-3.5">
      <div className="w-12 h-12 animate-shimmer rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 animate-shimmer rounded-lg w-3/4" />
        <div className="h-3 animate-shimmer rounded-lg w-1/2" />
        <div className="h-3 animate-shimmer rounded-lg w-2/3" />
      </div>
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
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl px-5 py-10 sm:px-10 sm:py-14 text-center"
        style={{
          background: 'linear-gradient(135deg, #1E3A6E 0%, #1E40AF 45%, #2563EB 80%, #3B82F6 100%)',
        }}
      >
        {/* Декор: размытые кружки */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          {/* Бейдж-пилюля */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold mb-4 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
            Б/у запчасти напрямую от разборок
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Запчасти от{' '}
            <span className="text-blue-200">авторазборок</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-blue-100/80 max-w-md mx-auto leading-relaxed">
            Б/у и новые запчасти с фото и ценами — без посредников
          </p>

          <form onSubmit={handleSearch} className="mt-6 sm:mt-7 max-w-xl mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Название запчасти или артикул…"
                  className="w-full pl-12 pr-4 py-3.5 text-sm sm:text-base rounded-xl border-0 bg-white shadow-float focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-900 placeholder-gray-400"
                  aria-label="Поиск по каталогу запчастей"
                />
              </div>
              <button
                type="submit"
                className="px-5 sm:px-7 py-3.5 rounded-xl bg-gray-900 text-white text-sm sm:text-base font-bold hover:bg-gray-800 active:scale-[0.97] transition-all flex-shrink-0 shadow-float"
              >
                Найти
              </button>
            </div>
          </form>

          {/* Быстрые теги под поиском */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['Двигатель', 'КПП', 'Фары', 'Бампер', 'Подвеска'].map(hint => (
              <button
                key={hint}
                type="button"
                onClick={() => navigate(`/market/catalog?search=${encodeURIComponent(hint)}`)}
                className="px-3 py-1 rounded-lg bg-white/15 text-white/80 text-xs font-medium hover:bg-white/25 active:scale-[0.96] transition-all backdrop-blur-sm text-center"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Быстрые ссылки: категории ────────────────────────────────── */}
      {topCategories.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          aria-label="Популярные категории"
        >
          <SectionHeader title="Категории" to="/market/catalog" linkLabel="Все" />
          <div className="flex flex-wrap gap-2">
            {topCategories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <Link
                  to={`/market/catalog?categoryId=${encodeURIComponent(cat.id)}`}
                  className="chip hover:border-primary/60 hover:text-primary"
                >
                  <Tag className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                  {cat.name}
                  {cat.count > 0 && (
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {cat.count}
                    </span>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Быстрые ссылки: марки авто ───────────────────────────────── */}
      {topMakes.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
          aria-label="Марки автомобилей"
        >
          <SectionHeader title="Марки авто" to="/market/catalog" linkLabel="Все марки" />
          <div className="flex flex-wrap gap-2">
            {topMakes.map((make, i) => (
              <motion.div
                key={make}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: i * 0.025 }}
              >
                <Link
                  to={`/market/catalog?make=${encodeURIComponent(make)}`}
                  className="chip hover:border-primary/60 hover:text-primary"
                >
                  <Car className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                  {make}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Свежие поступления ───────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
        aria-label="Свежие поступления"
      >
        <SectionHeader
          title="Свежие поступления"
          to="/market/catalog"
          linkLabel="Весь каталог"
        />

        {freshLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (fresh?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Package}
            title="Пока нет товаров"
            description="Разборки ещё не добавили запчасти в каталог — загляните позже"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
            {fresh!.items.map(part => (
              <MarketProductCard key={part.id} part={part} />
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Разборки ─────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        aria-label="Разборки"
      >
        <SectionHeader title="Разборки" to="/market/suppliers" linkLabel="Все разборки" />

        {suppliersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonSupplierCard key={i} />
            ))}
          </div>
        ) : topSuppliers.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Разборок пока нет"
            description="Скоро здесь появятся продавцы запчастей"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 stagger-children">
            {topSuppliers.map(s => (
              <SupplierCard key={s.id} supplier={s} />
            ))}
          </div>
        )}
      </motion.section>

      {/* ── CTA-баннер ───────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.24 }}
      >
        <div className="rounded-2xl bg-gray-900 px-6 py-7 sm:px-8 sm:py-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <span className="icon-tile-lg bg-blue-500/20 text-blue-400 flex-shrink-0">
            <Sparkles className="w-6 h-6" strokeWidth={1.5} />
          </span>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-base font-bold text-white leading-snug">
              Вы авторазборка? Добавьте свои товары
            </p>
            <p className="text-sm text-gray-400 mt-0.5">
              Регистрация бесплатна — ваши запчасти увидят тысячи покупателей
            </p>
          </div>
          <Link
            to="/business"
            className="btn-primary btn-lg flex-shrink-0 whitespace-nowrap"
          >
            Зарегистрироваться
          </Link>
        </div>
      </motion.section>
    </div>
  )
}

export default MarketHome
