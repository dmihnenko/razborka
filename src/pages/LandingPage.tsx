import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BRAND } from '@/config/brand'
import {
  Wrench, Car, Package, Users, BarChart3, ShieldCheck,
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
  { icon: ShieldCheck, title: 'Безопасно',   desc: 'Supabase RLS — каждая компания видит только свои данные', color: 'bg-blue-50 text-blue-600' },
  { icon: Smartphone,  title: 'Мобильный',   desc: 'PWA — работает как приложение на iOS и Android',          color: 'bg-green-50 text-green-600' },
  { icon: BarChart3,   title: 'Аналитика',   desc: 'Графики доходов, статистика по клиентам и услугам',       color: 'bg-purple-50 text-purple-600' },
  { icon: Users,       title: 'Мультироль',  desc: 'Администратор, менеджер, механик — у каждого свой доступ', color: 'bg-orange-50 text-orange-600' },
]

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
}
const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: '#080C14', fontFamily: "'Manrope Variable', 'Inter', system-ui, sans-serif" }}
    >

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40"
        style={{
          borderBottom: '1px solid rgba(59,130,246,0.1)',
          background: 'rgba(8,12,20,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-xl"
              style={{ background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)', boxShadow: '0 2px 8px -2px rgba(37,99,235,0.55)' }}
            >
              <Wrench size={15} color="white" strokeWidth={2} />
            </div>
            <span
              className="font-extrabold tracking-tight"
              style={{ color: '#F1F5F9', fontSize: '17px', letterSpacing: '-0.02em' }}
            >
              {BRAND.wordmark.lead}<span style={{ color: '#3B82F6' }}>{BRAND.wordmark.accent}</span>
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/market')}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200 active:scale-[0.97]"
              style={{ color: '#94A3B8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <Package size={14} strokeWidth={1.5} /> Каталог
            </button>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all duration-200 active:scale-[0.97]"
              style={{
                background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)',
                boxShadow: '0 1px 2px rgba(37,99,235,0.35), 0 4px 12px -2px rgba(37,99,235,0.35)',
                border: 'none',
              }}
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
        {/* Grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(59,130,246,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.07) 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-220px', left: '50%', transform: 'translateX(-50%)',
            width: '860px', height: '640px', borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(37,99,235,0.15) 0%,transparent 65%)',
          }}
        />
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom,transparent,#080C14)' }}
        />

        <motion.div
          className="relative mx-auto max-w-3xl text-center"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* Pill badge */}
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-8">
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(37,99,235,0.13)',
                border: '1px solid rgba(37,99,235,0.28)',
                color: '#93C5FD',
                letterSpacing: '0.02em',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: '#3B82F6', boxShadow: '0 0 6px #3B82F6' }}
              />
              CRM для автобизнеса
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-extrabold mb-6"
            style={{
              fontSize: 'clamp(42px,7.5vw,84px)',
              lineHeight: '1.0',
              letterSpacing: '-0.035em',
              color: '#F1F5F9',
            }}
          >
            Управляй<br />
            <span className="text-gradient-brand">авто</span>бизнесом<br />
            умно
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="mx-auto mb-10 leading-relaxed"
            style={{ color: '#64748B', fontSize: 'clamp(15px,2vw,17px)', maxWidth: '520px' }}
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
              className="inline-flex items-center justify-center gap-2 font-semibold text-white text-sm rounded-xl px-7 py-3.5 active:scale-[0.97] transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg,#3B82F6 0%,#2563EB 55%,#1D4ED8 100%)',
                boxShadow: '0 2px 4px rgba(37,99,235,0.35),0 8px 20px -4px rgba(37,99,235,0.5)',
                minWidth: 'min(240px,80vw)',
                border: 'none',
              }}
            >
              Начать работу <ArrowRight size={16} strokeWidth={2} />
            </button>
            <button
              onClick={() => navigate('/market')}
              className="inline-flex items-center justify-center gap-2 font-semibold text-sm rounded-xl px-7 py-3.5 active:scale-[0.97] transition-all duration-200"
              style={{
                color: '#CBD5E1',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                minWidth: 'min(240px,80vw)',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)' }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
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
          <div
            className="sm:col-span-2 lg:col-span-1 rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: 'linear-gradient(135deg,rgba(21,128,61,0.12) 0%,rgba(15,23,42,0.7) 100%)',
              border: '1px solid rgba(34,197,94,0.18)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(21,128,61,0.2)', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <Package size={20} color="#4ADE80" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-extrabold text-base" style={{ color: '#F1F5F9', letterSpacing: '-0.02em' }}>Авторазборка</div>
                <div className="text-xs" style={{ color: '#475569' }}>Учёт запчастей и продаж</div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {FEATURES_PARTS.map(f => (
                <div key={f} className="flex items-center gap-2.5">
                  <CheckCircle size={14} strokeWidth={2} style={{ color: '#4ADE80', flexShrink: 0 }} />
                  <span className="text-sm font-medium" style={{ color: '#CBD5E1' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Личные авто */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{
              background: 'linear-gradient(135deg,rgba(30,64,175,0.15) 0%,rgba(15,23,42,0.7) 100%)',
              border: '1px solid rgba(59,130,246,0.18)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(59,130,246,0.25)' }}
              >
                <Car size={20} color="#60A5FA" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-extrabold text-base" style={{ color: '#F1F5F9', letterSpacing: '-0.02em' }}>Личные авто</div>
                <div className="text-xs" style={{ color: '#475569' }}>Учёт автомобилей владельцев</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
              Ведите историю ТО, ремонтов и расходов по каждому автомобилю. Клиент видит свой
              профиль через публичную ссылку.
            </p>
          </div>

          {/* Маркетплейс */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-4"
            style={{
              background: 'linear-gradient(135deg,rgba(88,28,135,0.15) 0%,rgba(15,23,42,0.7) 100%)',
              border: '1px solid rgba(139,92,246,0.18)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.25)' }}
              >
                <Zap size={20} color="#C084FC" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-extrabold text-base" style={{ color: '#F1F5F9', letterSpacing: '-0.02em' }}>Маркетплейс</div>
                <div className="text-xs" style={{ color: '#475569' }}>Публичный каталог</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
              Публикуйте запчасти в общем каталоге — покупатели найдут нужную деталь без регистрации.
            </p>
            <button
              onClick={() => navigate('/market')}
              className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold transition-colors duration-150"
              style={{ color: '#C084FC', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 'fit-content' }}
            >
              Открыть каталог <ArrowRight size={13} strokeWidth={2} />
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
          className="font-extrabold text-center mb-8"
          style={{ color: '#F1F5F9', fontSize: 'clamp(22px,4vw,32px)', letterSpacing: '-0.03em' }}
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
          {HIGHLIGHTS.map(({ icon: Icon, title, desc, color }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(59,130,246,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59,130,246,0.18)' }}
              onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)' }}
            >
              <div className={`icon-tile ${color}`}>
                <Icon size={18} strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-bold text-sm mb-1" style={{ color: '#F1F5F9' }}>{title}</div>
                <div className="text-xs leading-relaxed" style={{ color: '#475569' }}>{desc}</div>
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
          className="mx-auto max-w-xl text-center rounded-3xl p-10 sm:p-14 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg,rgba(30,58,95,0.45) 0%,rgba(15,23,42,0.7) 100%)',
            border: '1px solid rgba(59,130,246,0.2)',
          }}
        >
          {/* Subtle glow behind card */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 0%,rgba(37,99,235,0.1) 0%,transparent 70%)' }}
          />

          <div className="relative">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)',
                boxShadow: '0 4px 16px -4px rgba(37,99,235,0.6)',
              }}
            >
              <Car size={26} color="white" strokeWidth={1.5} />
            </div>

            <h2
              className="font-extrabold mb-3"
              style={{ color: '#F1F5F9', fontSize: 'clamp(22px,4vw,30px)', letterSpacing: '-0.03em' }}
            >
              Готовы начать?
            </h2>
            <p className="mb-8 leading-relaxed" style={{ color: '#64748B', fontSize: '15px' }}>
              Войдите в систему и начните управлять своим автобизнесом прямо сейчас.
            </p>

            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center gap-2 text-white font-semibold rounded-xl px-8 py-3.5 active:scale-[0.97] transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg,#3B82F6 0%,#2563EB 55%,#1D4ED8 100%)',
                boxShadow: '0 2px 4px rgba(37,99,235,0.35),0 8px 24px -4px rgba(37,99,235,0.55)',
                border: 'none',
                minWidth: 'min(220px,80vw)',
                fontSize: '15px',
              }}
            >
              Войти в {BRAND.name} <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer
        className="mt-auto py-6 px-4 text-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="inline-flex items-center gap-2 mb-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg,#3B82F6 0%,#2563EB 100%)' }}
          >
            <Wrench size={11} color="white" strokeWidth={2} />
          </div>
          <span className="font-extrabold text-xs tracking-tight" style={{ color: '#334155', letterSpacing: '-0.01em' }}>{BRAND.name}</span>
        </div>
        <p className="text-xs" style={{ color: '#1E293B' }}>Система управления для авторазборки</p>
      </footer>

    </div>
  )
}
