import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  CheckCheck,
  X,
} from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDateTime } from '@/utils/date'
import type { Notification } from '@/services/notificationsService'

interface Props {
  userId?: string
}

// Иконка и цвет по типу уведомления
const typeConfig: Record<
  string,
  { Icon: React.ElementType; iconClass: string; dotClass: string }
> = {
  info: {
    Icon: Bell,
    iconClass: 'text-blue-500',
    dotClass: 'bg-blue-500',
  },
  success: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  warning: {
    Icon: AlertTriangle,
    iconClass: 'text-amber-500',
    dotClass: 'bg-amber-500',
  },
  danger: {
    Icon: AlertCircle,
    iconClass: 'text-red-500',
    dotClass: 'bg-red-500',
  },
}

function getTypeConfig(type: string) {
  return typeConfig[type] ?? typeConfig.info
}

export default function NotificationsBell({ userId }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications(userId)

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Закрытие по Esc
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  if (!userId) return null

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  function handleNotificationClick(n: Notification) {
    markRead(n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative flex-shrink-0">
      {/* Кнопка-колокол */}
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Уведомления, ${unreadCount} непрочитанных`
            : 'Уведомления'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all active:scale-[0.97]"
      >
        <Bell className="w-4 h-4" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-[3px] flex items-center justify-center rounded-full bg-[#3538CD] text-white font-bold leading-none"
            style={{ fontSize: '10px' }}
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Дропдаун */}
      {open && (
        <>
          {/* Мобильный оверлей */}
          <div
            className="md:hidden fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.30)' }}
            aria-hidden="true"
          />

          {/* Панель */}
          <div
            role="dialog"
            aria-label="Уведомления"
            className={[
              // Мобайл: bottom-sheet
              'fixed md:absolute z-50',
              'bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-0',
              'md:top-10',
              // Размеры
              'w-full md:w-80',
              // Форма
              'rounded-t-2xl md:rounded-2xl',
              'bg-white shadow-xl border border-gray-200',
              'flex flex-col',
              // Ограничение высоты
              'max-h-[80dvh] md:max-h-[460px]',
            ].join(' ')}
          >
            {/* Мобильная ручка */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Шапка */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Уведомления</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    className="flex items-center gap-1 text-xs font-medium text-[#3538CD] hover:text-blue-800 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 active:scale-[0.97]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Прочитать все
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Список */}
            <div className="flex-1 overflow-y-auto" role="list">
              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                  Загрузка…
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                  <Bell className="w-8 h-8 opacity-30" strokeWidth={1.2} />
                  <span className="text-sm">Нет уведомлений</span>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {notifications.map((n) => {
                    const { Icon, iconClass, dotClass } = getTypeConfig(n.type)
                    const isUnread = !n.read
                    return (
                      <li
                        key={n.id}
                        role="listitem"
                        className={[
                          'relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                          isUnread
                            ? 'bg-blue-50/60 hover:bg-blue-50'
                            : 'hover:bg-gray-50',
                        ].join(' ')}
                        onClick={() => handleNotificationClick(n)}
                      >
                        {/* Точка непрочитанного */}
                        {isUnread && (
                          <span
                            aria-label="Непрочитано"
                            className={`absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`}
                          />
                        )}

                        {/* Иконка типа */}
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconClass}`}
                          strokeWidth={1.8}
                        />

                        {/* Контент */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1 leading-none">
                            {formatDateTime(n.created_at)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Нижний отступ для safe-area на мобиле */}
            <div
              className="md:hidden"
              style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
            />
          </div>
        </>
      )}
    </div>
  )
}
