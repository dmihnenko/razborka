import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  LogOut,
  Building2,
  Store,
  CreditCard,
  MessageSquare,
  Car,
  Wrench
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { LayoutSkeleton } from './LayoutSkeleton'
import Breadcrumbs from './Breadcrumbs'

// Группировка меню — для десктопа с заголовками групп
const adminNavigationGroups = [
  {
    title: 'Основное',
    items: [
      { name: 'Обзор', href: '/admin', icon: Shield },
      { name: 'Пользователи', href: '/admin/users', icon: Users },
      { name: 'Роли', href: '/admin/roles', icon: Shield },
    ]
  },
  {
    title: 'Компании',
    items: [
      { name: 'СТО', href: '/admin/sto', icon: Building2 },
      { name: 'Разборки', href: '/admin/parts-companies', icon: Store },
    ]
  },
  {
    title: 'Система',
    items: [
      { name: 'Подписки', href: '/admin/subscriptions', icon: CreditCard },
      { name: 'Поддержка', href: '/admin/support', icon: MessageSquare },
      { name: 'Настройки', href: '/admin/settings', icon: Settings },
      { name: 'Аналитика', href: '/admin/analytics', icon: BarChart3 },
    ]
  }
]

// Плоский список — для icon-only режима (md)
const adminNavFlat = adminNavigationGroups.flatMap(g => g.items)

// Быстрый доступ
const quickAccessItems = [
  { name: 'Мои авто', icon: Car, role: 'user', path: '/my-vehicles', color: '#60A5FA', bg: 'rgba(37,99,235,0.12)' },
  { name: 'Мое СТО', icon: Wrench, role: 'sto_owner', path: '/', color: '#34D399', bg: 'rgba(16,185,129,0.12)' },
  { name: 'Разборка', icon: Store, role: 'parts_owner', path: '/parts/dashboard', color: '#FB923C', bg: 'rgba(249,115,22,0.12)' },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data: profile, isLoading } = useUserProfile()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    }
  }

  // Показываем загрузку пока профиль загружается
  if (isLoading) {
    return <LayoutSkeleton />
  }

  // Только после загрузки проверяем права
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">
            Доступ запрещен
          </h2>
          <p className="text-red-600">
            У вас нет прав для доступа к панели администратора.
          </p>
        </div>
      </div>
    )
  }

  // User initials avatar
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : (profile?.email?.[0] || 'A').toUpperCase()

  return (
    <div className="flex flex-col md:flex-row md:h-screen" style={{ backgroundColor: '#F8FAFC' }}>

      {/* ════════════════════════════════════════════
          MOBILE HEADER
          ════════════════════════════════════════════ */}
      <div className="md:hidden sticky top-0 z-40" style={{ backgroundColor: '#0C1220' }}>
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white truncate">Админ панель</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg min-h-[36px] transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: '#94A3B8' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>

        {/* Mobile nav pills — flat scrollable row like Layout.tsx */}
        <nav className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
          {adminNavFlat.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg flex-shrink-0 transition-all"
                style={isActive
                  ? { backgroundColor: '#7C3AED', color: '#FFFFFF' }
                  : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#94A3B8' }
                }
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
          {/* Quick access pills */}
          {quickAccessItems.map((q) => {
            const Icon = q.icon
            return (
              <button
                key={q.path}
                onClick={() => { localStorage.setItem('activeRole', q.role); navigate(q.path) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg flex-shrink-0 transition-all"
                style={{ backgroundColor: q.bg, color: q.color }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{q.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR — same structure as Layout.tsx
          ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex md:flex-col md:w-[60px] lg:w-[220px] xl:w-[240px] flex-shrink-0"
        style={{ backgroundColor: '#0C1220', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center lg:justify-start gap-3 h-14 px-2 lg:px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Админ панель</p>
            <p className="text-[11px]" style={{ color: '#475569' }}>TSP CRM</p>
          </div>
        </div>

        {/* Nav — groups shown at lg+, flat icons at md */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {/* Icon-only mode (md): flat list without group labels */}
          <div className="lg:hidden space-y-0.5">
            {adminNavFlat.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={item.name}
                  className="relative flex items-center justify-center py-2.5 px-2 rounded-lg transition-all duration-150"
                  style={isActive
                    ? { backgroundColor: '#3B1F6E', color: '#FFFFFF' }
                    : { color: '#64748B' }
                  }
                  onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#E2E8F0' }}}
                  onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-purple-400 rounded-r" />
                  )}
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: isActive ? '#C084FC' : 'inherit' }} />
                </Link>
              )
            })}
          </div>

          {/* Full mode (lg+): grouped nav with section labels */}
          <div className="hidden lg:block">
            {adminNavigationGroups.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1.5" style={{ color: '#334155', letterSpacing: '0.08em' }}>
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="relative flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-lg text-sm font-medium transition-all duration-150"
                      style={isActive
                        ? { backgroundColor: '#3B1F6E', color: '#FFFFFF' }
                        : { color: '#64748B' }
                      }
                      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#E2E8F0' }}}
                      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-purple-400 rounded-r" />
                      )}
                      <Icon
                        className="w-[17px] h-[17px] flex-shrink-0"
                        style={{ color: isActive ? '#C084FC' : 'inherit' }}
                      />
                      <span className="leading-none">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Footer — same as Layout.tsx: user avatar + quick access + logout */}
        <div className="flex-shrink-0 px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Quick access to СТО / Разборка / Мои авто */}
          {quickAccessItems.map((q) => {
            const Icon = q.icon
            return (
              <button
                key={q.path}
                onClick={() => { localStorage.setItem('activeRole', q.role); navigate(q.path) }}
                title={q.name}
                className="flex items-center justify-center lg:justify-start gap-3 w-full py-2 px-2 lg:px-3 rounded-lg text-sm font-medium transition-all duration-150"
                style={{ color: '#64748B' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}
              >
                <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                <span className="hidden lg:block">{q.name}</span>
              </button>
            )
          })}

          {/* User info */}
          <div className="flex items-center justify-center lg:justify-start gap-2.5 py-2 px-2 lg:px-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ backgroundColor: '#3B1F6E', color: '#C084FC' }}
            >
              {initials}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#CBD5E1' }}>
                {profile?.full_name || profile?.email || 'Admin'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Выход"
            className="flex items-center justify-center lg:justify-start gap-3 w-full py-2 px-2 lg:px-3 rounded-lg transition-all duration-150 text-sm font-medium"
            style={{ color: '#475569' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#475569' }}
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            <span className="hidden lg:block">Выход</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="mx-auto max-w-[1440px] w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <Breadcrumbs />
          <Outlet />
        </div>
      </div>
    </div>
  )
}

