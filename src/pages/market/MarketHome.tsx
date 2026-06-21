import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Car, Package, Search, Store } from 'lucide-react'
import {
  getMarketMakes, getMarketParts, getMarketSuppliers,
} from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { SupplierCard } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'

// ============================================================================
// Главная маркета (/market) — Graphite. Чистый монохром, акцент сдержанный.
// ============================================================================

const FRESH_PAGE_SIZE = 12
const MAX_MAKES = 12
const MAX_SUPPLIERS = 6

function SectionHead({ title, to, linkLabel, id }: { title: string; to: string; linkLabel: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 id={id} className="mk-title">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-1 text-sm mk-link min-h-[44px] -my-2 px-1">
        {linkLabel} <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </div>
  )
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

export function MarketHome() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const reduce = useReducedMotion()
  const anim = (delay: number) => reduce ? {} : {
    initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const, delay },
  }

  const { data: fresh, isLoading: freshLoading } = useQuery({
    queryKey: ['market', 'parts', { sort: 'new', pageSize: FRESH_PAGE_SIZE }],
    queryFn: () => getMarketParts({ sort: 'new', pageSize: FRESH_PAGE_SIZE }),
    staleTime: 60_000,
  })
  const { data: makes = [] } = useQuery({ queryKey: ['market', 'makes'], queryFn: getMarketMakes, staleTime: 5 * 60_000 })
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({ queryKey: ['market', 'suppliers'], queryFn: getMarketSuppliers, staleTime: 5 * 60_000 })

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = search.trim()
    navigate(q ? `/market/catalog?search=${encodeURIComponent(q)}` : '/market/catalog')
  }

  const topMakes = makes.slice(0, MAX_MAKES)
  const topSuppliers = (suppliers ?? []).slice(0, MAX_SUPPLIERS)

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* ── Герой: чистая панель, акцент только на кнопке ─────────────── */}
      <motion.section {...anim(0)} className="mk-card p-5 sm:p-8 text-center">
        <form onSubmit={handleSearch} role="search" className="max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none mk-meta" strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Название запчасти или артикул…"
                className="mk-input mk-search !min-h-[var(--mk-control-h-lg)]" aria-label="Поиск по каталогу запчастей"
              />
            </div>
            <button type="submit" className="mk-btn mk-btn-accent mk-btn-lg flex-shrink-0">Найти</button>
          </div>
        </form>
      </motion.section>

      {/* ── Марки авто — чипы ─────────────────────────────────────────── */}
      {topMakes.length > 0 && (
        <motion.section {...anim(0.12)} aria-labelledby="mk-makes-title">
          <SectionHead id="mk-makes-title" title="Марки авто" to="/market/catalog" linkLabel="Все марки" />
          <div className="mk-scroller sm:flex-wrap pb-1 -mb-1">
            {topMakes.map(make => (
              <Link key={make} to={`/market/catalog?make=${encodeURIComponent(make)}`} className="mk-chip">
                <Car className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" /> {make}
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Свежие поступления ───────────────────────────────────────── */}
      <motion.section {...anim(0.16)} aria-labelledby="mk-fresh-title">
        <SectionHead id="mk-fresh-title" title="Свежие поступления" to="/market/catalog" linkLabel="Весь каталог" />
        {freshLoading ? (
          <div className="mk-grid">{Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (fresh?.items.length ?? 0) === 0 ? (
          <EmptyState icon={Package} title="Пока нет товаров" description="Разборки ещё не добавили запчасти в каталог — загляните позже" />
        ) : (
          <div className="mk-grid">{fresh!.items.map(part => <MarketProductCard key={part.id} part={part} />)}</div>
        )}
      </motion.section>

      {/* ── Разборки ─────────────────────────────────────────────────── */}
      <motion.section {...anim(0.2)} aria-labelledby="mk-suppliers-title">
        <SectionHead id="mk-suppliers-title" title="Разборки" to="/market/suppliers" linkLabel="Все разборки" />
        {suppliersLoading ? (
          <div className="mk-grid-wide">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="mk-card h-24" aria-hidden="true" />)}</div>
        ) : topSuppliers.length === 0 ? (
          <EmptyState icon={Store} title="Разборок пока нет" description="Скоро здесь появятся продавцы запчастей" />
        ) : (
          <div className="mk-grid-wide">{topSuppliers.map(s => <SupplierCard key={s.id} supplier={s} />)}</div>
        )}
      </motion.section>

      {/* ── CTA — сдержанный ─────────────────────────────────────────── */}
      <motion.section {...anim(0.24)}>
        <div className="mk-card p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: 'var(--mk-text)' }}>Вы авторазборка? Разместите витрину на маркете</p>
            <p className="mk-sub mt-0.5">Ознакомьтесь с предложением и тарифами для разборок</p>
          </div>
          <Link to="/business" className="mk-btn mk-btn-accent mk-btn-lg flex-shrink-0">Наше предложение</Link>
        </div>
      </motion.section>
    </div>
  )
}

export default MarketHome
