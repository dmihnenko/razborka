import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'

interface BreadcrumbItem {
  label: string
  path: string
  count?: number
}

/**
 * Компонент хлебных крошек для навигации
 */
export default function Breadcrumbs() {
  const location = useLocation()
  const { data: profile } = useUserProfile()
  
  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  
  // Определяем, находимся ли мы на странице заявок
  const isAppointmentsPage = location.pathname.startsWith('/appointments')
  const showArchived = location.pathname.includes('/archive')
  
  // Получаем количество заявок для breadcrumbs
  const { data: appointmentsCount } = useQuery({
    queryKey: ['appointments-count', profile?.id, showArchived],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })

      // Фильтруем по СТО пользователя
      if (profile?.sto_company_id) {
        query = query.eq('sto_company_id', profile.sto_company_id)
      }

      // Фильтруем по архиву
      if (showArchived) {
        query = query.eq('status', 'archived')
      } else {
        query = query.neq('status', 'archived')
      }

      // Если пользователь - работник (не владелец), показываем только его заявки
      if (!isStoOwner && profile?.id) {
        query = query.eq('assigned_to', profile.id)
      }

      const { count, error } = await query
      
      if (error) throw error
      return count || 0
    },
    enabled: !!profile?.id && isAppointmentsPage,
  })
  
  // Маппинг путей на читаемые названия
  const pathLabels: Record<string, string> = {
    '': 'Главная',
    'dashboard': 'Дашборд',
    'sto': 'СТО',
    'customers': 'Клиенты',
    'vehicles': 'Автомобили',
    'appointments': 'Записи',
    'work-orders': 'Заказ-наряды',
    'services': 'Услуги',
    'parts': 'Запчасти',
    'invoices': 'Счета',
    'users': 'Пользователи',
    'admin': 'Администрирование',
    'roles': 'Роли',
    'sto-companies': 'СТО компании',
    'parts-companies': 'Разборки',
    'subscriptions': 'Подписки',
    'employees': 'Сотрудники',
    'support': 'Поддержка',
    'my-vehicles': 'Мои авто',
    'archive': 'Архив',
    'analytics': 'Аналитика',
    'statistics': 'Статистика',
    'monthly-statistics': 'Месячная статистика',
    'monthly-details': 'Детали месяца',
    'activity': 'История действий',
    'history': 'История',
    'worker-dashboard': 'Рабочий стол',
    'profile': 'Профиль',
    'settings': 'Настройки'
  }

  // Генерация хлебных крошек из текущего пути
  function generateBreadcrumbs(): BreadcrumbItem[] {
    const paths = location.pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []
    
    let currentPath = ''
    paths.forEach((segment) => {
      currentPath += `/${segment}`
      
      // Пропускаем UUID (например, /customers/123e4567-e89b-12d3-a456-426614174000)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
      
      if (!isUuid) {
        const label = pathLabels[segment] || segment.replace(/-/g, ' ')
        const count = segment === 'appointments' ? appointmentsCount : undefined
        
        breadcrumbs.push({
          label,
          path: currentPath,
          count
        })
      }
    })
    
    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()
  
  // Не показываем на главной странице или при логине
  if (breadcrumbs.length === 0 || location.pathname === '/login') {
    return null
  }

  return (
    <nav className="flex items-center flex-wrap gap-0.5 mb-4" style={{ fontSize: '12px', color: '#94A3B8' }}>
      <Link
        to="/"
        className="inline-flex items-center transition-colors hover:text-blue-500"
        title="Главная"
        style={{ color: 'inherit' }}
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1

        return (
          <div key={crumb.path} className="flex items-center">
            <ChevronRight className="w-3.5 h-3.5 mx-0.5 flex-shrink-0" style={{ color: '#CBD5E1' }} />
            {isLast ? (
              <span
                className="font-medium whitespace-nowrap"
                style={{ color: '#374151' }}
              >
                {crumb.label}
                {crumb.count !== undefined && (
                  <span className="ml-1" style={{ color: '#94A3B8' }}>({crumb.count})</span>
                )}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="whitespace-nowrap transition-colors hover:text-blue-500"
                style={{ color: 'inherit' }}
              >
                {crumb.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
