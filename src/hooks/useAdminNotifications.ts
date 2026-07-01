import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useUserProfile } from './useUserProfile'
import { getSupportChatWithOwner } from '@/services/supportService'

interface UserRegisteredPayload {
  type: string
  timestamp: string
  user: {
    id: string
    username: string
    fullName: string | null
    email: string
  }
}

/**
 * Глобальные уведомления для администраторов — работают на любой странице, пока
 * приложение/PWA открыто (в т.ч. в фоне). Подключается один раз в Layout и
 * AdminLayout. Покрывает:
 *  - регистрацию новых пользователей (broadcast из Edge Function)
 *  - новые обращения/сообщения в поддержку (realtime INSERT)
 *
 * Примечание: системные уведомления через Notification API показываются, только
 * пока вкладка/PWA жива. Доставка при полностью закрытом приложении требует
 * Web Push (service worker push + VAPID) — отдельная инфраструктура.
 */
export function useAdminNotifications() {
  const { data: profile } = useUserProfile()
  const isAdmin = profile?.roles?.some((r) => r.name === 'admin')
  const adminId = profile?.id

  // Запрашиваем разрешение на системные уведомления один раз
  useEffect(() => {
    if (!isAdmin) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isAdmin])

  // Регистрация новых пользователей
  useEffect(() => {
    if (!isAdmin) return

    const channel = supabase.channel('admin-notifications')
    channel.on('broadcast', { event: 'user_registered' }, (payload) => {
      const data = payload.payload as UserRegisteredPayload
      toast.success('Новый пользователь зарегистрирован', {
        description: `${data.user.username} (${data.user.email})`,
        action: { label: 'Открыть', onClick: () => { window.location.href = '/admin/users' } },
        duration: 10000,
      })
    })
    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isAdmin])

  // Новые сообщения в поддержку
  useEffect(() => {
    if (!isAdmin || !adminId) return

    const channel = supabase
      .channel('admin-support-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        async (payload) => {
          const msg = payload.new as { id: string; chat_id: string; sender_id: string; message: string }
          // Не уведомляем о собственных сообщениях админа
          if (msg.sender_id === adminId) return
          // Если админ уже на странице поддержки — там свой обработчик, не дублируем
          if (window.location.pathname.startsWith('/admin/support')) return

          const chat = await getSupportChatWithOwner(msg.chat_id)
          const senderName = chat?.owner?.full_name || chat?.owner?.username || 'Пользователь'
          const subject = chat?.subject || 'Обращение'

          toast.info(`Новое обращение в поддержку`, {
            description: `${subject} — от ${senderName}`,
            action: { label: 'Открыть', onClick: () => { window.location.href = '/admin/support' } },
            duration: 10000,
          })

          if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification('Поддержка: новое обращение', {
              body: `${subject}\nОт: ${senderName}\n${msg.message.substring(0, 100)}`,
              icon: '/pwa-192x192.png',
              tag: msg.chat_id,
            })
            n.onclick = () => {
              window.focus()
              window.location.href = '/admin/support'
              n.close()
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isAdmin, adminId])
}
