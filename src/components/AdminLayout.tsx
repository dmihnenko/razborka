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
  Car
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { LayoutSkeleton } from './LayoutSkeleton'
import Breadcrumbs from './Breadcrumbs'

// Группировка меню для удобства
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
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Админ панель</p>
              <p className="text-[11px] truncate" style={{ color: '#64748B' }}>
                {profile?.full_name || profile?.email}
              </p>
            </div>
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

        {/* Mobile nav pills */}
        <div className="px-3 py-2 overflow-y-auto max-h-[50vh] space-y-2">
          {adminNavigationGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: '#334155' }}>
                {group.title}
              </p>
              <div className="flex gap-1 flex-wrap">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all"
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
              </div>
            </div>
          ))}
          {/* Quick access */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style={{ color: '#334155' }}>
              Быстрый доступ
            </p>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => { localStorage.setItem('activeRole', 'user'); navigate('/my-vehicles') }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(37,99,235,0.15)', color: '#60A5FA' }}>
                <Car className="w-3.5 h-3.5" /><span>Мои авто</span>
              </button>
              <button onClick={() => { localStorage.setItem('activeRole', 'sto_owner'); navigate('/') }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#34D399' }}>
                <Building2 className="w-3.5 h-3.5" /><span>СТО</span>
              </button>
              <button onClick={() => { localStorage.setItem('activeRole', 'parts_owner'); navigate('/parts/dashboard') }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(249,115,22,0.12)', color: '#FB923C' }}>
                <Store className="w-3.5 h-3.5" /><span>Разборка</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR
          ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex md:flex-col w-[200px] xl:w-[220px] flex-shrink-0"
        style={{ backgroundColor: '#0C1220', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 h-14 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Админ панель</p>
            <p className="text-[11px]" style={{ color: '#475569' }}>TSP CRM</p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
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
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => { localStorage.setItem('activeRole', 'user'); navigate('/my-vehicles') }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}>
            <Car className="w-[17px] h-[17px] flex-shrink-0" />Мои авто
          </button>
          <button onClick={() => { localStorage.setItem('activeRole', 'sto_owner'); navigate('/') }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}>
            <Building2 className="w-[17px] h-[17px] flex-shrink-0" />Мое СТО
          </button>
          <button onClick={() => { localStorage.setItem('activeRole', 'parts_owner'); navigate('/parts/dashboard') }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: '#64748B' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}>
            <Store className="w-[17px] h-[17px] flex-shrink-0" />Разборка
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: '#475569' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#475569' }}>
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />Выход
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

