import { Link, useNavigate } from 'react-router-dom'
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
import { formatPrice } from '@/utils/currency'
import { Logo } from '@/components/brand/Logo'
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
const FEATURES = [
  {
    icon: Car,
    color: 'text-blue-600 bg-blue-50',
    title: 'Учёт автомобилей',
    desc: 'Добавляйте б/у авто на разборку: VIN, марка, состояние, история ремонтов — всё в одном месте.',
  },
  {
    icon: Package,
    color: 'text-orange-600 bg-orange-50',
    title: 'Склад запчастей',
    desc: 'Каталог запчастей с фото, категориями и ценами. Быстрый поиск по артикулу или названию.',
  },
  {
    icon: ShoppingBag,
    color: 'text-green-600 bg-green-50',
    title: 'Маркетплейс запчастей',
    desc: 'Ваши запчасти автоматически попадают в публичный каталог — покупатели находят их через поиск.',
  },
  {
    icon: Users,
    color: 'text-purple-600 bg-purple-50',
    title: 'Клиенты и заказы',
    desc: 'CRM для клиентов: история заказов, контакты, заявки на запчасти, статусы обработки.',
  },
  {
    icon: Warehouse,
    color: 'text-indigo-600 bg-indigo-50',
    title: 'Контроль склада',
    desc: 'Резервирование, списание, поступления. Всегда знаете, что есть в наличии и где находится.',
  },
  {
    icon: DollarSign,
    color: 'text-emerald-600 bg-emerald-50',
    title: 'Мультивалютность',
    desc: 'Цены в UAH и USD. Автоматический пересчёт по курсу — удобно для международных клиентов.',
  },
]

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
  return (
    <div
      className={`card flex flex-col relative overflow-hidden transition-all duration-200 hover-lift ${
        recommended ? 'border-primary/40 ring-2 ring-primary/20' : ''
      }`}
    >
      {recommended && (
        <div className="absolute top-0 right-0">
          <div
            className="text-[10px] font-bold text-white px-3 py-1 rounded-bl-xl"
            style={{
              background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            }}
          >
            Рекомендуем
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
              <span className="text-gradient-brand">Свяжитесь с нами</span>
            ) : (
              formatPrice(tariff.price)
            )}
          </span>
          {!tariff.isCustom && (
            <span className="text-sm text-gray-400 ml-1">/мес</span>
          )}
        </div>

        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <Car className="w-4 h-4 text-blue-500 flex-shrink-0" strokeWidth={1.5} />
            {tariff.maxVehicles === null ? 'Авто — без лимита' : `До ${tariff.maxVehicles} авто`}
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <Package className="w-4 h-4 text-orange-500 flex-shrink-0" strokeWidth={1.5} />
            {tariff.maxParts === null ? 'Запчасти — без лимита' : `До ${tariff.maxParts} запчастей`}
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <Users className="w-4 h-4 text-purple-500 flex-shrink-0" strokeWidth={1.5} />
            {tariff.maxWorkers === null ? 'Сотрудники — без лимита' : `До ${tariff.maxWorkers} сотрудников`}
          </li>
          {tariff.hasAnalytics && (
            <li className="flex items-center gap-2 text-sm text-gray-700">
              <BarChart3 className="w-4 h-4 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
              <span className="badge badge-green">Аналитика и окупаемость</span>
            </li>
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={onApply}
        className={`mt-5 w-full ${recommended ? 'btn-primary' : 'btn-secondary'}`}
      >
        Подать заявку
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

  // Тариф Пакет 3 — рекомендованный (3й по sort_order среди не-custom)
  const recommendedId = tariffs.filter(t => !t.isCustom)[2]?.id

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">

      {/* ── Шапка ────────────────────────────────────────────────────── */}
      <header className="glass border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[60px]">
            <Link to="/business">
              <Logo size="md" withText />
            </Link>
            <nav className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/market"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                Маркет
              </Link>
              <Link
                to="/login"
                className="btn-secondary btn-sm"
              >
                Войти
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <motion.section
          {...FADE_UP(0)}
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E3A6E 40%, #1E40AF 75%, #2563EB 100%)',
          }}
        >
          {/* Декоративные кружки */}
          <div
            className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 70%)' }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-0 -left-16 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold mb-6 backdrop-blur-sm">
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
              CRM-платформа для авторазборок
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Управляй разборкой{' '}
              <br className="hidden sm:block" />
              <span className="text-blue-300">умнее и быстрее</span>
            </h1>

            <p className="mt-4 text-base sm:text-lg text-blue-100/80 max-w-2xl mx-auto leading-relaxed">
              Учёт авто и запчастей, CRM для клиентов, встроенный маркетплейс — всё в одном месте.
              Начните бесплатно, без сложных настроек.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleApply}
                className="btn-primary btn-lg"
              >
                Подать заявку
                <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <a
                href="#tariffs"
                className="btn-lg inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer border border-white/25 text-white/90 hover:bg-white/10 hover:border-white/40"
              >
                Смотреть тарифы
              </a>
            </div>

            {/* Демо-режим тизер */}
            <div className="mt-8 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-3 text-sm text-white/80">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" strokeWidth={1.5} />
              Бесплатный демо-режим: {DEMO_LIMITS.vehicles} авто, {DEMO_LIMITS.parts} запчастей, +1 сотрудник
            </div>
          </div>
        </motion.section>

        {/* ── Преимущества ────────────────────────────────────────────── */}
        <motion.section
          {...FADE_UP(0.1)}
          className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20"
          aria-label="Преимущества"
        >
          <div className="text-center mb-10">
            <h2 className="heading-2">Всё для вашей разборки</h2>
            <p className="page-subtitle mt-2">
              Инструменты, которые реально нужны каждый день
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 stagger-children">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="card flex gap-4">
                <span className={`icon-tile-lg flex-shrink-0 ${color}`}>
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">{title}</p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
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
              <h2 className="heading-2">Тарифы</h2>
              <p className="page-subtitle mt-2">
                Выберите подходящий план — начните бесплатно в демо-режиме
              </p>
            </div>

            {/* Демо-блок */}
            <div className="mb-8 rounded-2xl border border-blue-200/60 bg-blue-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="icon-tile bg-blue-100 text-blue-600 flex-shrink-0">
                <Zap className="w-5 h-5" strokeWidth={1.5} />
              </span>
              <div className="flex-1">
                <p className="font-bold text-blue-800 text-sm">Бесплатный демо-режим</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  После одобрения заявки: {DEMO_LIMITS.vehicles} авто, {DEMO_LIMITS.parts} запчастей,{' '}
                  {DEMO_LIMITS.workers} сотрудника (включая вас). Без ограничений по времени.
                </p>
              </div>
              <button
                type="button"
                onClick={handleApply}
                className="btn-primary btn-sm flex-shrink-0"
              >
                Начать бесплатно
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
          <h2 className="heading-2">Готовы начать?</h2>
          <p className="page-subtitle mt-3 max-w-lg mx-auto">
            Подайте заявку — администратор рассмотрит её и создаст вашу авторазборку.
            Начните работу уже сегодня.
          </p>
          <button
            type="button"
            onClick={handleApply}
            className="btn-primary btn-lg mt-7"
          >
            Подать заявку бесплатно
            <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </motion.section>
      </main>

      {/* ── Подвал ───────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Logo size="sm" withText />
          <p className="text-xs text-gray-400">
            TSP CRM · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}

export default BusinessLanding
