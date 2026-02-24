import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  Database,
  LogOut,
  Building2,
  Store,
  CreditCard,
  MessageSquare,
  Car
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import Breadcrumbs from './Breadcrumbs'

// Группировка меню для удобства
const adminNavigationGroups = [
  {
    title: 'Основное',
    items: [
      { name: 'Обзор', href: '/admin', icon: Shield },
      { name: 'Пользователи', href: '/admin/users', icon: Users },
      { name: 'Роли', href: '/admin/roles', icon: Shield },
    ]
  },
  {
    title: 'Компании',
    items: [
      { name: 'СТО', href: '/admin/sto', icon: Building2 },
      { name: 'Разборки', href: '/admin/parts-companies', icon: Store },
    ]
  },
  {
    title: 'Система',
    items: [
      { name: 'Подписки', href: '/admin/subscriptions', icon: CreditCard },
      { name: 'Поддержка', href: '/admin/support', icon: MessageSquare },
      { name: 'Настройки', href: '/admin/settings', icon: Settings },
      { name: 'Аналитика', href: '/admin/analytics', icon: BarChart3 },
      { name: 'База данных', href: '/admin/database', icon: Database },
    ]
  }
]

// Плоский список для desktop sidebar
const adminNavigation = adminNavigationGroups.flatMap(group => group.items)

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { data: profile, isLoading } = useUserProfile()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    }
  }

  // Показываем загрузку пока профиль загружается
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // Только после загрузки проверяем права
  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">
            Доступ запрещен
          </h2>
          <p className="text-red-600">
            У вас нет прав для доступа к панели администратора.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row md:h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b">{/* User Info with Logout */}
        {/* User Info with Logout */}
        <div className="px-3 sm:px-4 py-2 border-b bg-purple-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-700 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-purple-900 truncate">
                Админ панель
              </p>
              <p className="text-[10px] sm:text-xs text-purple-700 truncate">
                {profile?.full_name || profile?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium text-red-700 bg-red-50 rounded-md border border-red-200 flex-shrink-0 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
        
        {/* Mobile Navigation - Grouped */}
        <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 max-h-[calc(100vh-80px)] overflow-y-auto">
          {adminNavigationGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5 sm:mb-2">
                {group.title}
              </h3>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-2 sm:py-3 text-[10px] sm:text-xs font-medium transition-colors rounded-lg min-h-[60px] sm:min-h-[70px] ${
                        isActive
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <span className="text-center leading-tight line-clamp-2">{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
          
          {/* Quick Access */}
          <div>
            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1.5 sm:mb-2">
              Быстрый доступ
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              <button
                onClick={() => {
                  localStorage.setItem('activeRole', 'user')
                  navigate('/my-vehicles')
                }}
                className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-blue-700 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Car className="w-4 h-4 flex-shrink-0" />
                <span>Мои авто</span>
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('activeRole', 'sto_owner')
                  navigate('/')
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
              >
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span>Мое СТО</span>
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('activeRole', 'parts_owner')
                  navigate('/parts/dashboard')
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                <Store className="w-4 h-4 flex-shrink-0" />
                <span>Моя разборка</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-col w-56 bg-slate-800 text-white flex-shrink-0">
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-slate-700">
          <Shield size={18} className="text-purple-300 flex-shrink-0" />
          <span className="text-sm font-semibold text-white">Админ панель</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {adminNavigationGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-1">
                {group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 mb-0.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-slate-700 space-y-0.5">
          <button
            onClick={() => { localStorage.setItem('activeRole', 'user'); navigate('/my-vehicles') }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
          >
            <Car className="w-4 h-4 flex-shrink-0" />
            Мои авто
          </button>
          <button
            onClick={() => { localStorage.setItem('activeRole', 'sto_owner'); navigate('/') }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4 flex-shrink-0" />
            Мое СТО
          </button>
          <button
            onClick={() => { localStorage.setItem('activeRole', 'parts_owner'); navigate('/parts/dashboard') }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
          >
            <Store className="w-4 h-4 flex-shrink-0" />
            Разборка
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Выход
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
