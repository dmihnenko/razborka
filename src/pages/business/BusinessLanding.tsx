import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Car,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
  Warehouse,
  Zap,
} from 'lucide-react'
import { getPublicTariffs } from '@/services/businessService'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/utils/currency'
import { Logo } from '@/components/brand/Logo'
import { usePageMeta } from '@/hooks/usePageMeta'
import type { Tariff } from '@/types/business'
import { DEMO_LIMITS } from '@/types/business'

// ============================================================================
// BusinessLanding — публичный лендинг авторазборок (/business)
// ============================================================================

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const FADE_UP = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE, delay },
})

// ── Преимущества ─────────────────────────────────────────────────────────────
// Ink & Signal: единый монохром + индиго-сигнал (без радужной палитры).
const FEATURES = [
  { icon: Car, key: 'vehicles' },
  { icon: Package, key: 'parts' },
  { icon: ShoppingBag, key: 'marketplace' },
  { icon: Users, key: 'clients' },
  { icon: Warehouse, key: 'warehouse' },
  { icon: DollarSign, key: 'currency' },
] as const

// ── Тарифная карточка ─────────────────────────────────────────────────────────
function TariffCard({
  tariff,
  recommended,
  onApply,
}: {
  tariff: Tariff
  recommended?: boolean
  onApply: () => void
}) {
  const { t } = useTranslation('business')
  return (
    <div
      className={`card flex flex-col relative overflow-hidden transition-all duration-200 hover-lift ${
        recommended ? 'border-primary/40 ring-2 ring-primary/20' : ''
      }`}
    >
      {recommended && (
        <div className="absolute top-0 right-0">
          <div className="text-[10px] font-bold text-white px-3 py-1 rounded-bl-xl bg-[var(--cab-signal)]">
            {t('landing.tariffRecommended')}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4">
        <div>
          <p className="text-base font-bold text-gray-900">{tariff.name}</p>
          {tariff.description && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tariff.description}</p>
          )}
        </div>

        <div>
          <span className="text-2xl font-extrabold text-gray-900 tracking-tight">
            {tariff.isCustom ? (
              <span className="text-gradient-brand">{t('landing.tariffContactUs')}</span>
            ) : (
              formatPrice(tariff.price)
            )}
          </span>
          {!tariff.isCustom && (
            <span className="text-sm text-gray-400 ml-1">{t('landing.tariffPerMonth')}</span>
          )}
        </div>

        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <Car className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
            {tariff.maxVehicles === null
              ? t('landing.tariffVehiclesUnlimited')
              : t('landing.tariffVehiclesUpTo', { count: tariff.maxVehicles })}
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
            {tariff.maxParts === null
              ? t('landing.tariffPartsUnlimited')
              : t('landing.tariffPartsUpTo', { count: tariff.maxParts })}
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
            {tariff.maxWorkers === null
              ? t('landing.tariffWorkersUnlimited')
              : t('landing.tariffWorkersUpTo', { count: tariff.maxWorkers })}
          </li>
          {tariff.hasAnalytics && (
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <BarChart3 className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
              <span className="badge" style={{ background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)' }}>{t('landing.tariffAnalytics')}</span>
            </li>
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={onApply}
        className={`mt-5 w-full ${recommended ? 'btn-primary' : 'btn-secondary'}`}
      >
        {t('landing.applyBtn')}
        <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>
  )
}

// ── Skeleton карточки тарифа ──────────────────────────────────────────────────
function TariffSkeleton() {
  return (
    <div className="card space-y-4">
      <div className="h-5 animate-shimmer rounded-lg w-1/2" />
      <div className="h-8 animate-shimmer rounded-lg w-2/3" />
      <div className="space-y-2.5">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-4 animate-shimmer rounded-lg" />
        ))}
      </div>
      <div className="h-10 animate-shimmer rounded-xl mt-2" />
    </div>
  )
}

