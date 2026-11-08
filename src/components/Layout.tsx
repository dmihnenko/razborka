import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LogOut,
  Shield,
  Menu,
  X,
  Search,
  Store,
  Car,
  Plus,
  Package,
  ShoppingCart,
  Ellipsis,
} from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import { LayoutSkeleton } from './LayoutSkeleton'
// Экраны-гейты (онбординг/ожидание доступа) показываются редко и тянут imask (~17KB gzip)
// на первый экран — грузим лениво, чтобы не утяжелять вход для всех остальных.
const WaitingAccessPage = lazy(() => import('./WaitingAccessPage'))
const OwnerSetupPage = lazy(() => import('./OwnerSetupPage'))
import ContextSwitcher from './ContextSwitcher'
import LanguageSwitcher from './LanguageSwitcher'
import NotificationsBell from './NotificationsBell'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { getMenuForRoles, PARTS_NAV_GROUPS, type MenuItem } from '../config/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { useSubscriptionLimits } from '../hooks/useSubscription'
import { countNewMarketplaceOrders } from '@/services/marketplaceService'
import NotificationBanner from './NotificationBanner'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator'
import { Logo } from './brand/Logo'
import { BRAND } from '@/config/brand'

// Роль пользователя в профиле (форма из useUserProfile: roles(id, name, ...) + is_primary).
interface ProfileRole {
  name: string
  is_primary?: boolean
}

