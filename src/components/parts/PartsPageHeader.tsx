import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PartsPageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  backPath: string
  actions?: React.ReactNode
  /** Extra content rendered below the main row (e.g. tab bar) */
  footer?: React.ReactNode
  height?: 'sm' | 'md'
  maxWidth?: '3xl' | '4xl' | '7xl'
}

export default function PartsPageHeader({
  title,
  subtitle,
  backPath,
  actions,
  footer,
  height = 'md',
  maxWidth = '7xl',
}: PartsPageHeaderProps) {
  const navigate = useNavigate()
  const hClass = height === 'sm' ? 'h-14' : 'h-16'
  const mwClass = `max-w-${maxWidth}`

  return (
    <div className="bg-white border-b sticky top-0 z-10">
      <div className={`${mwClass} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className={`flex items-center justify-between ${hClass}`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => navigate(backPath)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500 hidden sm:block">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {actions}
            </div>
          )}
        </div>
        {footer}
      </div>
    </div>
  )
}
