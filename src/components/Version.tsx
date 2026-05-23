import { useEffect, useState } from 'react'

export default function Version() {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setVersion(d?.version || ''))
      .catch(() => {})
  }, [])

  if (!version) return null

  return (
    <div className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom,0px))] right-2 z-50 text-xs text-gray-400 bg-white/50 px-2 py-1 rounded select-none pointer-events-none">
      v{version}
    </div>
  )
}