// Ключи перевода названий пунктов меню (по href) — чтобы не менять navigation.ts.
const NAV_KEY: Record<string, string> = {
  '/parts/dashboard': 'nav.pulse',
  '/parts/inventory': 'nav.stock',
  '/parts/sales': 'nav.sales',
  '/parts/vehicles': 'nav.machines',
  '/parts/customers': 'nav.customers',
  '/parts/categories': 'nav.categoriesShort',
  '/parts/warehouse': 'nav.warehouse',
  '/parts/analytics': 'nav.reports',
  '/parts/roi': 'nav.roi',
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
  const navigate = useNavigate()
  const { hasAnalytics } = useSubscriptionLimits()
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Элемент скролла в state — чтобы pull-to-refresh перепривязался, когда контейнер
  // появится после скелета (иначе хук биндится к window и жест не ловится).
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const setScrollNode = useCallback((el: HTMLDivElement | null) => { scrollRef.current = el; setScrollEl(el) }, [])
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

  // Pull-to-refresh (мобайл): протяжка вниз у верха → мягкий рефетч активных запросов.
  const handlePullRefresh = useCallback(async () => {
    const started = Date.now()
    // Форсируем рефетч активных запросов (мимо staleTime) и ждём завершения.
    await queryClient.refetchQueries({ type: 'active' })
    const left = 500 - (Date.now() - started)
    if (left > 0) await new Promise(r => setTimeout(r, left)) // спиннер заметен
  }, [queryClient])
  // На страницах-формах (добавление/редактирование запчасти) протяжка вниз — это скролл
  // формы, а не рефреш; PTR перехватывал бы жест. Отключаем здесь.
  const isPartFormRoute =
    location.pathname === '/parts/inventory/new' ||
    /^\/parts\/inventory\/[^/]+\/edit$/.test(location.pathname)
  const { pull, refreshing } = usePullToRefresh({ onRefresh: handlePullRefresh, scrollEl, disabled: isPartFormRoute })

  // Шторка мобильного «Меню» (доп. пункты)
  const [sheetOpen, setSheetOpen] = useState(false)
  // Шторка быстрого создания (кнопка [+] в нижней панели)
  const [createOpen, setCreateOpen] = useState(false)
  // Шторка «+»: закрывается при переходе (в т.ч. аппаратным «назад») и по Escape
  useEffect(() => { setCreateOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!createOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCreateOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createOpen])

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
  const getRoleByPriority = (roles: ProfileRole[]) => {
    const rolePriority = ['admin', 'parts_owner', 'parts_worker', 'user']
    for (const roleName of rolePriority) {
      const role = roles.find((r) => r.name === roleName)
      if (role) return role
    }
    return roles.find((r) => r.is_primary) || roles[0]
  }

  const primaryRole = profile?.roles?.length ? getRoleByPriority(profile?.roles) : null

  // Компания владельца — для проверки телефона
  const ownerCompanyId = profile?.parts_company_id

  const { data: ownerCompany } = useQuery({
    queryKey: ['owner_company_phone', ownerCompanyId],
    enabled: !!ownerCompanyId && !!profile?.roles?.some((r: ProfileRole) => r.name === 'parts_owner'),
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
    const allRoles = profile?.roles?.map((r: ProfileRole) => r.name).filter((n: string) => n !== 'user') || []

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

  // Закрепляем контекст при входе в кабинет, чтобы общие страницы (/support, /profile)
  // НЕ сбрасывали меню разборки на дефолт (баг «пропадают пункты / становлюсь работником»).
  useEffect(() => {
    const roles = new Set((profile?.roles || []).map((r: ProfileRole) => r.name))
    const canP = roles.has('parts_owner') || roles.has('parts_worker') || roles.has('admin')
    const p = location.pathname
    if (p.startsWith('/parts') && canP) {
      const wo = roles.has('parts_worker') && !roles.has('parts_owner') && !roles.has('admin')
      localStorage.setItem('activeRole', wo ? 'parts_worker' : 'parts_owner')
    } else if (p.startsWith('/my-vehicles') || p.startsWith('/my-orders')) {
      localStorage.setItem('activeRole', 'user')
    }
  }, [location.pathname, profile?.roles])

  // Получаем меню на основе активной роли
  // Поддерживаем переключение для ВСЕХ пользователей с несколькими ролями
  let roleNames: string[] = []
  const allUserRoles = profile?.roles?.map((r: ProfileRole) => r.name).filter((n: string) => n !== 'user') || []
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
  const userRoleSet = new Set((profile?.roles || []).map((r: ProfileRole) => r.name))
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
  const ctxRoles = profile?.roles?.map((r: ProfileRole) => r.name) || []
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
  // Активность пункта: по префиксам match (карточки заказов подсвечивают «Продажи»)
  const isItemActive = (item: MenuItem) => {
    const prefixes = item.match ?? [item.href.split('?')[0]]
    const path = location.pathname
    return prefixes.some((p) => path === p || path.startsWith(p + '/'))
  }

  // Счётчик новых заявок с маркета — бейдж на пункте «Продажи».
  // Ключ вложен в ['marketplace-orders', companyId] → инвалидации со страницы заявок
  // обновляют и его.
  const partsCompanyIdForBadge = profile?.parts_company_id
  const { data: newMarketCount = 0 } = useQuery({
    queryKey: ['marketplace-orders', partsCompanyIdForBadge, 'new-count'],
    queryFn: () => countNewMarketplaceOrders(partsCompanyIdForBadge!),
    enabled: !!partsCompanyIdForBadge && currentCtx === 'parts',
    staleTime: 60_000,
    refetchInterval: 120_000,
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

  // Пользователь авторизован но без роли — страница приветствия.
  // Пока профиль ещё догружается (например, после обновления версии) — показываем
  // скелетон, а не экран выбора роли, чтобы он не мелькал на пол-секунды.
  if (!primaryRole && filteredNavigation.length === 0) {
    if (profileFetching) return <LayoutSkeleton />
    return (
      <Suspense fallback={<LayoutSkeleton />}>
        <WaitingAccessPage
          profile={profile}
          onLogout={handleLogout}
        />
      </Suspense>
    )
  }

  // Владелец разборки без компании — обязан заполнить данные
  const isPartsOwnerRole = profile?.roles?.some((r: ProfileRole) => r.name === 'parts_owner')
  // Нужна настройка: нет компании ИЛИ есть компания но без телефона (работники не смогут найти)
  const noCompany = isPartsOwnerRole && !profile?.parts_company_id
  const hasCompanyNoPhone = ownerCompanyId && ownerCompany !== undefined && !ownerCompany?.phone
  const needsSetup = noCompany || !!hasCompanyNoPhone

  if (needsSetup && primaryRole) {
    return (
      <Suspense fallback={<LayoutSkeleton />}>
        <OwnerSetupPage
          profile={profile}
          onLogout={handleLogout}
          onComplete={() => { localStorage.removeItem('tsp_profile_cache'); window.location.reload() }}
          existingCompanyId={hasCompanyNoPhone ? ownerCompanyId : undefined}
          existingCompanyName={hasCompanyNoPhone ? ownerCompany?.name : undefined}
        />
      </Suspense>
    )
  }

  // ── Мобильные пункты (без mobileHidden) ──────────────────────────────────
  const mobileNavItems = filteredNavigation.filter(item => !item.mobileHidden)

  // Контекст-ссылки в нижней шторке (смена раздела ВЕЗДЕ вынесена в нижнее меню, не в шапку).
  // Показываем ссылку на раздел, только если он доступен И это НЕ текущий раздел:
  //  • «Разборка» — если есть доступ к кабинету разборки (админ/parts_*);
  //  • «Мои авто» — если доступен раздел личных авто (админ или роль user);
  //  • «Админ» — если пользователь админ и /admin нет в самом меню.
  const adminInNav = filteredNavigation.some(i => i.href === '/admin')
  const showAdminInSheet = isAdmin && !adminInNav
  // У админа смена «Разборка ⇄ Мои авто» — кнопкой в мобильной шапке, в шторке не дублируем.
  // Кнопку «В маркет» админу в шапке не ставим (нет места) — она уходит строкой в шторку.
  const showPartsCtxInSheet = !isAdmin && ctxRoles.some((r: string) => r === 'parts_owner' || r === 'parts_worker') && currentCtx !== 'parts'
  const showUserCtxInSheet = !isAdmin && ctxRoles.includes('user') && currentCtx !== 'user'
  const showMarketInSheet = isAdmin && currentCtx === 'parts'
  const hasCtxLinks = showAdminInSheet || showPartsCtxInSheet || showUserCtxInSheet || showMarketInSheet

  // Остальные пункты шторки — блоками по группам навигации (как в сайдбаре десктопа),
  // блоки разделяются тонкой линией без подписей. Пункты без группы — отдельным блоком.
  const SHEET_GROUP_ORDER = ['main', 'more'] as const

  // Кабинет разборки: панель Пульт · Склад · [+] · Продажи · Ещё; остальное — в шторке «Ещё».
  const isPartsBar = currentCtx === 'parts'
  const BAR_LEFT = ['/parts/dashboard', '/parts/inventory']
  const BAR_RIGHT = ['/parts/sales']
  const partsBarLeft = mobileNavItems.filter(i => BAR_LEFT.includes(i.href))
  const partsBarRight = mobileNavItems.filter(i => BAR_RIGHT.includes(i.href))

  // Если ≤4 пункта — все в нижнем баре; иначе первые 4 + кнопка «Меню» (5-й слот).
  // Кнопку «Меню» показываем и когда основных пунктов ≤4, но есть контекст-ссылки
  // (Админ/Мои авто) — иначе шторку не открыть.
  const showMobileSheet = isPartsBar || mobileNavItems.length > 4 || hasCtxLinks
  const mobileBarItems = isPartsBar ? [] : showMobileSheet ? mobileNavItems.slice(0, 4) : mobileNavItems
  const mobileSheetItems = isPartsBar
    ? mobileNavItems.filter(i => !BAR_LEFT.includes(i.href) && !BAR_RIGHT.includes(i.href))
    : showMobileSheet ? mobileNavItems.slice(4) : []
  const sheetGroups = [
    ...SHEET_GROUP_ORDER.map(g => mobileSheetItems.filter(i => i.group === g)),
    mobileSheetItems.filter(i => !i.group),
  ].filter(list => list.length > 0)

  const renderBarItem = (item: MenuItem) => {
    const Icon = item.icon
    const isActive = isItemActive(item)
    return (
      <Link
        key={item.href}
        to={item.href}
        className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
          isActive ? 'font-semibold' : 'text-gray-400 hover:text-gray-600'
        }`}
        style={isActive ? { color: 'var(--cab-ink)' } : undefined}
      >
        {/* Метка активного пункта — тонкая полоска сверху */}
        {isActive && (
          <span aria-hidden className="absolute top-0 inset-x-[22%] h-0.5 rounded-b" style={{ background: 'var(--cab-ink)' }} />
        )}
        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
        <span className="text-center leading-tight truncate max-w-full px-0.5" style={{ fontSize: '11px' }}>
          {navLabel(item)}
        </span>
        {item.href === '/parts/sales' && newMarketCount > 0 && (
          <span
            className="absolute top-1.5 left-[calc(50%+4px)] min-w-[16px] h-4 px-1 rounded-lg text-white text-center font-bold"
            style={{ background: 'var(--cab-signal)', fontSize: '9.5px', lineHeight: '16px' }}
            aria-label={t('nav.newMarketOrders', { defaultValue: 'Новых заявок: {{n}}', n: newMarketCount })}
          >
            {newMarketCount > 99 ? '99+' : newMarketCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div
      className="flex flex-col md:flex-row h-dvh font-sans overscroll-none"
      // Кабинет «Ink & Signal»: акцент — чернила #16181D (hsl 223 14% 10%).
      // Переопределяем --primary только в обёртке кабинета (bg-primary/text-primary/фокус),
      // логин/админку не задевает. Фон — --cab-bg.
      style={{ '--primary': '223 14% 10%', background: 'var(--cab-bg)' } as React.CSSProperties}
    >
      <PullToRefreshIndicator pull={pull} refreshing={refreshing} />

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR — Ink & Signal, md:w-16 → lg:w-64
          ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex md:flex-col md:w-16 lg:w-64 flex-shrink-0"
        style={{ background: 'var(--cab-surface)', borderRight: '1px solid var(--cab-border)' }}
      >
        {/* Шапка сайдбара: «Мои авто» и админ — переключатель разделов; иначе логотип */}
        <div className="flex items-center justify-center px-2 lg:px-3 h-14" style={{ borderBottom: '1px solid var(--cab-border)' }}>
          {isUserCtx ? (
            <ContextSwitcher current={currentCtx} />
          ) : isAdmin ? (
            <ContextSwitcher current={currentCtx} variant="segment" segLabels="lg" />
          ) : (
            <Link to="/parts/dashboard" className="inline-flex items-center flex-shrink-0 min-w-0" aria-label={BRAND.name}>
              <Logo size="sm" withText={false} className="lg:hidden flex-shrink-0" />
              <Logo size="sm" withText className="hidden lg:inline-flex flex-shrink-0" />
            </Link>
          )}
        </div>

        {/* Nav: «Мои авто» — плоский список; разборка/админ — по группам Работа/База/Система */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-2">
          {isUserCtx ? (
            <div className="space-y-0.5">
              {filteredNavigation.map((item) => {
                const Icon = item.icon
                const isActive = isItemActive(item)
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
          ) : PARTS_NAV_GROUPS.map((grp) => {
            const items = filteredNavigation.filter((i) => (i.group ?? 'more') === grp.id)
            if (items.length === 0) return null
            return (
              <div key={grp.id} className={`space-y-0.5 ${grp.id === 'more' ? 'pt-2 border-t' : ''}`} style={grp.id === 'more' ? { borderColor: 'var(--cab-border)' } : undefined}>
                {grp.id === 'more' && <p className="cab-group-label hidden lg:block mb-1">{t('groups.more', { defaultValue: grp.label })}</p>}
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = isItemActive(item)
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={navLabel(item)}
                      className={`cab-nav justify-center lg:justify-start active:scale-[0.98] ${isActive ? 'cab-nav-active' : ''}`}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                      <span className="hidden lg:block truncate">{navLabel(item)}</span>
                      {item.href === '/parts/sales' && newMarketCount > 0 && (
                        <span
                          className="ml-auto hidden lg:inline-block min-w-[18px] h-[18px] px-1 rounded-md text-white text-center font-bold"
                          style={{ background: 'var(--cab-signal)', fontSize: '10px', lineHeight: '18px' }}
                          aria-label={t('nav.newMarketOrders', { defaultValue: 'Новых заявок: {{n}}', n: newMarketCount })}
                        >
                          {newMarketCount > 99 ? '99+' : newMarketCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-2 space-y-0.5 border-t border-gray-200">
          {/* «Админ» — в верхнем баре (ContextSwitcher) */}
          <button
            onClick={handleLogout}
            aria-label={t('chrome.logout')}
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
      <div ref={setScrollNode} className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* ── DESKTOP TOP BAR для «Мои авто»: переключатель разделов и выход теперь
            в сайдбаре — здесь только язык и уведомления. ── */}
        {isUserCtx && (
          <div className="hidden md:flex items-center justify-end gap-3 h-14 px-6"
            style={{ background: 'var(--cab-surface)', borderBottom: '1px solid var(--cab-border)' }}>
            <LanguageSwitcher />
            <NotificationsBell userId={profile?.id} />
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
              {/* Смена раздела вынесена в нижнее меню у всех ролей — в шапке только логотип. */}
              <Link to={isUserCtx ? '/my-vehicles' : '/parts/dashboard'} aria-label={BRAND.name} className="inline-flex items-center min-w-0">
                <Logo size="sm" withText />
              </Link>
            </div>
            {/* Админ: смена раздела в один тап — «Мои авто» из кабинета, «Разборка» обратно */}
            {isAdmin && (
              <Link
                to={currentCtx === 'parts' ? '/my-vehicles' : '/parts/dashboard'}
                className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs font-semibold flex-shrink-0 whitespace-nowrap"
                style={{ background: 'var(--cab-signal-weak)', color: 'var(--cab-signal)' }}
              >
                {currentCtx === 'parts'
                  ? <><Car className="w-4 h-4" strokeWidth={1.6} />{t('chrome.myCars', { defaultValue: 'Мои авто' })}</>
                  : <><Store className="w-4 h-4" strokeWidth={1.6} />{t('chrome.parts', { defaultValue: 'Разборка' })}</>}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t('chrome.search')}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0 transition-colors"
            >
              <Search className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <NotificationsBell userId={profile?.id} />
            {currentCtx === 'parts' && !isAdmin && (
              <Link
                to="/market"
                title={t('chrome.openMarket')}
                aria-label={t('chrome.toMarket')}
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
          MOBILE BOTTOM NAV (md:hidden, fixed) — во всех разделах, включая «Мои авто»
          ════════════════════════════════════════════ */}
      <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {(isPartsBar ? partsBarLeft : mobileBarItems).map(renderBarItem)}

          {/* Кабинет разборки: центральная кнопка быстрого создания */}
          {isPartsBar && (
            <div className="flex-1 flex items-center justify-center min-h-[56px]">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label={t('createSheet.title', { defaultValue: 'Создать' })}
                aria-haspopup="dialog"
                className="w-11 h-11 rounded-lg flex items-center justify-center text-white active:scale-95 transition-transform"
                style={{ background: 'var(--cab-ink)' }}
              >
                <Plus className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          )}

          {isPartsBar && partsBarRight.map(renderBarItem)}

          {/* Последний слот — «Ещё» (кабинет) / «Меню» если пунктов > 4 */}
          {showMobileSheet && (
            <button
              onClick={() => setSheetOpen(true)}
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isPartsBar
                ? <Ellipsis className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                : <Menu className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />}
              <span className="text-center leading-tight" style={{ fontSize: '11px' }}>
                {isPartsBar ? t('nav.more', { defaultValue: 'Ещё' }) : t('chrome.menu')}
              </span>
            </button>
          )}
        </nav>

      {/* ════════════════════════════════════════════
          CREATE SHEET — быстрое создание (запчасть / авто / продажа)
          ════════════════════════════════════════════ */}
      {createOpen && isPartsBar && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.40)' }}
          onClick={() => setCreateOpen(false)}
        >
          <div
            role="dialog"
            aria-label={t('createSheet.title', { defaultValue: 'Создать' })}
            className="w-full bg-white rounded-t-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{t('createSheet.title', { defaultValue: 'Создать' })}</span>
              <button
                onClick={() => setCreateOpen(false)}
                aria-label={t('chrome.closeMenu')}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div
              className="grid grid-cols-3 gap-2 px-3 pt-3"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {([
                { key: 'part', Icon: Package, label: t('createSheet.part', { defaultValue: 'Запчасть' }), to: '/parts/inventory/new' },
                { key: 'vehicle', Icon: Car, label: t('createSheet.vehicle', { defaultValue: 'Авто' }), to: '/parts/vehicles?new=1' },
                { key: 'sale', Icon: ShoppingCart, label: t('createSheet.sale', { defaultValue: 'Продажа' }), to: '/parts/orders/create' },
              ]).map(({ key, Icon, label, to }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setCreateOpen(false); navigate(to) }}
                  className="flex flex-col items-center justify-center gap-1.5 min-h-[76px] rounded-lg border active:scale-[0.98] transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--cab-border)', color: 'var(--cab-ink)' }}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.6} />
                  <span className="text-[13px] font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
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
            className="w-full bg-white rounded-t-2xl max-h-[85dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Ручка */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            {/* Шапка шторки */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-700">{isPartsBar ? t('nav.more', { defaultValue: 'Ещё' }) : t('chrome.menu')}</span>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label={t('chrome.closeMenu')}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pt-2 pb-1">
              {/* Разделы: панель админа / маркет (админ) / смена раздела (мультироль без админа) */}
              {hasCtxLinks && (
                <div className={`grid grid-cols-1 gap-0.5 ${sheetGroups.length ? 'pb-2 mb-2 border-b border-gray-100' : ''}`}>
                  {showAdminInSheet && (
                    <Link
                      to="/admin"
                      onClick={() => { localStorage.removeItem('activeRole'); setSheetOpen(false) }}
                      className="flex items-center gap-2.5 min-h-[44px] px-2.5 rounded-lg text-[13px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                      <Shield className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.6} style={{ color: 'var(--cab-signal)' }} />
                      {t('chrome.adminPanel', { defaultValue: 'Панель администратора' })}
                    </Link>
                  )}
                  {showMarketInSheet && (
                    <Link
                      to="/market"
                      onClick={() => setSheetOpen(false)}
                      className="flex items-center gap-2.5 min-h-[44px] px-2.5 rounded-lg text-[13px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                      <Store className="w-[18px] h-[18px] flex-shrink-0 text-gray-400" strokeWidth={1.6} />
                      {t('chrome.toMarket')}
                    </Link>
                  )}
                  {showPartsCtxInSheet && (
                    <Link
                      to="/parts/dashboard"
                      onClick={() => {
                        localStorage.setItem('activeRole', (ctxRoles.includes('parts_worker') && !ctxRoles.includes('parts_owner')) ? 'parts_worker' : 'parts_owner')
                        setSheetOpen(false)
                      }}
                      className="flex items-center gap-2.5 min-h-[44px] px-2.5 rounded-lg text-[13px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                      <Store className="w-[18px] h-[18px] flex-shrink-0 text-gray-400" strokeWidth={1.6} />
                      {t('chrome.parts', { defaultValue: 'Разборка' })}
                    </Link>
                  )}
                  {showUserCtxInSheet && (
                    <Link
                      to="/my-vehicles"
                      onClick={() => { localStorage.setItem('activeRole', 'user'); setSheetOpen(false) }}
                      className="flex items-center gap-2.5 min-h-[44px] px-2.5 rounded-lg text-[13px] font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                      <Car className="w-[18px] h-[18px] flex-shrink-0 text-gray-400" strokeWidth={1.6} />
                      {t('chrome.myCars', { defaultValue: 'Мои авто' })}
                    </Link>
                  )}
                </div>
              )}

              {/* Пункты меню: 2 колонки строк; группы — через тонкую линию, без подписей */}
              {sheetGroups.map((list, gi) => (
                <div key={gi} className={gi > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {list.map((item) => {
                      const Icon = item.icon
                      const isActive = isItemActive(item)
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setSheetOpen(false)}
                          className={`flex items-center gap-2.5 min-h-[44px] px-2.5 rounded-lg text-[13px] min-w-0 transition-colors ${
                            isActive ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          <Icon
                            className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
                            strokeWidth={1.6}
                          />
                          <span className="truncate">{navLabel(item)}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Аккаунт + тихий «Выйти». Отступ под вырез экрана — только здесь (раньше дважды). */}
            <div
              className="flex items-center justify-between gap-3 mx-3 mt-1 pt-2 border-t border-gray-100 flex-shrink-0"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <span className="text-xs text-gray-400 truncate min-w-0">{user?.email}</span>
              <button
                type="button"
                onClick={() => { setSheetOpen(false); handleLogout() }}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-red-600 hover:bg-red-50 flex-shrink-0 transition-colors"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.6} /> {t('chrome.logoutFull')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Плавающие инструменты (десктоп, разборка): уведомления + поиск в правом нижнем углу */}
      {currentCtx === 'parts' && (
        <div className="hidden md:flex fixed bottom-5 right-5 z-40 items-center gap-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg"
            style={{ background: 'var(--cab-surface)', border: '1px solid var(--cab-border)', boxShadow: '0 6px 20px -6px rgba(22,24,29,.20)' }}>
            <NotificationsBell userId={profile?.id} />
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            title={`${t('chrome.search')} (Ctrl+K)`}
            aria-label={t('chrome.search')}
            className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors"
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
