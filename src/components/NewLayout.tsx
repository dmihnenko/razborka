/**
 * NewLayout — "Precision Pro" layout
 *
 * Structural differences from classic Layout:
 *  ┌─────────────────────────── Top header bar (56px, white) ─────────────────────────────┐
 *  ├──────────────────┬───────────────────────────────────────────────────────────────────┤
 *  │ White sidebar    │  Main content (white background, max-w 1400px, centered padding)  │
 *  │ 240px (desktop)  │                                                                   │
 *  │ Grouped nav      │                                                                   │
 *  │ + user profile   │                                                                   │
 *  └──────────────────┴───────────────────────────────────────────────────────────────────┘
 */
import { useState, useMemo, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LogOut, Shield, Wrench, Menu, X, ChevronRight, Bell
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { getMenuForRoles } from '../config/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { LayoutSkeleton } from './LayoutSkeleton'

/* ── nav group mapping ──────────────────────────────────────── */
const GROUP_MAP: Record<string, string> = {
  '/customers': 'Клиенты',
  '/customer': 'Клиенты',
  '/vehicles': 'Клиенты',
  '/vehicle': 'Клиенты',
  '/parts/customers': 'Клиенты',
  '/appointments': 'Работа',
  '/sto/appointments': 'Работа',
  '/work-orders': 'Работа',
  '/services': 'Работа',
  '/parts/orders': 'Работа',
  '/statistics': 'Аналитика',
  '/analytics': 'Аналитика',
  '/monthly-revenue': 'Аналитика',
  '/parts/analytics': 'Аналитика',
  '/invoices': 'Финансы',
  '/sto/employees': 'Команда',
  '/parts/employees': 'Команда',
  '/my-vehicles': 'Мои авто',
  '/parts/vehicles': 'Склад',
  '/parts/inventory': 'Склад',
  '/parts/warehouse': 'Склад',
  '/parts/categories': 'Склад',
  '/sto/settings': 'Система',
  '/parts/settings': 'Система',
  '/support': 'Система',
  '/sto/trash': 'Система',
  '/parts/trash': 'Система',
}

function getNavGroup(href: string): string {
  if (href === '/' || href === '/parts/dashboard' || href === '/worker/dashboard') return ''
  const clean = href.split('?')[0]
  for (const [prefix, group] of Object.entries(GROUP_MAP)) {
    if (clean === prefix || clean.startsWith(prefix + '/')) return group
  }
  return 'Прочее'
}

/* ── priority role helper ───────────────────────────────────── */
function getRoleByPriority(roles: any[]) {
  const order = ['admin', 'sto_owner', 'parts_owner', 'store_owner', 'sto_worker', 'parts_worker', 'store_worker', 'user']
  for (const r of order) {
    const found = roles.find((x: any) => x.name === r)
    if (found) return found
  }
  return roles.find((r: any) => r.is_primary) || roles[0]
}

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────── */
export default function NewLayout() {
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const { data: profile, isLoading } = useUserProfile()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    window.innerWidth >= 768 ? true : false
  )

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
  }, [location.pathname])

  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const primaryRole = profile?.roles?.length ? getRoleByPriority(profile.roles) : null

  const { data: stoCompany } = useQuery({
    queryKey: ['sto_company', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies').select('services_menu_enabled').eq('id', profile.sto_company_id).single()
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id && (isStoWorker || isStoOwner),
    staleTime: 0,
  })

  useEffect(() => {
    if (primaryRole?.name === 'admin' && !localStorage.getItem('activeRole')) {
      localStorage.setItem('activeRole', 'user')
    }
    if (primaryRole && primaryRole.name !== 'admin') {
      localStorage.removeItem('activeRole')
    }
  }, [primaryRole])

  let roleNames: string[] = []
  if (primaryRole?.name === 'admin') {
    const active = localStorage.getItem('activeRole')
    roleNames = active && active !== 'admin' ? [active] : ['user']
  } else if (primaryRole) {
    roleNames = [primaryRole.name]
  } else if (profile?.roles?.length) {
    roleNames = [profile.roles[0].name]
  }

  const navigation = getMenuForRoles(roleNames)
  const filteredNavigation = useMemo(() => {
    if (isStoWorker && !isStoOwner) {
      const enabled = stoCompany?.services_menu_enabled ?? true
      if (!enabled) return navigation.filter(i => i.href !== '/services')
    }
    return navigation
  }, [navigation, isStoWorker, isStoOwner, stoCompany])

  const handleLogout = async () => {
    queryClient.clear()
    const { error } = await supabase.auth.signOut()
    if (error) toast.error('Ошибка при выходе')
  }

  if (isLoading || !profile) return <LayoutSkeleton />

  if (!primaryRole && filteredNavigation.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F7FA]">
        <div className="max-w-sm w-full mx-4 p-8 bg-white rounded-2xl border border-gray-200 text-center space-y-4">
          <div className="w-14 h-14 bg-yellow-50 border-2 border-yellow-200 rounded-2xl flex items-center justify-center mx-auto text-2xl">⏳</div>
          <h2 className="text-lg font-bold text-gray-900">Ожидание доступа</h2>
          <p className="text-sm text-gray-500">Обратитесь к администратору для назначения роли.</p>
          <p className="text-xs text-gray-400">{profile.email || profile.username}</p>
          <button onClick={handleLogout} className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors">Выйти</button>
        </div>
      </div>
    )
  }

  /* ── Group navigation for sidebar ──────────────────────── */
  const groupOrder = ['', 'Клиенты', 'Работа', 'Склад', 'Аналитика', 'Финансы', 'Команда', 'Мои авто', 'Система', 'Прочее']
  const grouped = filteredNavigation.reduce<Record<string, typeof filteredNavigation>>((acc, item) => {
    const g = getNavGroup(item.href)
    if (!acc[g]) acc[g] = []
    acc[g].push(item)
    return acc
  }, {})

  /* ── Page title from current nav item ───────────────────── */
  const currentPage = filteredNavigation.find(item => {
    const clean = item.href.split('?')[0]
    return location.pathname === clean || (item.href !== '/' && location.pathname.startsWith(clean))
  })

  return (
    <div className="flex flex-col h-screen bg-[#F5F7FA] font-sans" style={{ fontFamily: "var(--ds-font, 'Plus Jakarta Sans', -apple-system, sans-serif)" }}>

      {/* ═══ TOP HEADER BAR ════════════════════════════════════ */}
      <header className="flex-shrink-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 z-30">
        {/* Hamburger */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:block text-sm font-bold text-gray-900 tracking-tight">TSP Pro</span>
        </div>

        {/* Breadcrumb — current page */}
        {currentPage && (
          <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-400">
            <ChevronRight className="w-4 h-4" />
            <span className="font-medium text-gray-700">{currentPage.name}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side: notifications + user */}
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400 flex-shrink-0">
            <Bell className="w-4 h-4" />
          </button>

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Админ
            </Link>
          )}

          {/* User chip */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
            <Avatar name={profile?.full_name || profile?.email || '?'} />
            <div className="hidden lg:block leading-tight">
              <p className="text-xs font-semibold text-gray-800 truncate max-w-[120px]">
                {profile?.full_name?.split(' ')[0] || profile?.email}
              </p>
              <p className="text-[10px] text-gray-400 capitalize">{primaryRole?.name?.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Выход"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ═══ BODY = SIDEBAR + CONTENT ══════════════════════════ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="md:hidden absolute inset-0 bg-black/30 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ──────────────────────────────────────── */}
        <aside
          className={`
            flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden
            transition-all duration-200 ease-in-out
            md:relative md:translate-x-0
            absolute inset-y-0 left-0 z-20
            ${sidebarOpen ? 'w-60 translate-x-0' : 'w-0 -translate-x-full md:w-0'}
          `}
        >
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
            {groupOrder.map(group => {
              const items = grouped[group]
              if (!items?.length) return null
              return (
                <div key={group} className={group ? 'mt-4 first:mt-0' : ''}>
                  {group && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 pb-1.5">
                      {group}
                    </p>
                  )}
                  {items.map(item => {
                    const Icon = item.icon
                    const isActive = item.href.includes('?')
                      ? location.pathname + location.search === item.href
                      : item.href === '/'
                        ? location.pathname === '/'
                        : location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                          ${isActive
                            ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600 pl-[10px]'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }
                        `}
                      >
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          {/* Sidebar footer: user info on mobile */}
          <div className="md:hidden border-t border-gray-200 p-3 flex items-center gap-3">
            <Avatar name={profile?.full_name || profile?.email || '?'} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-[10px] text-gray-400 capitalize">{primaryRole?.name?.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-600 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────── */}
        <main className="flex-1 overflow-auto bg-[#F5F7FA]">
          <div className="mx-auto max-w-[1440px] w-full px-4 py-5 sm:px-6 sm:py-6 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
