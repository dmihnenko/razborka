import { useState, type FormEvent, type ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Armchair, ArrowRight, Car, Cog, Disc3, Gauge, Lightbulb, Package, Search,
  Settings2, Sparkles, Store, Tag, Wind, Zap,
} from 'lucide-react'
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
// Главная маркетплейса (/market) — рендерится в <Outlet/> внутри MarketLayout.
// «Azure Market»: герой-поиск, категорийная навигация плитками, свежее, разборки.
// ============================================================================

const FRESH_PAGE_SIZE = 12
const MAX_CATEGORIES = 10
const MAX_MAKES = 12
const MAX_SUPPLIERS = 6
const QUICK_TAGS = ['Двигатель', 'КПП', 'Фары', 'Бампер', 'Подвеска', 'Стартер']

/** Иконка категории по ключевым словам названия (маркетплейс-флавор) */
function categoryIcon(name: string): ComponentType<{ className?: string; strokeWidth?: number }> {
  const n = name.toLowerCase()
  if (/двиг|мотор|engine/.test(n)) return Cog
  if (/кпп|коробк|трансм|gearbox/.test(n)) return Settings2
  if (/фар|оптик|свет|light|лампа/.test(n)) return Lightbulb
  if (/кузов|бампер|дверь|капот|крыл/.test(n)) return Car
  if (/электр|провод|датчик|стартер|генератор/.test(n)) return Zap
  if (/тормоз|диск|колод|brake/.test(n)) return Disc3
  if (/подвеск|амортиз|рычаг|suspension/.test(n)) return Gauge
  if (/салон|сидень|кресл|интерьер/.test(n)) return Armchair
  if (/кондиц|охлажд|радиат|печк|вентил/.test(n)) return Wind
  return Tag
}

/** Skeleton-карточка для загрузки */
function SkeletonCard() {
  return (
    <div className="card p-0 overflow-hidden" aria-hidden="true">
      <div className="aspect-[4/3] animate-shimmer rounded-t-2xl" />
      <div className="p-3 space-y-2.5">
        <div className="h-3.5 animate-shimmer rounded-lg w-3/4" />
        <div className="h-3 animate-shimmer rounded-lg w-1/2" />
        <div className="h-7 animate-shimmer rounded-xl w-full mt-2" />
      </div>
    </div>
  )
}

