import { Link } from 'react-router-dom'
import { Users, Shield, Settings, BarChart3, Database } from 'lucide-react'
import { useUserProfile } from '../hooks/useUserProfile'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export default function AdminPanel() {
  const { data: profile } = useUserProfile()

  // Загрузка статистики
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // Всего пользователей
      const { count: usersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })

      // Активные роли
      const { count: rolesCount } = await supabase
        .from('roles')
        .select('*', { count: 'exact', head: true })

      return {
        usersCount: usersCount || 0,
        rolesCount: rolesCount || 0
      }
    }
  })

  const adminSections = [
    {
      title: 'Управление пользователями',
      description: 'Просмотр, редактирование и управление пользователями системы',
      icon: Users,
      path: '/users',
      color: 'blue',
    },
    {
      title: 'Управление ролями',
      description: 'Создание и настройка ролей и прав доступа',
      icon: Shield,
      path: '/admin/roles',
      color: 'purple',
    },
    {
      title: 'Системные настройки',
      description: 'Конфигурация системы и параметры приложения',
      icon: Settings,
      path: '/admin/settings',
      color: 'gray',
    },
    {
      title: 'Статистика и отчеты',
      description: 'Просмотр аналитики и генерация отчетов',
      icon: BarChart3,
      path: '/admin/analytics',
      color: 'green',
    },
    {
      title: 'База данных',
      description: 'Управление данными и резервное копирование',
      icon: Database,
      path: '/admin/database',
      color: 'orange',
    },
  ]

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Панель администратора</h1>
        <p className="text-gray-600">
          Добро пожаловать, {profile?.full_name || 'Администратор'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => {
          const Icon = section.icon
          return (
            <Link
              key={section.path}
              to={section.path}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 hover:border-blue-300"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    colorClasses[section.color as keyof typeof colorClasses]
                  }`}
                >
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Быстрая статистика */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Всего пользователей" value={stats?.usersCount.toString() || '0'} color="blue" />
        <StatCard title="Активные роли" value={stats?.rolesCount.toString() || '0'} color="purple" />
        <StatCard title="Сессий сегодня" value="—" color="green" />
        <StatCard title="Системных ошибок" value="—" color="red" />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string
  value: string
  color: string
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  }

  return (
    <div
      className={`p-4 rounded-lg border ${
        colorClasses[color as keyof typeof colorClasses]
      }`}
    >
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
