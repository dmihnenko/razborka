import { Link } from 'react-router-dom'
import {
  Users, Shield, Settings, BarChart2, Building2,
  Store, CreditCard, MessageCircle, TrendingUp,
  Activity, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react'
import { useUserProfile } from '../hooks/useUserProfile'
import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '../services/adminService'

export default function AdminPanel() {
  const { data: profile } = useUserProfile()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    staleTime: 2 * 60 * 1000,
    queryFn: () => getAdminStats()
  })

  const statCards = [
    {
      label: 'Пользователей',
      value: stats?.users ?? '—',
      sub: stats ? `${stats.activeUsers} активных` : '',
      icon: Users,
      color: 'indigo',
      href: '/admin/users',
    },
    {
      label: 'СТО',
      value: stats?.stoCompanies ?? '—',
      sub: 'активных компаний',
      icon: Building2,
      color: 'blue',
      href: '/admin/sto',
    },
    {
      label: 'Разборок',
      value: stats?.partsCompanies ?? '—',
      sub: 'активных компаний',
      icon: Store,
      color: 'orange',
      href: '/admin/parts-companies',
    },
    {
      label: 'Подписок',
      value: stats?.subscriptions ?? '—',
      sub: 'активных',
      icon: CreditCard,
      color: 'emerald',
      href: '/admin/subscriptions',
    },
  ]

  const colorMap: Record<string, { icon: string; bg: string; badge: string; text: string }> = {
    indigo:  { icon: 'text-indigo-600',  bg: 'bg-indigo-50',  badge: 'bg-indigo-100 text-indigo-700',  text: 'text-indigo-600' },
    blue:    { icon: 'text-blue-600',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',      text: 'text-blue-600' },
    orange:  { icon: 'text-orange-600',  bg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700',  text: 'text-orange-600' },
    emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600' },
    purple:  { icon: 'text-purple-600',  bg: 'bg-purple-50',  badge: 'bg-purple-100 text-purple-700',  text: 'text-purple-600' },
    gray:    { icon: 'text-gray-600',    bg: 'bg-gray-100',   badge: 'bg-gray-100 text-gray-700',      text: 'text-gray-600' },
  }

  const quickLinks = [
    { name: 'Пользователи',  href: '/admin/users',           icon: Users,         color: 'indigo', desc: 'Управление аккаунтами' },
    { name: 'Роли',          href: '/admin/roles',           icon: Shield,        color: 'purple', desc: 'Права доступа' },
    { name: 'СТО',           href: '/admin/sto',             icon: Building2,     color: 'blue',   desc: 'Станции техобслуживания' },
    { name: 'Разборки',      href: '/admin/parts-companies', icon: Store,         color: 'orange', desc: 'Авторазборки' },
    { name: 'Подписки',      href: '/admin/subscriptions',   icon: CreditCard,    color: 'emerald',desc: 'Тарифы и оплаты' },
    { name: 'Поддержка',     href: '/admin/support',         icon: MessageCircle, color: 'gray',   desc: `${stats?.openTickets ?? 0} открытых` },
    { name: 'Аналитика',     href: '/admin/analytics',       icon: BarChart2,     color: 'indigo', desc: 'Статистика системы' },
    { name: 'Настройки',     href: '/admin/settings',        icon: Settings,      color: 'gray',   desc: 'Конфигурация платформы' },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Приветствие */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {greeting}, {profile?.full_name?.split(' ')[0] || 'Администратор'} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Панель управления TSP</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-xs font-semibold text-purple-700">Система работает</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(card => {
          const c = colorMap[card.color]
          const Icon = card.icon
          return (
            <Link key={card.href} to={card.href}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md hover:border-gray-200 transition-all flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${c.icon}`} strokeWidth={1.5} />
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
              </div>
              <div>
                {isLoading
                  ? <div className="h-7 w-12 bg-gray-100 rounded-lg animate-pulse mb-1" />
                  : <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
                }
                <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                {card.sub && <p className={`text-[11px] font-medium mt-1 ${c.text}`}>{card.sub}</p>}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Системные индикаторы */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">База данных</p>
            <p className="text-xs text-emerald-600">Supabase · онлайн</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <Activity className="w-5 h-5 text-blue-500 flex-shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">Edge Functions</p>
            <p className="text-xs text-blue-600">{stats ? '3 функции активны' : '—'}</p>
          </div>
        </div>
        <Link to="/admin/support"
          className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all ${
            (stats?.openTickets ?? 0) > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-100'
          }`}>
          {(stats?.openTickets ?? 0) > 0
            ? <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" strokeWidth={1.5} />
            : <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
          }
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">Поддержка</p>
            <p className={`text-xs ${(stats?.openTickets ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {stats?.openTickets ? `${stats.openTickets} требует ответа` : 'Нет открытых'}
            </p>
          </div>
        </Link>
      </div>

      {/* Quick links grid */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Разделы</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickLinks.map(link => {
            const c = colorMap[link.color]
            const Icon = link.icon
            return (
              <Link key={link.href} to={link.href}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md hover:border-gray-200 transition-all flex flex-col gap-2.5 min-h-[90px]">
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${c.icon}`} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{link.name}</p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{link.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center gap-2 text-xs text-gray-400 pb-2">
        <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />
        <span>TSP-V2 · Supabase</span>
        <span className="mx-1">·</span>
        <span>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
  )
}
