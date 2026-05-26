import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Проверяем текущую сессию
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return
      if (error || !session) {
        // Сессия невалидна — очищаем localStorage
        localStorage.removeItem('tsp_profile_cache')
        localStorage.removeItem('activeRole')
        setUser(null)
      } else {
        setUser(session.user ?? null)
      }
      setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // Слушаем изменения auth состояния
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_OUT' || event === 'SIGNED_OUT') {
        localStorage.removeItem('tsp_profile_cache')
        localStorage.removeItem('activeRole')
        setUser(null)
      } else {
        setUser(session?.user ?? null)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
