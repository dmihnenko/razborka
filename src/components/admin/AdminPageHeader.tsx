import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface AdminPageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  /** Если задан — слева показывается стрелка «назад» на этот путь */
  backPath?: string
  actions?: React.ReactNode
  /** Доп. строка под основным рядом (например, табы/фильтры) */
  footer?: React.ReactNode
}

/**
 * Шапка раздела админки в стиле СТО/Разборки (как PartsPageHeader):
 * белая, sticky, back / заголовок / подзаголовок / действия / footer.
 */
export default function AdminPageHeader({ title, subtitle, backPath, actions, footer }: AdminPageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-4">
      <div className="flex items-center justify-between gap-3 min-h-14 py-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {backPath && (
            <button
              onClick={() => navigate(backPath)}
              className="p-2 -ml-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 truncate hidden sm:block">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {footer}
    </div>
  )
}
