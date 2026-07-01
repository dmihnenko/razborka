import { useState } from 'react'
import { UserCheck, LogOut } from 'lucide-react'
import { getImpersonation, stopImpersonation } from '@/services/impersonationService'
import { toast } from 'sonner'

/** Плашка сверху, когда админ вошёл под другим пользователем. */
export default function ImpersonationBanner() {
  const info = getImpersonation()
  const [busy, setBusy] = useState(false)
  if (!info) return null

  const handleExit = async () => {
    setBusy(true)
    try {
      await stopImpersonation()
      window.location.href = '/admin/users'
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка возврата')
      window.location.href = '/login'
    }
  }

  return (
    <div
      className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-sm flex items-center justify-center gap-3 px-4 py-2 shadow-md"
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
    >
      <UserCheck className="w-4 h-4 flex-shrink-0" />
      <span className="font-medium truncate">
        Вы вошли как <b>{info.name}</b>
      </span>
      <button
        onClick={handleExit}
        disabled={busy}
        className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
        {busy ? '...' : 'Вернуться'}
      </button>
    </div>
  )
}
