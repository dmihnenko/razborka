import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { 
  LogOut,
  Shield,
  Wrench,
  Sun,
  Moon
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
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
  const { theme, setTheme } = useTheme()
  
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
    <div className="flex flex-col md:flex-row md:h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="md:hidden bg-[#0F1729] border-b border-[#1E2A3B]">
        {/* Top bar: logo + user + logout */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-medium text-gray-200 truncate">
              {profile?.full_name?.split(' ')[0] || profile?.email || 'CRM'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#94A3B8] bg-[#1E2A3B] rounded-md border border-[#2A3B50] flex-shrink-0 min-h-[36px] hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>

        {/* Horizontal scrollable nav pills */}
        <nav className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto scrollbar-hide">
          {filteredNavigation.filter(item => !item.mobileHidden).map((item) => {
            const Icon = item.icon
            const isActive = item.href.includes('?')
              ? location.pathname + location.search === item.href
              : location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap rounded-full flex-shrink-0 transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[#94A3B8] bg-[#1A2744] hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Admin Panel Button (if admin) */}
        {isAdmin && (
          <div className="px-3 pb-2.5">
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-purple-400 bg-[#1A2744] rounded-full border border-purple-500/30 hover:text-purple-300 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Админ панель</span>
            </Link>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-col md:w-16 lg:w-64 bg-[#0F1729] flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center lg:justify-start gap-2.5 px-2 lg:px-5 h-14 border-b border-[#1E2A3B]">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block text-sm font-semibold text-gray-100 truncate">
            {profile?.full_name?.split(' ')[0] || 'TSP CRM'}
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
                className={`relative flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-3 py-2 mb-0.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1A2744] text-white'
                    : 'text-[#94A3B8] hover:bg-[#1A2744]/70 hover:text-gray-200'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r hidden lg:block" />
                )}
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-[#4A6080]'}`} />
                <span className="hidden lg:block">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        {/* Footer */}
        <div className="px-2 py-3 border-t border-[#1E2A3B] space-y-0.5">
          {isAdmin && (
            <Link
              to="/admin"
              title="Админ панель"
              onClick={() => localStorage.removeItem('activeRole')}
              className="flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-3 py-2 text-sm font-medium text-purple-400 hover:bg-[#1A2744] hover:text-purple-300 rounded-lg transition-colors"
            >
              <Shield className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <span className="hidden lg:block">Админ панель</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            title="Выход"
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-3 py-2 text-sm font-medium text-[#64748B] hover:bg-[#1A2744] hover:text-gray-300 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block">Выход</span>
          </button>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            className="flex items-center justify-center lg:justify-start gap-3 w-full px-0 lg:px-3 py-2 text-sm font-medium text-[#64748B] hover:bg-[#1A2744] hover:text-gray-300 rounded-lg transition-colors"
          >
            {theme === 'dark'
              ? <Sun className="w-5 h-5 flex-shrink-0 text-yellow-400" />
              : <Moon className="w-5 h-5 flex-shrink-0 text-blue-400" />}
            <span className="hidden lg:block">{theme === 'dark' ? 'Светлая' : 'Тёмная'}</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="mx-auto max-w-[1440px] w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <Breadcrumbs />
          <Outlet />
        </div>
      </div>
    </div>
  )
}
