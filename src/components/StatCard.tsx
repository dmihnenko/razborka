import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  /** Заголовок карточки */
  title: string
  /** Основное значение */
  value: string | number
  /** Иконка (компонент из lucide-react) */
  icon: LucideIcon
  /** Цветовая схема */
  variant?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'indigo' | 'pink' | 'gray'
  /** Дополнительное описание (необязательно) */
  description?: string
  /** Вспомогательный текст внизу (необязательно) */
  subtitle?: string
  /** Обработчик клика (необязательно) */
  onClick?: () => void
}

const variantStyles = {
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    hover: 'hover:bg-blue-50'
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-600',
    hover: 'hover:bg-green-50'
  },
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-600',
    hover: 'hover:bg-yellow-50'
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    hover: 'hover:bg-purple-50'
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-600',
    hover: 'hover:bg-red-50'
  },
  indigo: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
    hover: 'hover:bg-indigo-50'
  },
  pink: {
    bg: 'bg-pink-100',
    text: 'text-pink-600',
    hover: 'hover:bg-pink-50'
  },
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    hover: 'hover:bg-gray-50'
  }
}

/**
 * Универсальная карточка для отображения статистики
 * 
 * @example
 * ```tsx
 * <StatCard
 *   title="Всего пользователей"
 *   value={150}
 *   icon={Users}
 *   variant="blue"
 *   subtitle="+12 за последний месяц"
 * />
 * ```
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'blue',
  description,
  subtitle,
  onClick
}: StatCardProps) {
  const styles = variantStyles[variant]
  
  const cardClasses = `
    bg-white rounded-lg shadow p-6 transition-all
    ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}
  `.trim()

  return (
    <div className={cardClasses} onClick={onClick}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          {description && (
            <p className="text-xs text-gray-500 mb-2">{description}</p>
          )}
          <p className="text-2xl md:text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
          )}
        </div>
        <div className={`${styles.bg} p-3 rounded-full ${onClick ? styles.hover : ''} transition-colors`}>
          <Icon className={`w-6 h-6 ${styles.text}`} />
        </div>
      </div>
    </div>
  )
}
