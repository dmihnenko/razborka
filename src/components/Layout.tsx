import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { 
  LogOut,
  Shield,
  Wrench
} from 'lucide-react'
import { LayoutSkeleton } from './LayoutSkeleton'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { getMenuForRoles } from '../config/navigation'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import Breadcrumbs from './Breadcrumbs'

export default function Layout() {
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const { data: profile, isLoading } = useUserProfile()
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
  
  const primaryRole = profile?.roles?.length ? getRoleByPriority(profile.roles) : null
  
  // Проверяем, является ли пользователь работником СТО
  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  
  // Загружаем настройки СТО для работников
  const { data: stoCompany } = useQuery({
    queryKey: ['sto_company', profile?.sto_company_id],
    queryFn: async () => {
      if (!profile?.sto_company_id) return null
      const { data, error } = await supabase
        .from('sto_companies')
        .select('services_menu_enabled')
        .eq('id', profile.sto_company_id)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id && (isStoWorker || isStoOwner),
    staleTime: 0,
  })
  
  // Управляем activeRole в localStorage
  useEffect(() => {
    // Если админ зашел первый раз и activeRole не установлена, устанавливаем 'user'
    if (primaryRole?.name === 'admin' && !localStorage.getItem('activeRole')) {
      localStorage.setItem('activeRole', 'user')
    }
    
    // Для не-админов очищаем activeRole из localStorage
    if (primaryRole && primaryRole.name !== 'admin') {
      localStorage.removeItem('activeRole')
    }
  }, [primaryRole])
  
  // Получаем меню на основе PRIMARY роли пользователя
  // Для админа проверяем activeRole из localStorage
  let roleNames: string[] = []
  
  // Если пользователь админ, проверяем активную роль из localStorage
  if (primaryRole?.name === 'admin') {
    const activeRole = localStorage.getItem('activeRole')
    if (activeRole && activeRole !== 'admin') {
      roleNames = [activeRole]
    } else {
      // По умолчанию для админа - user меню
      roleNames = ['user']
    }
  } else if (primaryRole) {
    // Для не-админов всегда используем их основную роль
    roleNames = [primaryRole.name]
  } else if (profile?.roles?.length) {
    // Если primaryRole не найдена, берем первую роль
    roleNames = [profile.roles[0].name]
  }
  
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
    
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    }
  }

  // Показываем загрузчик при первой загрузке профиля
  if (isLoading || !profile) {
    return <LayoutSkeleton />
  }

  // Пользователь авторизован но без роли — ожидает назначения
  if (!primaryRole && filteredNavigation.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="max-w-md w-full mx-4 p-8 bg-white rounded-lg shadow-md text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">⏳</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Ожидание доступа</h2>
          <p className="text-gray-600">
            Ваш аккаунт создан. Обратитесь к администратору, чтобы он назначил вам роль.
          </p>
          <p className="text-sm text-gray-400">
            {profile.email || profile.username}
          </p>
          <button
            onClick={handleLogout}
            className="mt-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
          >
            Выйти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans">

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR (hidden on mobile)
          ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex md:flex-col md:w-16 lg:w-64 bg-white border-r border-gray-200 flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center justify-center lg:justify-start gap-2.5 px-2 lg:px-5 h-14 border-b border-gray-100">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block text-sm font-semibold text-gray-800 truncate">
            {profile?.full_name?.split(' ')[0] || 'CRM'}
          </span>
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
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                <span className="hidden lg:block">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-100 space-y-0.5">
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="flex items-center justify-center lg:justify-start gap-3 w-full px-1 lg:px-3 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
              <span className="hidden lg:block">Админ панель</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-1 lg:px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block">Выход</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          SCROLLABLE COLUMN
          Mobile nav is INSIDE here so it scrolls away naturally
          on all platforms including iOS PWA (standalone mode)
          ════════════════════════════════════════════ */}
      <div className="flex-1 overflow-auto flex flex-col min-w-0">

        {/* ── MOBILE HEADER (hidden on md+) ── */}
        <div className="md:hidden bg-white border-b border-gray-200">
          {/* Top bar: user name + logout */}
          <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 truncate flex-1">
              {profile?.full_name || profile?.email || 'Пользователь'}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => localStorage.removeItem('activeRole')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md border border-purple-200 min-h-[36px] hover:bg-purple-100 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span>Админ</span>
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md border border-red-200 min-h-[36px] hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Выйти</span>
              </button>
            </div>
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
                  className={`flex flex-col items-center justify-center gap-1.5 px-1 py-3 text-[11px] font-medium transition-colors rounded-xl min-h-[64px] ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : item.href === '/admin'
                      ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${item.href === '/admin' && !isActive ? 'text-purple-500' : ''}`} />
                  <span className="text-center leading-tight line-clamp-2">{item.name}</span>
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
