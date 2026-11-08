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

  // Только на широких экранах и внизу по центру: в углах — нижняя панель телефона и кнопки поиска/уведомлений
  return (
    <div className="hidden lg:block fixed bottom-1 left-1/2 -translate-x-1/2 z-10 text-[10px] leading-none text-gray-400 select-none pointer-events-none">
      v{version}
    </div>
  )
}
