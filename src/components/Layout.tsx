import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { 
  LogOut,
  Shield
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { getMenuForRoles } from '../config/navigation'
import { useQueryClient } from '@tanstack/react-query'

export default function Layout() {
  const location = useLocation()
  const isAdmin = useIsAdmin()
  const { data: profile, isLoading, refetch } = useUserProfile()
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

  const handleLogout = async () => {
    // Очищаем весь кэш React Query перед выходом
    queryClient.clear()
    
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    }
  }

  // Показываем загрузчик пока профиль загружается или если нет меню
  if (isLoading || (!navigation || navigation.length === 0)) {
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
        {/* User Name Display */}
        <div className="px-4 py-2 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700">
            {profile?.full_name || profile?.email || 'Пользователь'}
          </p>
        </div>
        <nav className="flex px-4 py-2 gap-2">
          {navigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap rounded-md ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-700 bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-purple-700 bg-purple-50 rounded-md whitespace-nowrap border border-purple-200"
            >
              <Shield className="w-4 h-4" />
              Админ панель
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </nav>
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
          {navigation.map((item) => {
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
        <div className="p-4 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
