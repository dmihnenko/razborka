import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL = 30_000 // 30 seconds

async function fetchHash(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.hash ?? null
  } catch {
    return null
  }
}

export default function VersionChecker() {
  const initialHash = useRef<string | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    if (!import.meta.env.PROD) return

    const check = async () => {
      if (reloading.current) return
      const hash = await fetchHash()
      if (!hash) return

      if (initialHash.current === null) {
        initialHash.current = hash
        return
      }

      if (hash !== initialHash.current) {
        reloading.current = true
        toast.info('Доступна новая версия — обновление...', {
          duration: 2500,
          icon: '🔄',
        })
        setTimeout(() => window.location.reload(), 2500)
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL)
    window.addEventListener('focus', check)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', check)
    }
  }, [])

  return null
}
