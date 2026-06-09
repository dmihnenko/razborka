import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Shield, Users, Settings, BarChart2, LogOut, ClipboardList,
  Building2, Store, CreditCard, MessageCircle,
  Car, Wrench, Menu, X, ChevronRight, LayoutGrid, Database
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { LayoutSkeleton } from './LayoutSkeleton'
import Breadcrumbs from './Breadcrumbs'

const navGroups = [
  {
    title: 'Основное',
    items: [
      { name: 'Обзор',        href: '/admin',                icon: LayoutGrid },
      { name: 'Пользователи', href: '/admin/users',          icon: Users },
      { name: 'Роли',         href: '/admin/roles',          icon: Shield },
    ]
  },
  {
    title: 'Компании',
    items: [
      { name: 'СТО',       href: '/admin/sto',            icon: Building2 },
      { name: 'Разборки',  href: '/admin/parts-companies', icon: Store },
    ]
  },
  {
    title: 'Система',
    items: [
      { name: 'Подписки',  href: '/admin/subscriptions', icon: CreditCard },
      { name: 'Поддержка', href: '/admin/support',        icon: MessageCircle },
      { name: 'Заявки',     href: '/admin/access-requests', icon: ClipboardList },
      { name: 'Аналитика', href: '/admin/analytics',      icon: BarChart2 },
      { name: 'База данных', href: '/admin/database',      icon: Database },
      { name: 'Настройки', href: '/admin/settings',       icon: Settings },
    ]
  }
]

const navFlat = navGroups.flatMap(g => g.items)

const quickItems = [
  { name: 'Мои авто', icon: Car,    role: 'user',        path: '/my-vehicles',      color: 'text-blue-500',   bg: 'bg-blue-50',   ring: 'ring-blue-200' },
  { name: 'СТО',      icon: Wrench, role: 'sto_owner',   path: '/',                 color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  { name: 'Разборка', icon: Store,  role: 'parts_owner', path: '/parts/dashboard',  color: 'text-orange-500', bg: 'bg-orange-50', ring: 'ring-orange-200' },
]

function NavLink({ item, collapsed, onClick }: { item: typeof navFlat[0]; collapsed?: boolean; onClick?: () => void }) {
  const location = useLocation()
  const isActive = location.pathname === item.href
  const Icon = item.icon

  return (
    <Link
      to={item.href}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
        isActive
          ? 'bg-purple-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} strokeWidth={1.5} />
      {!collapsed && <span className="truncate">{item.name}</span>}
      {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
    </Link>
  )
}

export default function AdminLayout() {
  useAdminNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = useIsAdmin()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading } = useUserProfile()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) toast.error('Ошибка при выходе')
    else navigate('/login')
  }

  const handleQuickAccess = (role: string, path: string) => {
    localStorage.setItem('activeRole', role)
    queryClient.invalidateQueries()
    navigate(path)
    setMobileOpen(false)
  }

  // Пока грузится сессия/профиль — спиннер, а не «Доступ запрещён»
  // (иначе при входе админом на миг мелькает запрет, пока роли не загрузились)
  if (authLoading || isLoading || (!!user && !profile)) return <LayoutSkeleton />

  if (!isAdmin) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-red-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Доступ запрещён</h2>
          <p className="text-sm text-gray-500">У вас нет прав администратора</p>
          <button onClick={() => navigate('/')} className="mt-5 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            На главную
          </button>
        </div>
      </div>
    )
  }

  const currentPage = navFlat.find(i => i.href === location.pathname)?.name || 'Админ'

  return (
    <div className="flex h-dvh bg-[#F4F6FA] font-sans overflow-hidden">

      {/* ═══════════════════════════════
          DESKTOP SIDEBAR
          ═══════════════════════════════ */}
      <aside className="hidden md:flex flex-col w-16 lg:w-60 xl:w-64 bg-white border-r border-gray-200/80 flex-shrink-0 shadow-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 px-3 lg:px-4 h-14 border-b border-gray-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Shield className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">Админ панель</p>
            <p className="text-[11px] text-gray-400 truncate">{profile?.full_name || profile?.email}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {/* Icon-only (md) */}
          <div className="lg:hidden space-y-0.5">
            {navFlat.map(item => <NavLink key={item.href} item={item} collapsed />)}
          </div>

          {/* Grouped (lg+) */}
          <div className="hidden lg:block space-y-4">
            {navGroups.map(group => (
              <div key={group.title}>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-3 mb-1.5">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => <NavLink key={item.href} item={item} />)}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-2 space-y-0.5 flex-shrink-0">
          {/* Быстрый доступ */}
          <div className="hidden lg:block mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-3 mb-1.5">Переключить</p>
            {quickItems.map(q => {
              const Icon = q.icon
              return (
                <button key={q.path} onClick={() => handleQuickAccess(q.role, q.path)}
                  className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 min-h-[40px] ${q.bg} ${q.color}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  <span>{q.name}</span>
                </button>
              )
            })}
          </div>

          {/* Icon-only quick access (md) */}
          <div className="lg:hidden flex flex-col gap-0.5 mb-1">
            {quickItems.map(q => {
              const Icon = q.icon
              return (
                <button key={q.path} onClick={() => handleQuickAccess(q.role, q.path)}
                  title={q.name}
                  className={`flex items-center justify-center w-full py-2 rounded-xl transition-all min-h-[40px] ${q.bg} ${q.color}`}>
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )
            })}
          </div>

          <button onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-2 lg:px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors min-h-[44px]">
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span className="hidden lg:block">Выйти</span>
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════
          MOBILE DRAWER OVERLAY
          ═══════════════════════════════ */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />

          {/* Drawer */}
          <div className="relative z-10 flex flex-col w-72 max-w-[85vw] bg-white h-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Админ панель</p>
                  <p className="text-[11px] text-gray-400 truncate max-w-[150px]">{profile?.full_name || profile?.email}</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
              {navGroups.map(group => (
                <div key={group.title}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-2 mb-1.5">{group.title}</p>
                  <div className="space-y-0.5">
                    {group.items.map(item => <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />)}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer */}
            <div className="border-t border-gray-100 p-3 space-y-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 px-2 mb-1">Переключить</p>
              <div className="grid grid-cols-3 gap-2">
                {quickItems.map(q => {
                  const Icon = q.icon
                  return (
                    <button key={q.path} onClick={() => handleQuickAccess(q.role, q.path)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[11px] font-semibold transition-all ${q.bg} ${q.color} ring-1 ${q.ring}`}>
                      <Icon className="w-5 h-5" strokeWidth={1.5} />
                      {q.name}
                    </button>
                  )
                })}
              </div>
              <button onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors min-h-[44px]">
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200/80 shadow-sm">
          <div className="flex items-center gap-3 px-4 h-14">
            {/* Mobile menu button */}
            <button onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0">
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* Breadcrumb / page title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 hidden sm:block">Администратор</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 hidden sm:block flex-shrink-0" />
                <span className="font-semibold text-gray-800 truncate">{currentPage}</span>
              </div>
            </div>

            {/* Right: profile + actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-xl border border-purple-100">
                <div className="w-5 h-5 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3 h-3 text-white" strokeWidth={2} />
                </div>
                <span className="text-xs font-semibold text-purple-700">
                  {profile?.full_name?.split(' ')[0] || 'Админ'}
                </span>
              </div>
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors min-h-[44px]">
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
