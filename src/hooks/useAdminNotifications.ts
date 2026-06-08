import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useUserProfile } from './useUserProfile'

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

export function useAdminNotifications() {
  const { data: profile } = useUserProfile()

  useEffect(() => {
    // Only admins should listen for notifications
    const isAdmin = profile?.roles?.some((r: any) => r.name === 'admin')
    if (!isAdmin) return

    // Subscribe to admin notifications channel
    const channel = supabase.channel('admin-notifications')

    channel.on('broadcast', { event: 'user_registered' }, (payload) => {
      const data = payload.payload as UserRegisteredPayload

      toast.success(`Новый пользователь зарегистрирован`, {
        description: `${data.user.username} (${data.user.email})`,
        action: {
          label: 'Открыть',
          onClick: () => {
            window.location.href = '/admin/users'
          }
        },
        duration: 10000
      })
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.roles])
}
