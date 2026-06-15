import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

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

  // Маппинг путей на читаемые названия
  const pathLabels: Record<string, string> = {
    '': 'Главная',
    'dashboard': 'Дашборд',
    'parts': 'Запчасти',
    'users': 'Пользователи',
    'admin': 'Администрирование',
    'roles': 'Роли',
    'parts-companies': 'Разборки',
    'subscriptions': 'Подписки',
    'employees': 'Сотрудники',
    'support': 'Поддержка',
    'my-vehicles': 'Мои авто',
    'archive': 'Архив',
    'analytics': 'Аналитика',
    'vehicles': 'Автомобили',
    'customers': 'Клиенты',
    'profile': 'Профиль',
    'settings': 'Настройки',
    'inventory': 'Склад запчастей',
    'no-price': 'Без цены',
    'orders': 'Заказы',
    'create': 'Создание',
    'categories': 'Категории',
    'warehouse': 'Склад',
    'trash': 'Корзина',
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

        breadcrumbs.push({
          label,
          path: currentPath,
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
    <nav aria-label="breadcrumb" className="mb-4 flex items-center gap-1 text-xs leading-none text-gray-400 flex-wrap">
      <Link
        to="/"
        title="Главная"
        className="flex items-center flex-shrink-0 text-gray-400 hover:text-primary transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1
        return (
          <span key={crumb.path} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
            {isLast ? (
              <span className="flex items-center gap-1 font-medium text-gray-700 whitespace-nowrap">
                {crumb.label}
                {crumb.count !== undefined && (
                  <span className="text-gray-400">({crumb.count})</span>
                )}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="flex items-center whitespace-nowrap text-gray-400 hover:text-primary transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
