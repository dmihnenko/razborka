import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Shield, 
  Users, 
  Settings, 
  BarChart3, 
  Database,
  ArrowLeft,
  LogOut,
  Building2,
  Store,
  CreditCard,
  MessageSquare,
  Car
} from 'lucide-react'
import { useIsAdmin } from '../hooks/useUserProfile'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'

const adminNavigation = [
  { name: 'Обзор', href: '/admin', icon: Shield },
  { name: 'Пользователи', href: '/admin/users', icon: Users },
  { name: 'Роли', href: '/admin/roles', icon: Shield },
  { name: 'СТО', href: '/admin/sto', icon: Building2 },
  { name: 'Разборки', href: '/admin/parts-companies', icon: Store },
  { name: 'Подписки', href: '/admin/subscriptions', icon: CreditCard },
  { name: 'Поддержка', href: '/admin/support', icon: MessageSquare },
  { name: 'Настройки', href: '/admin/settings', icon: Settings },
  { name: 'Аналитика', href: '/admin/analytics', icon: BarChart3 },
  { name: 'База данных', href: '/admin/database', icon: Database },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Ошибка при выходе')
    }
  }

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
    <div className="flex h-screen bg-gray-100">
      {/* Admin Sidebar */}
      <div className="w-64 bg-purple-900 text-white shadow-md">
        <div className="p-4 border-b border-purple-800">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield size={24} />
            Админ панель
          </h2>
        </div>
        <nav className="mt-4">
          {adminNavigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-700 text-white'
                    : 'text-purple-100 hover:bg-purple-800'
                }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="absolute bottom-0 w-64 border-t border-purple-800">
          <button
            onClick={() => {
              localStorage.setItem('activeRole', 'user')
              navigate('/my-vehicles')
            }}
            className="flex items-center w-full px-6 py-3 text-sm font-medium text-purple-100 hover:bg-purple-800 transition-colors"
          >
            <Car className="w-5 h-5 mr-3" />
            Мои авто
          </button>
          <button
            onClick={() => {
              localStorage.setItem('activeRole', 'sto_owner')
              navigate('/')
            }}
            className="flex items-center w-full px-6 py-3 text-sm font-medium text-purple-100 hover:bg-purple-800 transition-colors"
          >
            <Building2 className="w-5 h-5 mr-3" />
            Мое СТО
          </button>
          <button
            onClick={() => {
              localStorage.setItem('activeRole', 'parts_owner')
              navigate('/parts-dashboard')
            }}
            className="flex items-center w-full px-6 py-3 text-sm font-medium text-purple-100 hover:bg-purple-800 transition-colors"
          >
            <Store className="w-5 h-5 mr-3" />
            Моя разборка
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-6 py-3 text-sm font-medium text-purple-100 hover:bg-purple-800 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Выход
          </button>
        </div>
      </div>

      {/* Admin Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
