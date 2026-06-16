import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Store, Car, ChevronDown, Check } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'

type ContextId = 'admin' | 'parts' | 'user'

interface Ctx {
  id: ContextId
  label: string
  icon: any
  path: string
}

const CONTEXTS: Ctx[] = [
  { id: 'admin', label: 'Админ',    icon: Shield, path: '/admin' },
  { id: 'parts', label: 'Разборка', icon: Store,  path: '/parts/dashboard' },
  { id: 'user',  label: 'Мои авто', icon: Car,    path: '/my-vehicles' },
]

interface Props {
  current: ContextId
  excludeIds?: ContextId[]
  /** 'bar' — сегмент + отдельная кнопка «Админ» (шапки). 'sidebar' — компактно для свёрнутого сайдбара. */
  variant?: 'bar' | 'sidebar'
}

/**
 * Переключатель раздела: сегмент-свитчер «Разборка ↔ Мои авто»
 * и отдельная кнопка «Админ» (только для админа).
 */
export default function ContextSwitcher({ current, excludeIds = [], variant = 'bar' }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const roleNames: string[] = profile?.roles?.map((r: any) => r.name) || []
  const isAdmin = roleNames.includes('admin')
  const isParts = roleNames.includes('parts_owner') || roleNames.includes('parts_worker')
  const has = (id: ContextId) => {
    if (id === 'admin') return isAdmin
    if (id === 'parts') return isAdmin || isParts
    return isAdmin || roleNames.includes('user')
  }

  // activeRole для целевого контекста — по фактическим ролям пользователя
  const roleFor = (id: ContextId): string => {
    if (id === 'parts') return roleNames.includes('parts_worker') && !roleNames.includes('parts_owner') ? 'parts_worker' : 'parts_owner'
    if (id === 'admin') return 'admin'
    return 'user'
  }

  const switchTo = (c: Ctx) => {
    setOpen(false)
    if (c.id === current) return
    if (c.id === 'admin') localStorage.removeItem('activeRole')
    else localStorage.setItem('activeRole', roleFor(c.id))
    // Сбрасываем кэш данных предыдущего раздела
    localStorage.removeItem('tsp_profile_cache')
    queryClient.clear()
    navigate(c.path)
  }

  const toggleCtxs = CONTEXTS.filter(c => c.id !== 'admin' && has(c.id) && !excludeIds.includes(c.id))
  const adminCtx = CONTEXTS.find(c => c.id === 'admin')!
  const showAdminBtn = variant === 'bar' && has('admin') && !excludeIds.includes('admin')
  const cur = CONTEXTS.find(c => c.id === current)!

  // Сегмент-переключатель Разборка ↔ Мои авто
  const Segmented = toggleCtxs.length > 0 && (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-xl min-w-0"
      style={{ background: 'var(--cab-surface-2)', border: '1px solid var(--cab-border)' }}
    >
      {toggleCtxs.map(c => {
        const active = c.id === current
        return (
          <button
            key={c.id}
            onClick={() => switchTo(c)}
            title={c.label}
            className={`flex items-center justify-center gap-1.5 h-8 rounded-[9px] text-sm font-semibold transition-all active:scale-[0.97] whitespace-nowrap ${variant === 'sidebar' ? 'px-2 lg:px-2.5' : 'px-2.5'}`}
            style={active
              ? { background: 'var(--cab-surface)', color: 'var(--cab-ink)', boxShadow: '0 1px 2px rgba(16,24,40,.08)' }
              : { color: 'var(--cab-ink-3)' }}
          >
            <c.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
            <span className={variant === 'sidebar' ? 'hidden lg:inline' : ''}>{c.label}</span>
          </button>
        )
      })}
    </div>
  )

  // ── SIDEBAR: на lg — сегмент; на md (свёрнуто) — иконка с дропдауном (влезает в w-16) ──
  if (variant === 'sidebar') {
    return (
      <div className="relative w-full min-w-0" ref={ref}>
        <div className="hidden lg:block">{Segmented}</div>
        <div className="lg:hidden">
          <button
            onClick={() => toggleCtxs.length > 1 && setOpen(o => !o)}
            className="flex items-center justify-center gap-1 w-full h-9 rounded-xl transition-colors"
            style={{ background: 'var(--cab-surface-2)', border: '1px solid var(--cab-border)' }}
            title={cur.label}
          >
            <cur.icon className="w-[18px] h-[18px]" strokeWidth={1.6} style={{ color: 'var(--cab-ink)' }} />
            {toggleCtxs.length > 1 && (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--cab-ink-3)' }} />
            )}
          </button>
          {open && (
            <div
              className="absolute left-0 top-full mt-1 w-44 rounded-2xl shadow-xl p-1.5 z-50"
              style={{ background: 'var(--cab-surface)', border: '1px solid var(--cab-border)' }}
            >
              {toggleCtxs.map(c => (
                <button
                  key={c.id}
                  onClick={() => switchTo(c)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-black/[0.03]"
                >
                  <c.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} style={{ color: 'var(--cab-ink-2)' }} />
                  <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--cab-ink)' }}>{c.label}</span>
                  {c.id === current && <Check className="w-4 h-4" style={{ color: 'var(--cab-signal)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── BAR: сегмент + отдельная кнопка «Админ» ──
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {Segmented}
      {showAdminBtn && (
        <button
          onClick={() => switchTo(adminCtx)}
          title="Админ-панель"
          className="flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] flex-shrink-0"
          style={current === 'admin'
            ? { background: 'var(--cab-ink)', color: '#fff' }
            : { background: 'var(--cab-surface-2)', color: 'var(--cab-ink-2)', border: '1px solid var(--cab-border)' }}
        >
          <Shield className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
          <span className={current === 'admin' ? '' : 'hidden sm:inline'}>Админ</span>
        </button>
      )}
    </div>
  )
}
