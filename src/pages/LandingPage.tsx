import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { BRAND } from '@/config/brand'
import { Logo } from '@/components/brand/Logo'
import { usePageMeta } from '@/hooks/usePageMeta'
import {
  Car, Package, Users, BarChart3, ShieldCheck,
  Smartphone, ArrowRight, CheckCircle, Zap,
} from 'lucide-react'

const FEATURES_PARTS = [
  'Автомобили на разборку',
  'Склад запчастей',
  'Каталог с ценами (UAH / USD)',
  'Заказы клиентов',
  'История продаж',
  'Публичный профиль клиента',
]

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Безопасно',  desc: 'Supabase RLS — каждая компания видит только свои данные' },
  { icon: Smartphone,  title: 'Мобильный',  desc: 'PWA — работает как приложение на iOS и Android' },
  { icon: BarChart3,   title: 'Аналитика',  desc: 'Графики доходов, статистика по клиентам и услугам' },
  { icon: Users,       title: 'Мультироль', desc: 'Администратор, менеджер, механик — у каждого свой доступ' },
]

const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
}
const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.07 } },
}

export default function LandingPage() {
  const navigate = useNavigate()
  usePageMeta(
    'Razborka.net — учёт авторазборки и маркет автозапчастей',
    'Razborka.net: учёт склада авторазборки, витрина запчастей и маркет б/у и новых автозапчастей от проверенных разборок Украины.',
  )

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--cab-bg)', fontFamily: 'var(--font-sans)' }}
    >

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <Logo size="sm" withText className="flex-shrink-0" />

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/market')}
              className="hidden sm:inline-flex btn-secondary"
            >
              <Package size={14} strokeWidth={1.5} /> Каталог
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary"
            >
              Войти
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden flex-shrink-0"
        style={{ padding: 'clamp(72px,10vw,112px) 16px clamp(60px,8vw,88px)' }}
      >
        {/* Grid pattern (нежный индиго) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(53,56,205,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(53,56,205,0.05) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          aria-hidden="true"
        />
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-220px', left: '50%', transform: 'translateX(-50%)',
            width: '860px', height: '640px', borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(53,56,205,0.08) 0%,transparent 65%)',
          }}
          aria-hidden="true"
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom,transparent,var(--cab-bg))' }}
          aria-hidden="true"
        />

        <motion.div
          className="relative mx-auto max-w-3xl text-center"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* Pill badge */}
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--cab-signal)]" />
              CRM для автобизнеса
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-extrabold mb-6 text-gray-900"
            style={{
              fontSize: 'clamp(42px,7.5vw,84px)',
              lineHeight: '1.0',
              letterSpacing: '-0.035em',
            }}
          >
            Управляй<br />
            <span className="text-gradient-brand">авто</span>бизнесом<br />
            умно
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="mx-auto mb-10 leading-relaxed text-gray-600"
            style={{ fontSize: 'clamp(15px,2vw,17px)', maxWidth: '520px' }}
          >
            Полная система управления для авторазборки.
            Автомобили на разборку, склад запчастей, заказы клиентов — всё в одном месте.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap"
          >
            <button
              onClick={() => navigate('/login')}
              className="btn-primary btn-lg"
              style={{ minWidth: 'min(240px,80vw)' }}
            >
              Начать работу <ArrowRight size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => navigate('/market')}
              className="btn-secondary btn-lg"
              style={{ minWidth: 'min(240px,80vw)' }}
            >
              <Package size={16} strokeWidth={1.5} /> Каталог запчастей
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── TWO SYSTEMS ─────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-16 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {/* Авторазборка */}
          <div className="card sm:col-span-2 lg:col-span-1 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="icon-tile bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
                <Package size={20} strokeWidth={1.5} />
              </span>
              <div>
                <div className="font-extrabold text-base text-gray-900" style={{ letterSpacing: '-0.02em' }}>Авторазборка</div>
                <div className="text-xs text-gray-500">Учёт запчастей и продаж</div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {FEATURES_PARTS.map(f => (
                <div key={f} className="flex items-center gap-2.5">
                  <CheckCircle size={14} strokeWidth={1.5} className="text-[var(--cab-signal)] flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Личные авто */}
          <div className="card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="icon-tile bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
                <Car size={20} strokeWidth={1.5} />
              </span>
              <div>
                <div className="font-extrabold text-base text-gray-900" style={{ letterSpacing: '-0.02em' }}>Личные авто</div>
                <div className="text-xs text-gray-500">Учёт автомобилей владельцев</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">
              Ведите историю ТО, ремонтов и расходов по каждому автомобилю. Клиент видит свой
              профиль через публичную ссылку.
            </p>
          </div>

          {/* Маркетплейс */}
          <div className="card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="icon-tile bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
                <Zap size={20} strokeWidth={1.5} />
              </span>
              <div>
                <div className="font-extrabold text-base text-gray-900" style={{ letterSpacing: '-0.02em' }}>Маркетплейс</div>
                <div className="text-xs text-gray-500">Публичный каталог</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">
              Публикуйте запчасти в общем каталоге — покупатели найдут нужную деталь без регистрации.
            </p>
            <button
              onClick={() => navigate('/market')}
              className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-[var(--cab-signal)] hover:text-[var(--cab-signal-hover)] transition-colors duration-150 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              style={{ width: 'fit-content', minHeight: '28px' }}
            >
              Открыть каталог <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── HIGHLIGHTS ──────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-20 mx-auto w-full max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="font-extrabold text-center mb-8 text-gray-900"
          style={{ fontSize: 'clamp(22px,4vw,32px)', letterSpacing: '-0.03em' }}
        >
          Почему <span className="text-gradient-brand">{BRAND.name}</span>
        </motion.h2>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="card card-interactive flex flex-col gap-3"
            >
              <span className="icon-tile bg-[var(--cab-signal-weak)] text-[var(--cab-signal)]">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <div>
                <div className="font-bold text-sm mb-1 text-gray-900">{title}</div>
                <div className="text-xs leading-relaxed text-gray-600">{desc}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="cab-card mx-auto max-w-xl text-center relative overflow-hidden p-10 sm:p-14"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'var(--brand-gradient)', boxShadow: '0 4px 16px -4px rgba(53,56,205,0.45)' }}
          >
            <Car size={26} color="white" strokeWidth={1.5} />
          </div>

          <h2
            className="font-extrabold mb-3 text-gray-900"
            style={{ fontSize: 'clamp(22px,4vw,30px)', letterSpacing: '-0.03em' }}
          >
            Готовы начать?
          </h2>
          <p className="mb-8 leading-relaxed text-gray-600" style={{ fontSize: '15px' }}>
            Войдите в систему и начните управлять своим автобизнесом прямо сейчас.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="btn-primary btn-lg"
            style={{ minWidth: 'min(220px,80vw)' }}
          >
            Войти в {BRAND.name} <ArrowRight size={16} strokeWidth={1.5} />
          </button>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="mt-auto py-6 px-4 text-center border-t border-gray-200">
        <div className="inline-flex items-center gap-2 mb-2">
          <Logo size="sm" withText={false} className="[&>svg]:!w-5 [&>svg]:!h-5" />
          <span className="font-extrabold text-xs tracking-tight text-gray-900" style={{ letterSpacing: '-0.01em' }}>{BRAND.name}</span>
        </div>
        <p className="text-xs text-gray-500">Система управления для авторазборки</p>
      </footer>

    </div>
  )
}
