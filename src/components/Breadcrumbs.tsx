import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  path: string
}

/**
 * Компонент хлебных крошек для навигации
 */
export default function Breadcrumbs() {
  const location = useLocation()
  
  // Маппинг путей на читаемые названия
  const pathLabels: Record<string, string> = {
    '': 'Главная',
    'dashboard': 'Дашборд',
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
    'monthly-statistics': 'Месячная статистика',
    'monthly-details': 'Детали месяца',
    'activity': 'История действий',
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
        breadcrumbs.push({
          label: pathLabels[segment] || segment.replace(/-/g, ' '),
          path: currentPath
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
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
      <Link
        to="/"
        className="flex items-center hover:text-blue-600 transition-colors"
        title="Главная"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1
        
        return (
          <div key={crumb.path} className="flex items-center">
            <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
            {isLast ? (
              <span className="text-gray-900 font-medium capitalize">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-blue-600 transition-colors capitalize"
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
