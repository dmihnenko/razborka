/**
 * Адаптивные утилиты и компоненты для мобильных устройств
 */

import { ReactNode } from 'react'

/**
 * Контейнер для контента с адаптивными отступами
 */
export function MobileContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Заголовок страницы с адаптивным размером
 */
export function MobilePageTitle({ 
  title, 
  subtitle, 
  action 
}: { 
  title: string
  subtitle?: string
  action?: ReactNode 
}) {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Адаптивная сетка для карточек
 */
export function MobileGrid({ 
  children, 
  cols = { sm: 1, md: 2, lg: 3, xl: 4 },
  gap = 4
}: { 
  children: ReactNode
  cols?: { sm?: number; md?: number; lg?: number; xl?: number }
  gap?: number
}) {
  const gridCols = `grid-cols-${cols.sm || 1} md:grid-cols-${cols.md || 2} lg:grid-cols-${cols.lg || 3} xl:grid-cols-${cols.xl || 4}`
  
  return (
    <div className={`grid ${gridCols} gap-${gap}`}>
      {children}
    </div>
  )
}

/**
 * Кнопка с адаптивным размером и иконкой
 */
export function MobileButton({
  children,
  icon: Icon,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const variants = {
    primary: 'bg-primary hover:bg-primary/90 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs sm:text-sm',
    md: 'px-4 py-2 text-sm sm:text-base',
    lg: 'px-5 py-2.5 sm:px-6 sm:py-3 text-base sm:text-lg',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
      `}
    >
      {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />}
      <span>{children}</span>
    </button>
  )
}

/**
 * Адаптивная карточка статистики
 */
export function MobileStatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = 'blue',
}: {
  title: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo'
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-gray-600 mb-1 truncate">{title}</p>
          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ml-3 ${colors[color]}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Адаптивное модальное окно
 */
export function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl transform transition-all">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 sm:px-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4 sm:px-6 sm:py-5 max-h-[70vh] sm:max-h-[60vh] overflow-y-auto">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="sticky bottom-0 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4 rounded-b-2xl border-t border-gray-200">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Адаптивный поисковый input
 */
export function MobileSearchInput({
  value,
  onChange,
  placeholder = 'Поиск...',
  onClear,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onClear?: () => void
}) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 sm:pl-10 pr-10 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * Адаптивные вкладки (tabs)
 */
export function MobileTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto">
      <nav className="flex -mb-px space-x-4 sm:space-x-8 px-1" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base
              transition-colors duration-200
              ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`
                  ml-2 py-0.5 px-2 rounded-full text-xs
                  ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}

/**
 * Адаптивный badge (бейдж)
 */
export function MobileBadge({
  children,
  variant = 'default',
  size = 'md',
}: {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md' | 'lg'
}) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs sm:text-sm',
    lg: 'px-3 py-1 text-sm sm:text-base',
  }

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  )
}
