import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

// Кэш auth-состояния на уровне модуля. Нужен чтобы повторные монтирования
// (переход Разборка / Мои авто — разные layout'ы) НЕ показывали скелетон
// и НЕ дёргали сеть каждый раз: второй и последующие useAuth стартуют сразу
// с известным пользователем и loading=false.
let cachedUser: User | null = null
let authResolved = false

/** Только для тестов: сбросить модульный кэш auth между прогонами. */
export function __resetAuthCacheForTests() {
  cachedUser = null
  authResolved = false
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser)
  const [loading, setLoading] = useState(!authResolved)

  useEffect(() => {
    let mounted = true

    // Первичная проверка только один раз за сессию. getSession() читает токен из
    // localStorage (без сетевого round-trip), поэтому быстро.
    if (!authResolved) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return
        cachedUser = session?.user ?? null
        authResolved = true
        if (!session) {
          localStorage.removeItem('tsp_profile_cache')
          localStorage.removeItem('activeRole')
        }
        setUser(cachedUser)
        setLoading(false)
      }).catch(() => {
        if (mounted) { authResolved = true; setLoading(false) }
      })
    }

    // Слушаем изменения auth состояния — держим модульный кэш свежим
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      cachedUser = session?.user ?? null
      authResolved = true
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('tsp_profile_cache')
        localStorage.removeItem('activeRole')
        // Чистим SW-кеши с приватными данными тенанта — чтобы на общем устройстве
        // следующий пользователь не достал их из Cache Storage.
        if (typeof caches !== 'undefined') {
          caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('supabase-')).map(k => caches.delete(k))))
            .catch(() => {})
        }
      }
      setUser(cachedUser)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
