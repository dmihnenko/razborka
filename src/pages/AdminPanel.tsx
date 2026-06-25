import { Link } from 'react-router-dom'
import { BRAND } from '@/config/brand'
import {
  Users, Shield, Settings, BarChart2,
  Store, CreditCard, MessageCircle, TrendingUp,
} from 'lucide-react'
import { useUserProfile } from '../hooks/useUserProfile'
import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '../services/adminService'
import StatCard, { type StatColor } from '../components/admin/StatCard'

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

  // Ink & Signal: плашки быстрых ссылок — индиго-акцент (signal) либо нейтраль.
  const SIGNAL = { iconCls: 'text-indigo-600', tileBg: 'bg-indigo-50' }
  const NEUTRAL = { iconCls: 'text-gray-500',  tileBg: 'bg-gray-100' }
  const colorMap: Record<string, { iconCls: string; tileBg: string }> = {
    indigo:  SIGNAL,
    blue:    SIGNAL,
    orange:  NEUTRAL,
    emerald: NEUTRAL,
    purple:  SIGNAL,
    gray:    NEUTRAL,
  }

  const quickLinks = [
    { name: 'Пользователи',  href: '/admin/users',           icon: Users,         color: 'indigo', desc: 'Управление аккаунтами' },
    { name: 'Роли',          href: '/admin/roles',           icon: Shield,        color: 'purple', desc: 'Права доступа' },
    { name: 'Разборки',      href: '/admin/parts-companies', icon: Store,         color: 'orange', desc: 'Авторазборки' },
    { name: 'Подписки',      href: '/admin/subscriptions',   icon: CreditCard,    color: 'emerald',desc: 'Тарифы и оплаты' },
    { name: 'Поддержка',     href: '/admin/support',         icon: MessageCircle, color: 'gray',   desc: `${stats?.openTickets ?? 0} открытых` },
    { name: 'Аналитика',     href: '/admin/analytics',       icon: BarChart2,     color: 'indigo', desc: 'Статистика системы' },
    { name: 'Настройки',     href: '/admin/settings',        icon: Settings,      color: 'gray',   desc: 'Конфигурация платформы' },
  ]

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'

  return (
    <div className="space-y-6">

      {/* Приветствие */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}, {profile?.full_name?.split(' ')[0] || 'Администратор'}
          </h1>
          <p className="page-subtitle">Панель управления · {BRAND.name}</p>
        </div>
      </div>

      {/* KPI stat-cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map(card => (
          <StatCard
            key={card.href}
            label={card.label}
            value={card.value}
            sub={card.sub}
            icon={card.icon}
            color={card.color as StatColor}
            to={card.href}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Quick links grid */}
      <div>
        <p className="kicker mb-3">Разделы</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickLinks.map(link => {
            const c = colorMap[link.color]
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                to={link.href}
                className="card group flex flex-col gap-2.5 p-4 min-h-[90px] hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
              >
                <div className={`icon-tile-sm ${c.tileBg}`}>
                  <Icon className={`w-4 h-4 ${c.iconCls}`} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 truncate">
                    {link.name}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{link.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pb-2">
        <TrendingUp className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
        <span className="kicker">{BRAND.name} · Supabase · {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

    </div>
  )
}
