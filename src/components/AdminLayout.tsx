import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Shield, Users, Settings, BarChart2, LogOut, ClipboardList,
  Store, MessageCircle, LayoutGrid, Database,
  MoreHorizontal, X, Car,
  type LucideIcon,
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { LayoutSkeleton } from './LayoutSkeleton'
import ContextSwitcher from './ContextSwitcher'

interface NavItem { name: string; href: string; icon: LucideIcon }

// Грамотное меню админа: Обзор · Разборки · Пользователи · Система
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [
    { name: 'Обзор', href: '/admin', icon: LayoutGrid },
  ]},
  { title: 'Разборки', items: [
    { name: 'Разборки',         href: '/admin/subscriptions',   icon: Store },
    { name: 'Заявки на доступ', href: '/admin/access-requests', icon: ClipboardList },
    { name: 'Каталог авто',     href: '/admin/car-models',      icon: Car },
  ]},
  { title: 'Пользователи', items: [
    { name: 'Пользователи', href: '/admin/users', icon: Users },
    { name: 'Роли и права', href: '/admin/roles', icon: Shield },
  ]},
  { title: 'Система', items: [
    { name: 'Аналитика',   href: '/admin/analytics', icon: BarChart2 },
    { name: 'Поддержка',   href: '/admin/support',   icon: MessageCircle },
    { name: 'База данных', href: '/admin/database',  icon: Database },
    { name: 'Настройки',   href: '/admin/settings',  icon: Settings },
  ]},
]

// Мобильный нижний таб-бар: 4 главных + «Ещё»
const BOTTOM_TABS: NavItem[] = [
  { name: 'Обзор',    href: '/admin',                 icon: LayoutGrid },
  { name: 'Разборки', href: '/admin/subscriptions',   icon: Store },
  { name: 'Заявки',   href: '/admin/access-requests', icon: ClipboardList },
  { name: 'Польз.',   href: '/admin/users',           icon: Users },
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
  const moreSheetRef = useRef<HTMLDivElement>(null)

  // Шторка «Ещё» как диалог: Esc закрывает, фокус переносится внутрь при открытии.
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('keydown', onKey)
    moreSheetRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

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
          <button onClick={() => navigate('/')} className="mt-5 cab-btn cab-btn-secondary">
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
    // --primary → чернила: chip-active, фокус, shadcn-primary, text/bg-primary
    // на всех админ-страницах автоматически становятся Ink & Signal.
    <div
      className="min-h-dvh"
      style={{ background: 'var(--cab-bg)', '--primary': '223 14% 10%' } as React.CSSProperties}
    >

      {/* ═══ DESKTOP SIDEBAR — Ink & Signal (светлый) ═══ */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 z-30"
        style={{ background: 'var(--cab-surface)', borderRight: '1px solid var(--cab-border)' }}
      >
        <div className="px-3 h-14 flex items-center" style={{ borderBottom: '1px solid var(--cab-border)' }}>
          <div className="w-full min-w-0">
            <ContextSwitcher current="admin" variant="segment" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title || gi} className="space-y-0.5">
              {group.title && <p className="cab-group-label mb-1.5">{group.title}</p>}
              {group.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} to={item.href}
                    className={`cab-nav active:scale-[0.98] ${active ? 'cab-nav-active' : ''}`}>
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="p-2.5" style={{ borderTop: '1px solid var(--cab-border)' }}>
          <Link to="/my-vehicles"
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors mb-1 hover:bg-[var(--cab-surface-2)]"
            style={{ color: 'var(--cab-ink-2)' }}>
            <Car className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} /> Мои авто
          </Link>
          <button onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-slate-600 hover:bg-red-50 hover:text-red-600">
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} /> Выйти
          </button>
        </div>
      </aside>

      {/* ═══ MOBILE TOP BAR ═══ */}
      <header className="md:hidden sticky top-0 z-20 bg-white" style={{ borderBottom: '1px solid var(--cab-border)' }}>
        <div className="h-14 px-2 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0"><ContextSwitcher current="admin" variant="mobile" /></div>
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
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white flex"
        style={{ borderTop: '1px solid var(--cab-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {BOTTOM_TABS.map(tab => {
          const Icon = tab.icon
          const active = isActive(tab.href)
          return (
            <Link key={tab.href} to={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors"
              style={{ color: active ? 'var(--cab-ink)' : 'var(--cab-ink-2)' }}>
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              {tab.name}
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors"
          style={{ color: moreActive ? 'var(--cab-ink)' : 'var(--cab-ink-2)' }}>
          <MoreHorizontal className="w-5 h-5" strokeWidth={1.5} />
          Ещё
        </button>
      </nav>

      {/* ═══ «ЕЩЁ» — нижняя шторка (диалог) ═══ */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div ref={moreSheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Разделы"
            className="relative w-full bg-white rounded-t-2xl shadow-xl p-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] outline-none"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-sm font-bold text-gray-900">Разделы</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Закрыть" className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" aria-hidden="true" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} to={item.href} onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-colors"
                    style={active
                      ? { background: 'var(--cab-signal-weak)', borderColor: 'var(--cab-signal)', color: 'var(--cab-signal)' }
                      : { background: 'var(--cab-surface-2)', borderColor: 'var(--cab-border)', color: 'var(--cab-ink-2)' }}>
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
