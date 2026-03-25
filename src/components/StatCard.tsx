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

const variantBorder: Record<string, string> = {
  blue:   'border-l-blue-500',
  green:  'border-l-green-500',
  yellow: 'border-l-yellow-400',
  purple: 'border-l-purple-500',
  red:    'border-l-red-500',
  indigo: 'border-l-indigo-500',
  pink:   'border-l-pink-500',
  gray:   'border-l-gray-400',
}

/**
 * Универсальная карточка для отображения статистики
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

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 border-l-4 ${variantBorder[variant]} p-5 transition-all shadow-sm ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-px' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          )}
          <p className="text-3xl font-bold text-gray-900 leading-none mt-2">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
          )}
        </div>
        <div className={`${styles.bg} p-2.5 rounded-lg flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${styles.text}`} />
        </div>
      </div>
    </div>
  )
}