function SkeletonSupplierCard() {
  return (
    <div className="card p-4 flex items-start gap-3.5" aria-hidden="true">
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
  const reduce = useReducedMotion()

  // Анимация секций с учётом prefers-reduced-motion
  const sectionAnim = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const, delay },
        }

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
        {...sectionAnim(0)}
        className="market-surface relative overflow-hidden rounded-3xl px-5 py-9 sm:px-10 sm:py-14 text-center"
        aria-labelledby="market-hero-title"
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--brand-400) 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, var(--brand-200) 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold mb-4 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
            Запчасти напрямую от авторазборок
          </div>

          <h1 id="market-hero-title" className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white max-w-2xl mx-auto leading-tight">
            Найдите нужную запчасть с фото и ценой
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-white/85 max-w-md mx-auto">
            Б/у и новые — напрямую от разборок, без посредников
          </p>

          <form onSubmit={handleSearch} role="search" className="mt-6 sm:mt-7 max-w-xl mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" strokeWidth={1.5} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Название запчасти или артикул…"
                  className="market-search"
                  aria-label="Поиск по каталогу запчастей"
                />
              </div>
              <button type="submit" className="h-12 px-5 sm:px-7 rounded-2xl bg-gray-900 text-white text-sm sm:text-base font-bold hover:bg-gray-800 active:scale-[0.97] transition-all flex-shrink-0">
                Найти
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {QUICK_TAGS.map(hint => (
              <button
                key={hint}
                type="button"
                onClick={() => navigate(`/market/catalog?search=${encodeURIComponent(hint)}`)}
                className="px-3 py-1.5 rounded-lg bg-white/15 text-white/85 text-xs font-medium hover:bg-white/25 active:scale-[0.96] transition-all backdrop-blur-sm"
                aria-label={`Искать: ${hint}`}
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Категории — плитки с иконками ─────────────────────────────── */}
      {topCategories.length > 0 && (
        <motion.section {...sectionAnim(0.08)} aria-labelledby="market-cats-title">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="market-cats-title" className="market-section-title">Категории</h2>
            <Link to="/market/catalog" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-brand-hover transition-colors min-h-[44px] -my-2 px-1">
              Весь каталог <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="market-scroller sm:grid sm:grid-cols-4 lg:grid-cols-5 sm:overflow-visible pb-1 -mb-1">
            {topCategories.map(cat => {
              const Icon = categoryIcon(cat.name)
              return (
                <Link
                  key={cat.id}
                  to={`/market/catalog?categoryId=${encodeURIComponent(cat.id)}`}
                  className="market-cat-tile w-[120px] sm:w-auto"
                  aria-label={`${cat.name}${cat.count > 0 ? `, ${cat.count} товаров` : ''}`}
                >
                  <span className="icon-tile">
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </span>
                  <span className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{cat.name}</span>
                  {cat.count > 0 && (
                    <span className="text-[10px] font-bold text-gray-400">{cat.count}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </motion.section>
      )}

      {/* ── Марки авто — чипы ─────────────────────────────────────────── */}
      {topMakes.length > 0 && (
        <motion.section {...sectionAnim(0.12)} aria-labelledby="market-makes-title">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="market-makes-title" className="market-section-title">Марки авто</h2>
            <Link to="/market/catalog" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-brand-hover transition-colors min-h-[44px] -my-2 px-1">
              Все марки <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="market-scroller sm:flex-wrap pb-1 -mb-1">
            {topMakes.map(make => (
              <Link
                key={make}
                to={`/market/catalog?make=${encodeURIComponent(make)}`}
                className="chip hover:border-primary/60 hover:text-primary min-h-[40px]"
              >
                <Car className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} aria-hidden="true" />
                {make}
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Свежие поступления ───────────────────────────────────────── */}
      <motion.section {...sectionAnim(0.16)} aria-labelledby="market-fresh-title">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="market-fresh-title" className="market-section-title">Свежие поступления</h2>
          <Link to="/market/catalog" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-brand-hover transition-colors min-h-[44px] -my-2 px-1">
            Весь каталог <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {freshLoading ? (
          <div className="market-grid">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (fresh?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Package}
            title="Пока нет товаров"
            description="Разборки ещё не добавили запчасти в каталог — загляните позже"
          />
        ) : (
          <div className="market-grid stagger-children">
            {fresh!.items.map(part => <MarketProductCard key={part.id} part={part} />)}
          </div>
        )}
      </motion.section>

      {/* ── Разборки ─────────────────────────────────────────────────── */}
      <motion.section {...sectionAnim(0.2)} aria-labelledby="market-suppliers-title">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="market-suppliers-title" className="market-section-title">Разборки</h2>
          <Link to="/market/suppliers" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-brand-hover transition-colors min-h-[44px] -my-2 px-1">
            Все разборки <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {suppliersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonSupplierCard key={i} />)}
          </div>
        ) : topSuppliers.length === 0 ? (
          <EmptyState icon={Store} title="Разборок пока нет" description="Скоро здесь появятся продавцы запчастей" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 stagger-children">
            {topSuppliers.map(s => <SupplierCard key={s.id} supplier={s} />)}
          </div>
        )}
      </motion.section>

      {/* ── CTA-баннер ───────────────────────────────────────────────── */}
      <motion.section {...sectionAnim(0.24)}>
        <div className="rounded-2xl bg-gray-900 px-6 py-7 sm:px-8 sm:py-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <span className="icon-tile-lg bg-primary/20 text-primary-foreground flex-shrink-0" style={{ color: 'var(--brand-400)' }}>
            <Sparkles className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-base font-bold text-white leading-snug">
              Вы авторазборка? Разместите витрину на маркете
            </p>
            <p className="text-sm text-gray-300 mt-0.5">
              Ознакомьтесь с предложением и тарифами для разборок
            </p>
          </div>
          <Link to="/business" className="btn-primary btn-lg flex-shrink-0 whitespace-nowrap">
            Наше предложение
          </Link>
        </div>
      </motion.section>
    </div>
  )
}

export default MarketHome
