import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  markRead,
  markAllRead,
  type Notification,
} from '@/services/notificationsService'

export interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  markRead: (id: string) => void
  markAllRead: () => void
}

export function useNotifications(userId: string | undefined): UseNotificationsResult {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllRead(userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead: (id: string) => markReadMutation.mutate(id),
    markAllRead: () => markAllReadMutation.mutate(),
  }
}
