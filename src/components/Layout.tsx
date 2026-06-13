import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  LogOut,
  Shield,
  Menu,
  X,
  Search,
} from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import { LayoutSkeleton } from './LayoutSkeleton'
import WaitingAccessPage from './WaitingAccessPage'
import OwnerSetupPage from './OwnerSetupPage'
import ContextSwitcher from './ContextSwitcher'
import NotificationsBell from './NotificationsBell'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { getMenuForRoles } from '../config/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import Breadcrumbs from './Breadcrumbs'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { useSubscriptionLimits } from '../hooks/useSubscription'
import NotificationBanner from './NotificationBanner'

export default function Layout() {
  useAdminNotifications()
  const location = useLocation()
  const { hasAnalytics } = useSubscriptionLimits()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAdmin = useIsAdmin()

  // Сброс прокрутки внутреннего контейнера при переходе между страницами,
  // иначе новая страница открывается на позиции прокрутки предыдущей.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])
  const { loading: authLoading } = useAuth()
  const { data: profile, isLoading } = useUserProfile()
  // Показываем скелетон только при первой загрузке — когда auth загружается или профиль ещё не получен
  const showSkeleton = authLoading || (isLoading && !profile)
  const queryClient = useQueryClient()

  // Шторка мобильного «Меню» (доп. пункты)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Глобальный поиск (Cmd/Ctrl+K)
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Получаем PRIMARY роль пользователя
  // Приоритет ролей: admin > parts_owner > parts_worker > user
  const getRoleByPriority = (roles: any[]) => {
    const rolePriority = ['admin', 'parts_owner', 'parts_worker', 'user']
    for (const roleName of rolePriority) {
      const role = roles.find((r: any) => r.name === roleName)
      if (role) return role
    }
    return roles.find((r: any) => r.is_primary) || roles[0]
  }

  const primaryRole = profile?.roles?.length ? getRoleByPriority(profile?.roles) : null

  // Компания владельца — для проверки телефона
  const ownerCompanyId = profile?.parts_company_id

  const { data: ownerCompany } = useQuery({
    queryKey: ['owner_company_phone', ownerCompanyId],
    enabled: !!ownerCompanyId && !!profile?.roles?.some((r: any) => r.name === 'parts_owner'),
    queryFn: async () => {
      const { data } = await supabase
        .from('parts_companies')
        .select('id, name, phone')
        .eq('id', ownerCompanyId!)
        .single()
      return data
    },
  })

  // Управляем activeRole в localStorage
  useEffect(() => {
    const allRoles = profile?.roles?.map((r: any) => r.name).filter((n: string) => n !== 'user') || []

    // Если админ зашел первый раз — устанавливаем 'user'
    if (primaryRole?.name === 'admin' && !localStorage.getItem('activeRole')) {
      localStorage.setItem('activeRole', 'user')
      return
    }

    // Если пользователь с несколькими ролями — НЕ сбрасываем activeRole
    if (allRoles.length > 1) {
      // Только устанавливаем начальное значение если ещё не установлено
      if (!localStorage.getItem('activeRole') && primaryRole) {
        localStorage.setItem('activeRole', primaryRole.name)
      }
      return
    }

    // Для пользователей с одной ролью — очищаем (не нужно)
    if (primaryRole && primaryRole.name !== 'admin' && allRoles.length <= 1) {
      localStorage.removeItem('activeRole')
    }
  }, [primaryRole, profile?.roles])

  // Получаем меню на основе активной роли
  // Поддерживаем переключение для ВСЕХ пользователей с несколькими ролями
  let roleNames: string[] = []
  const allUserRoles = profile?.roles?.map((r: any) => r.name).filter((n: string) => n !== 'user') || []
  const storedRole = localStorage.getItem('activeRole')

  if (primaryRole?.name === 'admin') {
    const activeRole = storedRole
    if (activeRole && activeRole !== 'admin') {
      roleNames = [activeRole]
    } else {
      roleNames = ['user']
    }
  } else if (allUserRoles.length > 1 && storedRole && allUserRoles.includes(storedRole)) {
    // Пользователь с несколькими ролями — используем выбранную
    roleNames = [storedRole]
  } else if (primaryRole) {
    roleNames = [primaryRole.name]
    // Если несколько ролей и нет сохранённой — сохраняем primary
    if (allUserRoles.length > 1 && !storedRole) {
      localStorage.setItem('activeRole', primaryRole.name)
    }
  } else if (profile?.roles?.length) {
    roleNames = [profile.roles?.[0]?.name]
  }

  const activeRoleName = roleNames[0] || primaryRole?.name || ''

  // Текущий контекст для переключателя разделов (Админ исключаем — у него своя кнопка)
  const currentCtx: 'parts' | 'user' =
    activeRoleName.startsWith('parts') ? 'parts' : 'user'
  // «Мои авто»: меню из одного пункта — сайдбар не нужен, выход выносим вверх справа
  const isUserCtx = currentCtx === 'user'

  const filteredNavigation = getMenuForRoles(roleNames).filter((item) => {
    if (item.href === '/parts/analytics') return hasAnalytics
    return true
  })

  const handleLogout = async () => {
    // Очищаем весь кэш React Query перед выходом
    queryClient.clear()
    localStorage.removeItem("tsp_profile_cache")
    localStorage.removeItem("activeRole")

    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    }
  }

  // Показываем загрузчик при первой загрузке профиля
  if (showSkeleton) {
    return <LayoutSkeleton />
  }

  // Пользователь авторизован но без роли — страница приветствия
  if (!primaryRole && filteredNavigation.length === 0) {
    return (
      <WaitingAccessPage
        profile={profile}
        onLogout={handleLogout}
      />
    )
  }

  // Владелец разборки без компании — обязан заполнить данные
  const isPartsOwnerRole = profile?.roles?.some((r: any) => r.name === 'parts_owner')
  // Нужна настройка: нет компании ИЛИ есть компания но без телефона (работники не смогут найти)
  const noCompany = isPartsOwnerRole && !profile?.parts_company_id
  const hasCompanyNoPhone = ownerCompanyId && ownerCompany !== undefined && !ownerCompany?.phone
  const needsSetup = noCompany || !!hasCompanyNoPhone

  if (needsSetup && primaryRole) {
    return (
      <OwnerSetupPage
        profile={profile}
        onLogout={handleLogout}
        onComplete={() => { localStorage.removeItem('tsp_profile_cache'); window.location.reload() }}
        existingCompanyId={hasCompanyNoPhone ? ownerCompanyId : undefined}
        existingCompanyName={hasCompanyNoPhone ? ownerCompany?.name : undefined}
      />
    )
  }

  // ── Мобильные пункты (без mobileHidden) ──────────────────────────────────
  const mobileNavItems = filteredNavigation.filter(item => !item.mobileHidden)
  // Если ≤4 — все в нижнем баре; иначе первые 4 + кнопка «Меню» (5-й слот)
  const showMobileSheet = mobileNavItems.length > 4
  const mobileBarItems = showMobileSheet ? mobileNavItems.slice(0, 4) : mobileNavItems
  const mobileSheetItems = showMobileSheet ? mobileNavItems.slice(4) : []

  // Показывать ли ссылку на /admin в шторке
  const adminInNav = filteredNavigation.some(i => i.href === '/admin')
  const showAdminInSheet = isAdmin && !adminInNav

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-gray-100 font-sans overscroll-none">

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR — navy, md:w-16 → lg:w-64
          ════════════════════════════════════════════ */}
      <aside
        className={`${isUserCtx ? 'hidden' : 'hidden md:flex'} md:flex-col md:w-16 lg:w-64 flex-shrink-0`}
        style={{ background: '#0E1C3D' }}
      >
        {/* Шапка сайдбара — ContextSwitcher */}
        <div className="flex items-center px-2 lg:px-3 h-14 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* На lg — полный switcher; на md — только иконка (switcher сам адаптируется) */}
          <div className="w-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
            <ContextSwitcher current={currentCtx} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {filteredNavigation.map((item) => {
            const Icon = item.icon
            const isActive = item.href.includes('?')
              ? location.pathname + location.search === item.href
              : location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.name}
                className={`group flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'font-medium active:scale-[0.98]'
                }`}
                style={
                  isActive
                    ? { background: '#2563EB' }
                    : { color: '#94A3B8' }
                }
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
                    ;(e.currentTarget as HTMLElement).style.color = '#E2E8F0'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = ''
                    ;(e.currentTarget as HTMLElement).style.color = '#94A3B8'
                  }
                }}
              >
                <Icon
                  className="w-[18px] h-[18px] flex-shrink-0"
                  strokeWidth={1.5}
                />
                <span className="hidden lg:block truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          {/* Кнопка поиска */}
          <button
            onClick={() => setSearchOpen(true)}
            title="Поиск (Ctrl+K)"
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-1 lg:px-3 py-2.5 text-sm rounded-lg transition-colors active:scale-[0.98]"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
              ;(e.currentTarget as HTMLElement).style.color = '#E2E8F0'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = ''
              ;(e.currentTarget as HTMLElement).style.color = '#94A3B8'
            }}
          >
            <Search className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            <span className="hidden lg:block">Поиск</span>
          </button>

          {/* Колокол уведомлений (desktop sidebar) */}
          <div className="flex items-center justify-center lg:justify-start w-full px-1 lg:px-2 py-1">
            <NotificationsBell userId={profile?.id} />
          </div>

          {/* Админ-кнопка — только на md (на lg она в ContextSwitcher) */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="lg:hidden flex items-center justify-center gap-3 w-full px-1 py-2.5 rounded-lg transition-colors"
              title="Панель администратора"
              style={{ color: '#CBD5E1' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
                ;(e.currentTarget as HTMLElement).style.color = '#E2E8F0'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = ''
                ;(e.currentTarget as HTMLElement).style.color = '#CBD5E1'
              }}
            >
              <Shield className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-1 lg:px-3 py-2.5 text-sm rounded-lg transition-colors active:scale-[0.98]"
            style={{ color: '#CBD5E1' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.15)'
              ;(e.currentTarget as HTMLElement).style.color = '#FCA5A5'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = ''
              ;(e.currentTarget as HTMLElement).style.color = '#CBD5E1'
            }}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            <span className="hidden lg:block">Выход</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          SCROLLABLE COLUMN
          ════════════════════════════════════════════ */}
      <div ref={scrollRef} className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* ── DESKTOP TOP BAR для «Мои авто» (без сайдбара) ── */}
        {isUserCtx && (
          <div className="hidden md:flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200">
            <ContextSwitcher current={currentCtx} />
            <div className="flex items-center gap-2">
              <NotificationsBell userId={profile?.id} />
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all active:scale-[0.97]"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} /> Выход
              </button>
            </div>
          </div>
        )}

        {/* ── MOBILE HEADER (hidden on md+) ── */}
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-3 flex items-center gap-2 h-[52px]">
            <div className="flex-1 min-w-0">
              <ContextSwitcher current={currentCtx} />
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Поиск"
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all active:scale-[0.97]"
            >
              <Search className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <NotificationsBell userId={profile?.id} />
            <button onClick={handleLogout}
              className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all active:scale-[0.97]"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Выйти</span>
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 bg-gray-50">
          <div className="mx-auto max-w-[1440px] w-full px-3 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <NotificationBanner userId={profile?.id} />
            <Breadcrumbs />
            <Outlet />
          </div>
          {/* Спейсер под фиксированное нижнее меню (только мобайл) */}
          <div
            className="md:hidden"
            style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
          />
        </div>

      </div>

      {/* ════════════════════════════════════════════
          MOBILE BOTTOM NAV (md:hidden, fixed)
          ════════════════════════════════════════════ */}
      {!isUserCtx && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {mobileBarItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href.includes('?')
              ? location.pathname + location.search === item.href
              : location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
                  isActive ? 'text-[#2563EB]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-center leading-tight" style={{ fontSize: '11px' }}>
                  {item.name}
                </span>
              </Link>
            )
          })}

          {/* 5-й слот — кнопка «Меню» если пунктов > 4 */}
          {showMobileSheet && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Menu className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <span className="text-center leading-tight" style={{ fontSize: '11px' }}>Меню</span>
            </button>
          )}
        </nav>
      )}

      {/* ════════════════════════════════════════════
          MOBILE SHEET — доп. пункты меню (снизу)
          ════════════════════════════════════════════ */}
      {sheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.40)' }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Ручка */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            {/* Шапка шторки */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Меню</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            {/* Сетка пунктов 3 колонки */}
            <div className="grid grid-cols-3 gap-2 p-4"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
              {mobileSheetItems.map((item) => {
                const Icon = item.icon
                const isActive = item.href.includes('?')
                  ? location.pathname + location.search === item.href
                  : location.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 px-1 py-3 rounded-xl min-h-[64px] transition-colors active:scale-[0.96] ${
                      isActive
                        ? 'bg-[#2563EB] text-white font-semibold'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-center text-[11px] font-medium leading-tight line-clamp-2">{item.name}</span>
                  </Link>
                )
              })}
              {/* Ссылка на Панель администратора в шторке */}
              {showAdminInSheet && (
                <Link
                  to="/admin"
                  onClick={() => { localStorage.removeItem('activeRole'); setSheetOpen(false) }}
                  className="flex flex-col items-center justify-center gap-1.5 px-1 py-3 rounded-xl min-h-[64px] bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors active:scale-[0.96]"
                >
                  <Shield className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-center text-[11px] font-medium leading-tight">Админ</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Глобальный поиск */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

    </div>
  )
}
