import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LogOut,
  Shield,
  Menu,
  X,
  Search,
  Store,
} from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import { LayoutSkeleton } from './LayoutSkeleton'
import WaitingAccessPage from './WaitingAccessPage'
import OwnerSetupPage from './OwnerSetupPage'
import ContextSwitcher from './ContextSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import NotificationsBell from './NotificationsBell'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { getMenuForRoles, PARTS_NAV_GROUPS } from '../config/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { useSubscriptionLimits } from '../hooks/useSubscription'
import NotificationBanner from './NotificationBanner'
import { Logo } from './brand/Logo'
import { BRAND } from '@/config/brand'

// Ключи перевода названий пунктов меню (по href) — чтобы не менять navigation.ts.
const NAV_KEY: Record<string, string> = {
  '/parts/dashboard': 'nav.dashboard',
  '/parts/orders': 'nav.orders',
  '/parts/market-orders': 'nav.marketOrders',
  '/parts/shipments': 'nav.shipments',
  '/parts/inventory?source=vehicles': 'nav.inventory',
  '/parts/inventory?source=shop': 'nav.shop',
  '/parts/vehicles': 'nav.vehicles',
  '/parts/customers': 'nav.customers',
  '/parts/categories': 'nav.categories',
  '/parts/warehouse': 'nav.warehouse',
  '/parts/roi': 'nav.roi',
  '/parts/analytics': 'nav.analytics',
  '/parts/employees': 'nav.employees',
  '/parts/settings': 'nav.settings',
  '/parts/subscription': 'nav.subscription',
  '/parts/activity': 'nav.activity',
  '/support': 'nav.support',
  '/profile': 'nav.profile',
  '/parts/trash': 'nav.trash',
  '/my-vehicles': 'nav.myVehicles',
  '/my-orders': 'nav.myOrders',
}

