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

  // User initials avatar
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : (profile?.email?.[0] || 'U').toUpperCase()

  return (
    <div className="flex flex-col md:flex-row md:h-screen font-sans" style={{ backgroundColor: '#F8FAFC' }}>

      {/* ════════════════════════════════════════════
          MOBILE HEADER (hidden on md+)
          ════════════════════════════════════════════ */}
      <div className="md:hidden sticky top-0 z-40" style={{ backgroundColor: '#0C1220' }}>
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white truncate">
              {profile?.full_name?.split(' ')[0] || 'CRM'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg min-h-[36px] transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: '#94A3B8' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </button>
        </div>

        {/* Navigation pills */}
        <nav className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
          {filteredNavigation.filter(item => !item.mobileHidden).map((item) => {
            const Icon = item.icon
            const isActive = item.href.includes('?')
              ? location.pathname + location.search === item.href
              : location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg flex-shrink-0 transition-all"
                style={isActive
                  ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
                  : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#94A3B8' }
                }
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            )
          })}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => localStorage.removeItem('activeRole')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg flex-shrink-0 transition-all"
              style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}
            >
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Админ</span>
            </Link>
          )}
        </nav>
      </div>

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR (hidden on mobile)
          ════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex md:flex-col md:w-[60px] lg:w-[220px] xl:w-[240px] flex-shrink-0"
        style={{ backgroundColor: '#0C1220', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-center lg:justify-start gap-3 h-14 px-2 lg:px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-bold text-white truncate leading-tight">TSP CRM</p>
            <p className="text-[11px] truncate" style={{ color: '#475569' }}>Автосервис</p>
          </div>
        </div>

        {/* Nav items */}
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
                className="relative flex items-center justify-center lg:justify-start gap-3 py-2.5 px-2 lg:px-3 rounded-lg transition-all duration-150 group"
                style={isActive
                  ? { backgroundColor: '#1E3A6E', color: '#FFFFFF' }
                  : { color: '#64748B' }
                }
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#E2E8F0' }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748B' } }}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-400 rounded-r hidden lg:block" />
                )}
                <Icon
                  className="w-[18px] h-[18px] flex-shrink-0"
                  style={{ color: isActive ? '#60A5FA' : 'inherit' }}
                />
                <span className="hidden lg:block text-sm font-medium leading-none">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer: admin link + user block + logout */}
        <div className="flex-shrink-0 px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {isAdmin && (
            <Link
              to="/admin"
              title="Админ панель"
              onClick={() => localStorage.removeItem('activeRole')}
              className="flex items-center justify-center lg:justify-start gap-3 py-2 px-2 lg:px-3 rounded-lg transition-all duration-150"
              style={{ color: '#A78BFA' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(139,92,246,0.1)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              <Shield className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="hidden lg:block text-sm font-medium">Админ</span>
            </Link>
          )}

          {/* User info */}
          <div className="flex items-center justify-center lg:justify-start gap-2.5 py-2 px-2 lg:px-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ backgroundColor: '#1E3A6E', color: '#93C5FD' }}
            >
              {initials}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: '#CBD5E1' }}>
                {profile?.full_name || profile?.email || 'Пользователь'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Выход"
            className="flex items-center justify-center lg:justify-start gap-3 w-full py-2 px-2 lg:px-3 rounded-lg transition-all duration-150 text-sm font-medium"
            style={{ color: '#475569' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#475569' }}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="hidden lg:block">Выход</span>
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════════════════ */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F8FAFC' }}>
        <div className="mx-auto max-w-[1440px] w-full px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <Breadcrumbs />
          <Outlet />
        </div>
      </div>
    </div>
  )
}
