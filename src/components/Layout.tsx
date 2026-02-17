import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { 
  LogOut,
  Shield
} from 'lucide-react'
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

  // Показываем загрузчик только при первой загрузке профиля или если нет меню
  if (isLoading || (!filteredNavigation || filteredNavigation.length === 0)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row md:h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b">
        {/* User Name Display with Logout */}
        <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-700 truncate flex-1">
            {profile?.full_name || profile?.email || 'Пользователь'}
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-md border border-red-200 flex-shrink-0 min-h-[36px] hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
        
        {/* Mobile Navigation - Grid для лучшей адаптивности */}
        <nav className="grid grid-cols-3 gap-2 p-2">
          {filteredNavigation.filter(item => !item.mobileHidden).map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors rounded-lg min-h-[64px] ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-center leading-tight line-clamp-2">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        
        {/* Admin Panel Button (if admin) */}
        {isAdmin && (
          <div className="px-2 pb-2">
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg border border-purple-200 min-h-[44px] hover:bg-purple-100 transition-colors"
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Админ панель</span>
            </Link>
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 bg-white shadow-md">
        <div className="flex items-center justify-center h-16 border-b">
          <h1 className="text-xl font-bold text-primary">CRM</h1>
        </div>
        {/* User Name Display */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700 truncate">
            {profile?.full_name || profile?.email || 'Пользователь'}
          </p>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto pb-20">
          {filteredNavigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t bg-white space-y-2">
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-50 rounded-md border border-purple-200"
            >
              <Shield className="w-5 h-5 mr-3" />
              Админ панель
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 rounded-md"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Выход
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-3 sm:p-4 md:p-6 lg:p-8">
          <Breadcrumbs />
          <Outlet />
        </div>
      </div>
    </div>
  )
}