export default function Layout() {
  useAdminNotifications()
  const { t } = useTranslation('cabinet')
  const location = useLocation()
  const { hasAnalytics } = useSubscriptionLimits()
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAdmin = useIsAdmin()

  // Сброс прокрутки внутреннего контейнера при переходе между страницами,
  // иначе новая страница открывается на позиции прокрутки предыдущей.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])
  const { loading: authLoading, user } = useAuth()
  const { data: profile, isFetching: profileFetching } = useUserProfile()
  // Скелетон пока идёт авторизация ИЛИ пользователь есть, но профиль ещё не загружен —
  // иначе на жёстком обновлении (Ctrl+Shift+F5) мелькает экран приветствия/выбора роли.
  const showSkeleton = authLoading || (!!user && !profile)
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

  // Контекст следует за МАРШРУТОМ (источник правды): на /parts всегда показываем
  // кабинет разборки, на /my-vehicles — «Мои авто». Иначе у админа/мультироли с
  // activeRole='user' пропадало нижнее меню при заходе на /parts/* напрямую.
  const userRoleSet = new Set((profile?.roles || []).map((r: any) => r.name))
  const canParts = userRoleSet.has('parts_owner') || userRoleSet.has('parts_worker') || userRoleSet.has('admin')
  if (location.pathname.startsWith('/parts') && canParts) {
    // Меню сотрудника — только для чистого parts_worker (без owner и без admin).
    // Админ/владелец видят полное меню разборки (включая «Подписка», «Аналитика»...).
    const workerOnly = userRoleSet.has('parts_worker') && !userRoleSet.has('parts_owner') && !userRoleSet.has('admin')
    roleNames = [workerOnly ? 'parts_worker' : 'parts_owner']
  } else if (location.pathname.startsWith('/my-vehicles') || location.pathname.startsWith('/my-orders')) {
    roleNames = ['user']
  }

  const activeRoleName = roleNames[0] || primaryRole?.name || ''

  // Текущий контекст для переключателя разделов (Админ исключаем — у него своя кнопка)
  const currentCtx: 'parts' | 'user' =
    activeRoleName.startsWith('parts') ? 'parts' : 'user'
  // «Мои авто»: меню из одного пункта — сайдбар не нужен, выход выносим вверх справа
  const isUserCtx = currentCtx === 'user'

  // Сколько разделов доступно (для шапки сайдбара: несколько → свитчер, один → лого)
  const ctxRoles = profile?.roles?.map((r: any) => r.name) || []
  const ctxAdmin = ctxRoles.includes('admin')
  const availableCtx = [
    ctxAdmin || ctxRoles.includes('parts_owner') || ctxRoles.includes('parts_worker'),
    ctxAdmin || ctxRoles.includes('user'),
    ctxAdmin,
  ].filter(Boolean).length
  const multiCtx = availableCtx > 1

  const filteredNavigation = getMenuForRoles(roleNames).filter((item) => {
    if (item.href === '/parts/analytics') return hasAnalytics
    return true
  })

  // Название пункта меню с переводом (fallback — русское имя из конфига).
  const navLabel = (item: { href: string; name: string }) =>
    t(NAV_KEY[item.href] ?? '', { defaultValue: item.name })

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

  // Пользователь авторизован но без роли — страница приветствия.
  // Пока профиль ещё догружается (например, после обновления версии) — показываем
  // скелетон, а не экран выбора роли, чтобы он не мелькал на пол-секунды.
  if (!primaryRole && filteredNavigation.length === 0) {
    if (profileFetching) return <LayoutSkeleton />
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
    <div
      className="flex flex-col md:flex-row h-dvh font-sans overscroll-none"
      // Кабинет «Ink & Signal»: акцент — чернила #16181D (hsl 223 14% 10%).
      // Переопределяем --primary только в обёртке кабинета (bg-primary/text-primary/фокус),
      // логин/админку не задевает. Фон — --cab-bg.
      style={{ '--primary': '223 14% 10%', background: 'var(--cab-bg)' } as React.CSSProperties}
    >

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR — Ink & Signal, md:w-16 → lg:w-64
          ════════════════════════════════════════════ */}
      <aside
        className={`${isUserCtx ? 'hidden' : 'hidden md:flex'} md:flex-col md:w-16 lg:w-64 flex-shrink-0`}
        style={{ background: 'var(--cab-surface)', borderRight: '1px solid var(--cab-border)' }}
      >
        {/* Шапка сайдбара: у админа — переключатель разделов вместо лого; иначе логотип */}
        <div className="flex items-center justify-center px-2 lg:px-3 h-14" style={{ borderBottom: '1px solid var(--cab-border)' }}>
          {isAdmin ? (
            <ContextSwitcher current={currentCtx} variant="segment" segLabels="lg" />
          ) : (
            <Link to="/parts/dashboard" className="inline-flex items-center flex-shrink-0 min-w-0" aria-label={BRAND.name}>
              <Logo size="sm" withText={false} className="lg:hidden flex-shrink-0" />
              <Logo size="sm" withText className="hidden lg:inline-flex flex-shrink-0" />
            </Link>
          )}
        </div>

        {/* Nav — сгруппирован: Работа / База / Система */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {PARTS_NAV_GROUPS.map((grp) => {
            const items = filteredNavigation.filter((i) => (i.group ?? 'system') === grp.id)
            if (items.length === 0) return null
            return (
              <div key={grp.id} className="space-y-0.5">
                <p className="cab-group-label hidden lg:block mb-1.5">{t(`groups.${grp.id}`)}</p>
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = item.href.includes('?')
                    ? location.pathname + location.search === item.href
                    : location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={navLabel(item)}
                      className={`cab-nav justify-center lg:justify-start active:scale-[0.98] ${isActive ? 'cab-nav-active' : ''}`}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                      <span className="hidden lg:block truncate">{navLabel(item)}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 space-y-0.5 border-t border-gray-200">
          {/* «Админ» — в верхнем баре (ContextSwitcher) */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-1 lg:px-3 py-2.5 text-sm rounded-lg transition-colors active:scale-[0.98] text-slate-600 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            <span className="hidden lg:block">{t('chrome.logout')}</span>
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
                <LogOut className="w-4 h-4" strokeWidth={1.5} /> {t('chrome.logout')}
              </button>
            </div>
          </div>
        )}

        {/* ── DESKTOP TOP BAR (разборка): слева — смена ролей (сразу за линией раздела
            сайдбара), справа — «В маркет». ── */}
        {currentCtx === 'parts' && (
          <div className="hidden md:flex h-14 flex-shrink-0"
            style={{ background: 'var(--cab-surface)', borderBottom: '1px solid var(--cab-border)' }}>
            <div className="mk-container flex items-center justify-between gap-3">
              <div className="min-w-0">
                {multiCtx && !isAdmin && <ContextSwitcher current={currentCtx} />}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <LanguageSwitcher />
                <Link
                  to="/market"
                  title={t('chrome.openMarket')}
                  className="market mk-btn mk-btn-outline"
                >
                  <Store className="w-4 h-4" strokeWidth={1.5} /> {t('chrome.toMarket')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE HEADER (hidden on md+) ── */}
        <div className="md:hidden bg-white border-b border-gray-200">
          <div className="px-3 flex items-center gap-2 h-[52px]">
            <div className="flex-1 min-w-0">
              <ContextSwitcher current={currentCtx} variant="mobile" />
            </div>
            <NotificationsBell userId={profile?.id} />
            {currentCtx === 'parts' && (
              <Link
                to="/market"
                title={t('chrome.openMarket')}
                aria-label="В маркет"
                className="market mk-btn mk-btn-outline flex-shrink-0"
              >
                <Store className="w-4 h-4" strokeWidth={1.5} /> <span className="hidden sm:inline">{t('chrome.toMarket')}</span>
              </Link>
            )}
          </div>
        </div>

        {/* ── MAIN CONTENT — тот же контейнер, что и в маркете (.mk-container) ── */}
        <div className="flex-1" style={{ background: 'var(--cab-bg)' }}>
          <div className="mk-container py-3 sm:py-4 md:py-5 lg:py-6">
            <NotificationBanner userId={profile?.id} />
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
                  isActive ? 'text-[#16181D]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-center leading-tight" style={{ fontSize: '11px' }}>
                  {navLabel(item)}
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
              <span className="text-center leading-tight" style={{ fontSize: '11px' }}>{t('chrome.menu')}</span>
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
              <span className="text-sm font-semibold text-gray-700">{t('chrome.menu')}</span>
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
                        ? 'bg-[#16181D] text-white font-semibold'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-center text-[11px] font-medium leading-tight line-clamp-2">{navLabel(item)}</span>
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
                  <span className="text-center text-[11px] font-medium leading-tight">{t('chrome.admin')}</span>
                </Link>
              )}
            </div>
            {/* Поиск + Выйти */}
            <div className="px-4 pb-4 pt-1 flex gap-2" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
              <button
                onClick={() => { setSheetOpen(false); setSearchOpen(true) }}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors active:scale-[0.98]"
              >
                <Search className="w-4 h-4" strokeWidth={1.5} /> {t('chrome.search')}
              </button>
              <button
                onClick={() => { setSheetOpen(false); handleLogout() }}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors active:scale-[0.98]"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} /> {t('chrome.logoutFull')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Плавающие инструменты (десктоп, разборка): уведомления + поиск в правом нижнем углу */}
      {currentCtx === 'parts' && (
        <div className="hidden md:flex fixed bottom-5 right-5 z-40 items-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full"
            style={{ background: 'var(--cab-surface)', border: '1px solid var(--cab-border)', boxShadow: '0 6px 20px -6px rgba(22,24,29,.20)' }}>
            <NotificationsBell userId={profile?.id} />
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            title="Поиск (Ctrl+K)"
            aria-label="Поиск"
            className="flex items-center justify-center w-12 h-12 rounded-full transition-colors"
            style={{ background: 'var(--cab-ink)', color: '#fff', boxShadow: '0 6px 20px -6px rgba(22,24,29,.35)' }}
          >
            <Search className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Глобальный поиск */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

    </div>
  )
}
