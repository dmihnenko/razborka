import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Shield, Users, Settings, BarChart2, LogOut, ClipboardList,
  Store, CreditCard, MessageCircle, LayoutGrid, Database,
  MoreHorizontal, X,
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { LayoutSkeleton } from './LayoutSkeleton'
import ContextSwitcher from './ContextSwitcher'

interface NavItem { name: string; href: string; icon: any }

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'Основное', items: [
    { name: 'Обзор',        href: '/admin',                 icon: LayoutGrid },
    { name: 'Пользователи', href: '/admin/users',           icon: Users },
    { name: 'Роли',         href: '/admin/roles',           icon: Shield },
  ]},
  { title: 'Компании', items: [
    { name: 'Разборки', href: '/admin/parts-companies', icon: Store },
  ]},
  { title: 'Система', items: [
    { name: 'Подписки',   href: '/admin/subscriptions',   icon: CreditCard },
    { name: 'Поддержка',  href: '/admin/support',         icon: MessageCircle },
    { name: 'Заявки',     href: '/admin/access-requests', icon: ClipboardList },
    { name: 'Аналитика',  href: '/admin/analytics',       icon: BarChart2 },
    { name: 'База данных',href: '/admin/database',        icon: Database },
    { name: 'Настройки',  href: '/admin/settings',        icon: Settings },
  ]},
]

// Мобильный нижний таб-бар: 4 главных + «Ещё»
const BOTTOM_TABS: NavItem[] = [
  { name: 'Обзор',        href: '/admin',                 icon: LayoutGrid },
  { name: 'Польз.',       href: '/admin/users',           icon: Users },
  { name: 'Разборки',     href: '/admin/parts-companies', icon: Store },
  { name: 'Подписки',     href: '/admin/subscriptions',   icon: CreditCard },
]
const BOTTOM_HREFS = BOTTOM_TABS.map(t => t.href)
const MORE_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items).filter(i => !BOTTOM_HREFS.includes(i.href))

export default function AdminLayout() {
  useAdminNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading } = useUserProfile()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) toast.error('Ошибка при выходе')
    else navigate('/login')
  }

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

  const isActive = (href: string) =>
    href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(href)
  const moreActive = MORE_ITEMS.some(i => isActive(i.href))

  return (
    <div className="min-h-dvh bg-[#F4F6FA]">

      {/* ═══ DESKTOP SIDEBAR (navy, kit) ═══ */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 border-r z-30"
        style={{ background: '#0E1C3D', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="px-3 h-16 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-full rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <ContextSwitcher current="admin" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
          {NAV_GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5" style={{ color: '#64748B' }}>{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link key={item.href} to={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                      }`}>
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} strokeWidth={1.5} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/profile" className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.07] transition-colors mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {(profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'A').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Админ'}</p>
              <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{profile?.email}</p>
            </div>
          </Link>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-slate-300 hover:bg-red-500/15 hover:text-red-300">
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> Выйти
          </button>
        </div>
      </aside>

      {/* ═══ MOBILE TOP BAR ═══ */}
      <header className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-200/80">
        <div className="h-14 px-2 flex items-center justify-between">
          <ContextSwitcher current="admin" />
          <button onClick={handleLogout}
            className="p-2 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="md:pl-64">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-5 sm:py-5 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
          <Outlet />
        </div>
      </main>

      {/* ═══ MOBILE BOTTOM TAB BAR ═══ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200/80 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {BOTTOM_TABS.map(tab => {
          const Icon = tab.icon
          const active = isActive(tab.href)
          return (
            <Link key={tab.href} to={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors ${active ? 'text-purple-600' : 'text-gray-400'}`}>
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              {tab.name}
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors ${moreActive ? 'text-purple-600' : 'text-gray-400'}`}>
          <MoreHorizontal className="w-5 h-5" strokeWidth={1.5} />
          Ещё
        </button>
      </nav>

      {/* ═══ «ЕЩЁ» — нижняя шторка ═══ */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative w-full bg-white rounded-t-2xl shadow-xl p-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-sm font-bold text-gray-900">Разделы</p>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} to={item.href} onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-colors ${active ? 'bg-purple-50 border-purple-200 text-purple-700' : 'border-gray-100 bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
