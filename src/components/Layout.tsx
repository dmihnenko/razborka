import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useRef } from 'react'
import {
  LogOut,
  Shield
} from 'lucide-react'
import { LayoutSkeleton } from './LayoutSkeleton'
import WaitingAccessPage from './WaitingAccessPage'
import OwnerSetupPage from './OwnerSetupPage'
import ContextSwitcher from './ContextSwitcher'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { getMenuForRoles } from '../config/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import Breadcrumbs from './Breadcrumbs'
import { useAdminNotifications } from '../hooks/useAdminNotifications'

export default function Layout() {
  useAdminNotifications()
  const location = useLocation()
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
  
  // Получаем PRIMARY роль пользователя
  // Приоритет ролей: admin > sto_owner > parts_owner > store_owner > worker roles > user
  const getRoleByPriority = (roles: any[]) => {
    const rolePriority = ['admin', 'sto_owner', 'parts_owner', 'store_owner', 'sto_worker', 'parts_worker', 'store_worker', 'user']
    for (const roleName of rolePriority) {
      const role = roles.find((r: any) => r.name === roleName)
      if (role) return role
    }
    return roles.find((r: any) => r.is_primary) || roles[0]
  }
  
  const primaryRole = profile?.roles?.length ? getRoleByPriority(profile?.roles) : null
  
  // Проверяем, является ли пользователь работником СТО
  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  
  // Загружаем настройки СТО для работников
  // Компания владельца — для проверки телефона
  const ownerCompanyId = profile?.sto_company_id || profile?.parts_company_id
  const ownerCompanyTable = profile?.sto_company_id ? 'sto_companies' : 'parts_companies'

  const { data: ownerCompany } = useQuery({
    queryKey: ['owner_company_phone', ownerCompanyId],
    enabled: !!ownerCompanyId && (
      !!profile?.roles?.some((r: any) => r.name === 'sto_owner' || r.name === 'parts_owner')
    ),
    queryFn: async () => {
      const { data } = await supabase
        .from(ownerCompanyTable)
        .select('id, name, phone')
        .eq('id', ownerCompanyId!)
        .single()
      return data
    },
  })

  const { data: stoCompany } = useQuery({
    queryKey: ['sto_company', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies')
        .select('services_menu_enabled')
        .eq('id', profile?.sto_company_id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id && (isStoWorker || isStoOwner),
    staleTime: 0,
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
  const currentCtx: 'sto' | 'parts' | 'user' =
    activeRoleName.startsWith('parts') ? 'parts'
      : activeRoleName === 'user' ? 'user'
      : 'sto'

  const navigation = getMenuForRoles(roleNames)
  
  // Фильтруем меню для работников СТО
  const filteredNavigation = useMemo(() => {
    // Если работник СТО и меню услуг выключено - убираем пункт Услуги
    if (isStoWorker && !isStoOwner) {
      const servicesMenuEnabled = stoCompany?.services_menu_enabled ?? true
      if (!servicesMenuEnabled) {
        return navigation.filter(item => item.href !== '/services')
      }
    }
    return navigation
  }, [navigation, isStoWorker, isStoOwner, stoCompany])

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

  // Владелец СТО/разборки без компании — обязан заполнить данные
  const isStoOwnerRole = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const isPartsOwnerRole = profile?.roles?.some((r: any) => r.name === 'parts_owner')
  // Нужна настройка: нет компании ИЛИ есть компания но без телефона (работники не смогут найти)
  const noCompany = (isStoOwnerRole && !profile?.sto_company_id) || (isPartsOwnerRole && !profile?.parts_company_id)
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

  return (
    <div className="flex flex-col md:flex-row h-dvh bg-gray-100 font-sans overscroll-none">

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR (hidden on mobile)
          ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex md:flex-col md:w-16 lg:w-64 bg-white border-r border-gray-200 flex-shrink-0"
      >
        {/* Переключатель раздела — сверху (дропдаун как в админке) */}
        <div className="hidden lg:flex items-center px-3 h-14 border-b border-gray-100">
          <ContextSwitcher current={currentCtx} />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
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
                className={`flex items-center justify-center lg:justify-start gap-3 px-1 lg:px-3 py-2.5 mb-0.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-gray-400'}`} strokeWidth={1.5} />
                <span className="hidden lg:block">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-100 space-y-0.5">
          {/* На lg админ доступен из дропдауна сверху; иконка остаётся только в свёрнутом md-сайдбаре */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="lg:hidden flex items-center justify-center gap-3 w-full px-1 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
              title="Админ панель"
            >
              <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" strokeWidth={1.5} />
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-1 lg:px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span className="hidden lg:block">Выход</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          SCROLLABLE COLUMN
          Mobile nav is INSIDE here so it scrolls away naturally
          on all platforms including iOS PWA (standalone mode)
          ════════════════════════════════════════════ */}
      <div ref={scrollRef} className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* ── MOBILE HEADER (hidden on md+) ── */}
        <div className="md:hidden bg-white border-b border-gray-200">
          {/* Top bar: кнопки роли + выйти */}
          <div className="px-3 border-b border-gray-100 bg-white flex items-center gap-2 h-[52px]">

            {/* Переключатель раздела — дропдаун как в админке */}
            <div className="flex-1 min-w-0">
              <ContextSwitcher current={currentCtx} />
            </div>

            {/* Кнопка Выйти */}
            <button onClick={handleLogout}
              className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-500 bg-gray-100 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Выйти</span>
            </button>
          </div>

          {/* Mobile Navigation — grid cards */}
          <nav className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2">
            {filteredNavigation.filter(item => !item.mobileHidden).map((item) => {
              const Icon = item.icon
              const isActive = item.href.includes('?')
                ? location.pathname + location.search === item.href
                : location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={item.href === '/admin' ? () => localStorage.removeItem('activeRole') : undefined}
                  className={`flex flex-col items-center justify-center gap-1.5 px-1 py-3 transition-colors rounded-xl min-h-[64px] ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : item.href === '/admin'
                      ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-center text-[11px] font-medium leading-tight line-clamp-2 mt-0.5">{item.name}</span>
                </Link>
              )
            })}
{/* Admin button rendered via adminMenu navigation items */}
          </nav>
        </div>

        {/* ── MAIN CONTENT ── */}
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
