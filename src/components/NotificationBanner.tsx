import { X, CheckCheck, Info, CheckCircle, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'

interface Props {
  userId: string | undefined
}

const typeConfig = {
  info: {
    icon: Info,
    bg: 'bg-blue-50 border-blue-200',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-900',
    bodyClass: 'text-blue-700',
    btnClass: 'text-blue-600 hover:text-blue-800 hover:bg-blue-100',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-emerald-50 border-emerald-200',
    iconClass: 'text-emerald-500',
    titleClass: 'text-emerald-900',
    bodyClass: 'text-emerald-700',
    btnClass: 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 border-amber-200',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-900',
    bodyClass: 'text-amber-700',
    btnClass: 'text-amber-600 hover:text-amber-800 hover:bg-amber-100',
  },
} as const

export default function NotificationBanner({ userId }: Props) {
  const { notifications, isLoading, markRead, markAllRead } = useNotifications(userId)

  const unread = notifications.filter((n) => !n.read)

  if (isLoading || unread.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {unread.map((n) => {
        const cfg = typeConfig[n.type] ?? typeConfig.info
        const Icon = cfg.icon
        return (
          <div
            key={n.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.bg} shadow-card`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconClass}`} strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-tight ${cfg.titleClass}`}>{n.title}</p>
              {n.body && (
                <p className={`text-sm mt-0.5 leading-snug ${cfg.bodyClass}`}>{n.body}</p>
              )}
              {n.link && (
                <Link
                  to={n.link}
                  onClick={() => markRead(n.id)}
                  className={`inline-block text-xs font-medium mt-1 underline underline-offset-2 ${cfg.btnClass}`}
                >
                  Перейти
                </Link>
              )}
            </div>
            <button
              onClick={() => markRead(n.id)}
              title="Отметить прочитанным"
              className={`flex-shrink-0 p-1 rounded-lg transition-colors ${cfg.btnClass}`}
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )
      })}

      {unread.length > 1 && (
        <button
          onClick={() => markAllRead()}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Отметить все прочитанными
        </button>
      )}
    </div>
  )
}
