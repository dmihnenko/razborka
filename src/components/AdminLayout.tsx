import { useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { isLoading } = useUserProfile()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    } else {
      navigate('/login')
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
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans">

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR — same structure as Layout.tsx
          ════════════════════════════════════════════ */}
      <aside className="hidden md:flex md:flex-col md:w-16 lg:w-64 bg-white border-r border-gray-200 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2 lg:px-5 h-14 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block text-sm font-semibold text-gray-800 truncate">Админ панель</span>
        </div>

        {/* Nav — groups at lg+, icons-only at md */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {/* Icon-only (md) */}
          <div className="lg:hidden space-y-0.5">
            {adminNavFlat.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={item.name}
                  className={`flex items-center justify-center py-2.5 px-2 rounded-lg transition-colors ${
                    isActive ? 'bg-purple-50 text-purple-700' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-600' : ''}`} />
                </Link>
              )
            })}
          </div>

          {/* Grouped (lg+) */}
          <div className="hidden lg:block">
            {adminNavigationGroups.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1 text-gray-400">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2 mb-0.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-100 space-y-0.5">
          {quickAccessItems.map((q) => {
            const Icon = q.icon
            return (
              <button
                key={q.path}
                onClick={() => { localStorage.setItem('activeRole', q.role); queryClient.invalidateQueries(); navigate(q.path) }}
                title={q.name}
                className="flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
                style={{ color: q.color }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: q.color }} />
                <span className="hidden lg:block">{q.name}</span>
              </button>
            )
          })}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Выход</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* ── MOBILE HEADER (hidden on md+) ── */}
        <div className="md:hidden bg-white border-b border-gray-200">
          {/* Top bar */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800 truncate">Админ панель</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg min-h-[36px] transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти</span>
            </button>
          </div>

          {/* Mobile nav — grid cards like main Layout */}
          <nav className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-2 bg-white">
            {adminNavFlat.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex flex-col items-center justify-center gap-1.5 px-1 py-3 min-h-[64px] rounded-xl text-[11px] font-medium transition-all ${
                    isActive
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                  <span className="text-center leading-tight line-clamp-2">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Quick access — always pinned at bottom, 3 equal columns */}
          <div className="grid grid-cols-3 gap-2 p-2 bg-white border-t border-gray-100">
            {quickAccessItems.map((q) => {
              const Icon = q.icon
              return (
                <button
                  key={q.path}
                  onClick={() => { localStorage.setItem('activeRole', q.role); queryClient.invalidateQueries(); navigate(q.path) }}
                  className="flex flex-col items-center justify-center gap-1.5 px-1 py-3 min-h-[64px] rounded-xl text-[11px] font-medium transition-all"
                  style={{ background: q.bg, color: q.color }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" style={{ color: q.color }} />
                  <span className="text-center leading-tight line-clamp-2">{q.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── PAGE CONTENT ── */}
        <div className="flex-1 bg-gray-50">
          <div className="mx-auto max-w-[1440px] w-full px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <Breadcrumbs />
            <Outlet />
          </div>
        </div>

      </div>
    </div>
  )
}

