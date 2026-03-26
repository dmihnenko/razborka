import { useEffect } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL = 30_000 // 30 seconds

// Module-level state: survives React remounts, prevents race conditions
let initialHash: string | null = null
let isChecking = false
let isReloading = false

async function checkVersion(): Promise<void> {
  if (isChecking || isReloading) return
  isChecking = true

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) return
    const data: unknown = await res.json()
    if (!data || typeof data !== 'object' || !('hash' in data)) return
    const hash = (data as { hash: unknown }).hash
    if (typeof hash !== 'string' || !hash) return

    if (initialHash === null) {
      // First fetch — record baseline hash for this session
      initialHash = hash
      return
    }

    if (hash !== initialHash) {
      isReloading = true
      toast.info('Доступна новая версия — обновление...', {
        duration: 2500,
        icon: '🔄',
      })
      setTimeout(() => window.location.reload(), 2500)
    }
  } catch {
    // Ignore network errors silently
  } finally {
    isChecking = false
  }
}

export default function VersionChecker() {
  useEffect(() => {
    if (!import.meta.env.PROD) return

    checkVersion()
    const interval = setInterval(checkVersion, POLL_INTERVAL)
    window.addEventListener('focus', checkVersion)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkVersion)
    }
  }, [])

  return null
}