// ── Главный компонент ─────────────────────────────────────────────────────────
export function BusinessLanding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation('business')
  usePageMeta(
    'Для авторазборок — Razborka.net',
    'Подключите авторазборку к Razborka.net: учёт склада, витрина запчастей, заявки покупателей.',
  )

  // Открывать лендинг всегда сверху (React Router не сбрасывает скролл при переходе
  // с маркета, иначе попадаешь в середину страницы — на тарифы).
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const { data: tariffs = [], isLoading: tariffsLoading } = useQuery({
    queryKey: ['publicTariffs'],
    queryFn: getPublicTariffs,
    staleTime: 5 * 60_000,
  })

  const handleApply = () => {
    if (user) {
      navigate('/business/apply')
    } else {
      navigate('/login?next=/business/apply')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/business')
  }

  // Тариф Пакет 3 — рекомендованный (3й по sort_order среди не-custom)
  const recommendedId = tariffs.filter(t => !t.isCustom)[2]?.id

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--cab-bg)' }}>

      {/* ── Шапка ────────────────────────────────────────────────────── */}
      <header className="bg-white/85 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[60px]">
            <Link to="/business">
              <Logo size="sm" withText />
            </Link>
            <nav className="flex items-center gap-1.5 sm:gap-2">
              <Link to="/market" className="btn-secondary btn-sm">
                {t('landing.navMarket')}
              </Link>
              {user ? (
                <button type="button" onClick={handleLogout} className="btn-secondary btn-sm">
                  {t('landing.navLogout')}
                </button>
              ) : (
                <Link to="/login" className="btn-primary btn-sm">
                  {t('landing.navLogin')}
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <motion.section
          {...FADE_UP(0)}
          className="relative overflow-hidden"
        >
          {/* Нежная индиго grid-сетка (как на LandingPage) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(53,56,205,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(53,56,205,0.05) 1px,transparent 1px)',
              backgroundSize: '48px 48px',
            }}
            aria-hidden="true"
          />
          {/* Плавное затухание сетки снизу */}
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom,transparent,var(--cab-bg))' }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-6 bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
              {t('landing.heroBadge')}
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
              {t('landing.heroTitle1')}{' '}
              <br className="hidden sm:block" />
              <span className="text-gradient-brand">{t('landing.heroTitle2')}</span>
            </h1>

            <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {t('landing.heroSubtitle')}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleApply}
                className="btn-primary btn-lg"
              >
                {t('landing.applyBtn')}
                <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <a
                href="#tariffs"
                className="btn-secondary btn-lg"
              >
                {t('landing.heroSeeTariffs')}
              </a>
            </div>

            {/* Демо-режим тизер */}
            <div className="mt-8 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
              {t('landing.heroDemoTeaser', { vehicles: DEMO_LIMITS.vehicles, parts: DEMO_LIMITS.parts })}
            </div>
          </div>
        </motion.section>

        {/* ── Преимущества ────────────────────────────────────────────── */}
        <motion.section
          {...FADE_UP(0.1)}
          className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20"
          aria-label={t('landing.featuresAria')}
        >
          <div className="text-center mb-10">
            <h2 className="heading-2">{t('landing.featuresTitle')}</h2>
            <p className="page-subtitle mt-2">
              {t('landing.featuresSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 stagger-children">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key} className="card flex gap-4">
                <span className="icon-tile-lg flex-shrink-0 bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">{t(`landing.feature_${key}_title`)}</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{t(`landing.feature_${key}_desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Тарифы ────────────────────────────────────────────────── */}
        <section
          id="tariffs"
          className="bg-white border-y border-gray-100 py-14 sm:py-20"
        >
          <motion.div
            {...FADE_UP(0.05)}
            className="max-w-6xl mx-auto px-4 sm:px-6"
          >
            <div className="text-center mb-10">
              <h2 className="heading-2">{t('landing.tariffsTitle')}</h2>
              <p className="page-subtitle mt-2">
                {t('landing.tariffsSubtitle')}
              </p>
            </div>

            {/* Демо-блок */}
            <div className="mb-8 rounded-2xl border px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3" style={{ borderColor: 'var(--cab-border)', background: 'var(--cab-signal-weak)' }}>
              <span className="icon-tile flex-shrink-0 bg-white text-[var(--cab-signal)]">
                <Zap className="w-5 h-5" strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <p className="font-bold text-sm text-[var(--cab-signal)]">{t('landing.demoBlockTitle')}</p>
                <p className="text-xs mt-0.5 text-gray-600">
                  {t('landing.demoBlockText', {
                    vehicles: DEMO_LIMITS.vehicles,
                    parts: DEMO_LIMITS.parts,
                    workers: DEMO_LIMITS.workers,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                className="btn-primary btn-sm flex-shrink-0"
              >
                {t('landing.demoBlockBtn')}
              </button>
            </div>

            {/* Сетка тарифов */}
            {tariffsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {[1, 2, 3, 4].map(i => <TariffSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 stagger-children">
                {tariffs.map(tariff => (
                  <TariffCard
                    key={tariff.id}
                    tariff={tariff}
                    recommended={tariff.id === recommendedId}
                    onApply={handleApply}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </section>

        {/* ── CTA финальный ─────────────────────────────────────────── */}
        <motion.section
          {...FADE_UP(0.1)}
          className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center"
        >
          <h2 className="heading-2">{t('landing.ctaTitle')}</h2>
          <p className="page-subtitle mt-3 max-w-lg mx-auto">
            {t('landing.ctaSubtitle')}
          </p>
          <button
            type="button"
            onClick={handleApply}
            className="btn-primary btn-lg mt-7"
          >
            {t('landing.ctaBtn')}
            <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </motion.section>
      </main>

      {/* ── Подвал ───────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="sm" withText />
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}

export default BusinessLanding
