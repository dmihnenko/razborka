import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Package, Store, Boxes, Car, Lightbulb, Armchair, ShieldCheck, Wrench, CircleDot, Disc, Cog, BatteryCharging, Zap, Snowflake, Fuel, type LucideIcon } from 'lucide-react'
import {
  getMarketCategories, getMarketParts, getMarketSuppliers, marketCategoryName,
} from '@/services/marketplaceService'
import { MarketProductCard } from '@/components/market/MarketProductCard'
import { SupplierCard } from '@/components/market/SupplierCard'
import EmptyState from '@/components/ui/EmptyState'
import { usePageMeta } from '@/hooks/usePageMeta'
import { CarPicker } from '@/components/market/CarPicker'

// ============================================================================
// Главная маркета (/market) — Graphite. Чистый монохром, акцент сдержанный.
// ============================================================================

const FRESH_PAGE_SIZE = 12
const MIN_CATEGORIES = 4

/** Иконки разделов по slug (lucide); неизвестный slug -> Boxes */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  kuzov: Car,
  optika: Lightbulb,
  salon: Armchair,
  bezopasnost: ShieldCheck,
  podveska: Wrench,
  tormoza: CircleDot,
  kolesa: Disc,
  dvigatel: Cog,
  batareya: BatteryCharging,
  elektrika: Zap,
  klimat: Snowflake,
  vyhlop: Fuel,
}
const MAX_SUPPLIERS = 6

function SectionHead({ title, to, linkLabel, id }: { title: string; to: string; linkLabel: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 id={id} className="mk-title">{title}</h2>
      <Link to={to} className="inline-flex items-center gap-1 text-sm mk-link min-h-[44px] -my-2 px-1">
        {linkLabel}<ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="mk-card overflow-hidden" aria-hidden="true">
      <div className="aspect-square" style={{ background: 'var(--mk-surface-2)' }} />
      <div className="p-3 space-y-2.5">
        <div className="h-3.5 rounded-lg w-3/4" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="h-3 rounded-lg w-1/2" style={{ background: 'var(--mk-surface-2)' }} />
        <div className="h-9 rounded-lg w-full mt-2" style={{ background: 'var(--mk-surface-2)' }} />
      </div>
    </div>
  )
}

export function MarketHome() {
  const { t, i18n } = useTranslation('market')
  usePageMeta(
    'Razborka.net — маркет б/у и новых запчастей от авторазборок',
    'Купить б/у и новые автозапчасти от проверенных авторазборок Украины. Каталог по марке, модели и году, прямой контакт с разборкой.',
  )
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
  const { data: categories = [] } = useQuery({ queryKey: ['market', 'categories'], queryFn: getMarketCategories, staleTime: 5 * 60_000 })
  const { data: suppliers, isLoading: suppliersLoading } = useQuery({ queryKey: ['market', 'suppliers'], queryFn: getMarketSuppliers, staleTime: 5 * 60_000 })

  // Блок категорий — только когда есть минимум 4 категории с товарами (фильтр ?category= работает в каталоге)
  const shownCategories = categories.filter(c => c.count > 0)
  const topSuppliers = (suppliers ?? []).slice(0, MAX_SUPPLIERS)

  return (
    <div className="space-y-6 sm:space-y-8">

      <motion.section {...anim(0)}>
        <h1 className="mk-h1">{t('home.h1')}</h1>
      </motion.section>

      <motion.div {...anim(0.06)}>
        <CarPicker />
      </motion.div>

      {shownCategories.length >= MIN_CATEGORIES && (
        <motion.section {...anim(0.12)} aria-labelledby="mk-cats-title">
          <SectionHead id="mk-cats-title" title={t('home.categories')} to="/market/catalog" linkLabel={t('home.allCategories')} />
          <div className="mk-scroller sm:flex-wrap pb-1 -mb-1">
            {shownCategories.map(c => {
              const Icon = CATEGORY_ICONS[c.slug] ?? Boxes
              return (
                <Link key={c.slug} to={`/market/catalog/${encodeURIComponent(c.slug)}`} className="mk-chip">
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />{marketCategoryName(c, i18n.language)}
                </Link>
              )
            })}
          </div>
        </motion.section>
      )}

      {/* ── Свежие поступления ───────────────────────────────────────── */}
      <motion.section {...anim(0.16)} aria-labelledby="mk-fresh-title">
        <SectionHead id="mk-fresh-title" title={t('home.fresh')} to="/market/catalog" linkLabel={t('home.wholeCatalog')} />
        {freshLoading ? (
          <div className="mk-grid">{Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : (fresh?.items.length ?? 0) === 0 ? (
          <EmptyState icon={Package} title={t('home.freshEmptyTitle')} description={t('home.freshEmptyText')} />
        ) : (
          <div className="mk-grid">{fresh!.items.map(part => <MarketProductCard key={part.id} part={part} />)}</div>
        )}
      </motion.section>

      {/* ── Разборки ─────────────────────────────────────────────────── */}
      <motion.section {...anim(0.2)} aria-labelledby="mk-suppliers-title">
        <SectionHead id="mk-suppliers-title" title={t('home.suppliers')} to="/market/suppliers" linkLabel={t('home.allSuppliers')} />
        {suppliersLoading ? (
          <div className="mk-grid-wide">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="mk-card h-24" aria-hidden="true" />)}</div>
        ) : topSuppliers.length === 0 ? (
          <EmptyState icon={Store} title={t('home.suppliersEmptyTitle')} description={t('home.suppliersEmptyText')} />
        ) : (
          <div className="mk-grid-wide">{topSuppliers.map(s => <SupplierCard key={s.id} supplier={s} />)}</div>
        )}
      </motion.section>

      {/* ── CTA — сдержанный ─────────────────────────────────────────── */}
      <motion.section {...anim(0.24)}>
        <div className="mk-card p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: 'var(--mk-text)' }}>{t('home.ctaTitle')}</p>
            <p className="mk-sub mt-0.5">{t('home.ctaText')}</p>
          </div>
          <Link to="/business" className="mk-btn mk-btn-accent mk-btn-lg flex-shrink-0">{t('home.ctaBtn')}</Link>
        </div>
      </motion.section>
    </div>
  )
}

export default MarketHome
