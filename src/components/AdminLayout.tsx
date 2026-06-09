import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Shield, Users, Settings, BarChart2, LogOut, ClipboardList,
  Building2, Store, CreditCard, MessageCircle, LayoutGrid, Database,
} from 'lucide-react'
import { useIsAdmin, useUserProfile } from '../hooks/useUserProfile'
import { useAuth } from '../hooks/useAuth'
import { useAdminNotifications } from '../hooks/useAdminNotifications'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { LayoutSkeleton } from './LayoutSkeleton'
import ContextSwitcher from './ContextSwitcher'

const TABS = [
  { name: 'Обзор',        href: '/admin',                 icon: LayoutGrid },
  { name: 'Пользователи', href: '/admin/users',           icon: Users },
  { name: 'Роли',         href: '/admin/roles',           icon: Shield },
  { name: 'СТО',          href: '/admin/sto',             icon: Building2 },
  { name: 'Разборки',     href: '/admin/parts-companies', icon: Store },
  { name: 'Подписки',     href: '/admin/subscriptions',   icon: CreditCard },
  { name: 'Поддержка',    href: '/admin/support',         icon: MessageCircle },
  { name: 'Заявки',       href: '/admin/access-requests', icon: ClipboardList },
  { name: 'Аналитика',    href: '/admin/analytics',       icon: BarChart2 },
  { name: 'База данных',  href: '/admin/database',        icon: Database },
  { name: 'Настройки',    href: '/admin/settings',        icon: Settings },
]

export default function AdminLayout() {
  useAdminNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const { user, loading: authLoading } = useAuth()
  const { data: profile, isLoading } = useUserProfile()

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) toast.error('Ошибка при выходе')
    else navigate('/login')
  }

  if (authLoading || isLoading || (!!user && !profile)) return <LayoutSkeleton />

  if (!isAdmin) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-red-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Доступ запрещён</h2>
          <p className="text-sm text-gray-500">У вас нет прав администратора</p>
          <button onClick={() => navigate('/')} className="mt-5 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            На главную
          </button>
        </div>
      </div>
    )
  }

  const isTabActive = (href: string) =>
    href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(href)

  return (
    <div className="min-h-dvh bg-[#F4F6FA] flex flex-col">
      {/* ── Верхний бар: переключатель контекста + действия ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200/80">
        <div className="max-w-7xl mx-auto px-2 sm:px-5">
          <div className="h-14 flex items-center justify-between gap-3">
            <ContextSwitcher current="admin" />

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {(profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'A').toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                  {profile?.full_name?.split(' ')[0] || 'Админ'}
                </span>
              </Link>
              <button onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
                title="Выйти">
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          </div>

          {/* ── Табы разделов ── */}
          <nav className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {TABS.map(tab => {
              const active = isTabActive(tab.href)
              const Icon = tab.icon
              return (
                <Link
                  key={tab.href}
                  to={tab.href}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  {tab.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* ── Контент ── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-5 sm:py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
