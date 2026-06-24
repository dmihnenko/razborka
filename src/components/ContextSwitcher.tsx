import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Shield, Store, Car, ChevronDown, Check } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'

type ContextId = 'admin' | 'parts' | 'user'

interface Ctx {
  id: ContextId
  label: string
  desc: string
  icon: any
  path: string
}

const CONTEXTS: Ctx[] = [
  { id: 'parts', label: 'Разборка',  desc: 'Кабинет авторазборки',   icon: Store,  path: '/parts/dashboard' },
  { id: 'user',  label: 'Мои авто',  desc: 'Личные автомобили',      icon: Car,    path: '/my-vehicles' },
  { id: 'admin', label: 'Админ',     desc: 'Панель администратора',  icon: Shield, path: '/admin' },
]

interface Props {
  current: ContextId
  excludeIds?: ContextId[]
  /** 'bar' — кнопка с ярлыком (шапки). 'sidebar' — компактная (иконка + chevron) для свёрнутого сайдбара.
   *  'segment' — сегментированный переключатель из двух кнопок [Админ | Разборка/Мои авто] (для админа).
   *  'mobile' — компактный для мобилы: одна кнопка операционного раздела (Разборка/Админ — активный,
   *             тап переключает на другой) + «Мои авто» рядом; неактивный из Разборка/Админ скрыт. */
  variant?: 'bar' | 'sidebar' | 'segment' | 'mobile'
  /** Для variant='segment': когда показывать подписи. 'lg' — только на широком (узкий md-сайдбар → иконки). */
  segLabels?: 'always' | 'lg'
}

/**
 * Динамическая смена роли: одна кнопка → меню со ВСЕМИ доступными пользователю
 * разделами (определяются по фактическим ролям). Текущий отмечен галочкой.
 */
export default function ContextSwitcher({ current, excludeIds = [], variant = 'bar', segLabels = 'always' }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const roleNames: string[] = profile?.roles?.map((r: any) => r.name) || []
  const isAdmin = roleNames.includes('admin')
  const isParts = roleNames.includes('parts_owner') || roleNames.includes('parts_worker')
  const has = (id: ContextId) => {
    if (id === 'admin') return isAdmin
    if (id === 'parts') return isAdmin || isParts
    return isAdmin || roleNames.includes('user')
  }

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
    localStorage.removeItem('tsp_profile_cache')
    queryClient.clear()
    navigate(c.path)
  }

  // Доступные разделы — динамически по ролям пользователя
  const available = CONTEXTS.filter(c => has(c.id) && !excludeIds.includes(c.id))
  const cur = CONTEXTS.find(c => c.id === current) ?? available[0]
  if (!cur) return null

  const canSwitch = available.length > 1
  const compact = variant === 'sidebar'
  const spring = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }
  const CurIcon = cur.icon

  // ── Сегмент из двух кнопок [Админ | Разборка/Мои авто]; активная подсвечена ──
  if (variant === 'segment') {
    const adminC = CONTEXTS.find(c => c.id === 'admin')!
    const opPrefersParts = current === 'parts' || roleNames.includes('parts_owner') || roleNames.includes('parts_worker') || !!(profile as any)?.parts_company_id
    const opC = (opPrefersParts ? CONTEXTS.find(c => c.id === 'parts') : CONTEXTS.find(c => c.id === 'user'))!
    const segs = [adminC, opC].filter(c => has(c.id) && !excludeIds.includes(c.id))
    if (segs.length < 2) return null
    return (
      <div className="w-full inline-flex gap-0.5 p-0.5 rounded-xl"
        style={{ background: 'var(--cab-surface-2)', border: '1px solid var(--cab-border)' }}>
        {segs.map(c => {
          const Icon = c.icon
          const active = c.id === current
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => switchTo(c)}
              title={c.label}
              aria-pressed={active}
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[13px] font-semibold transition-colors active:scale-[0.98]"
              style={active
                ? { background: 'var(--cab-surface)', color: 'var(--cab-ink)', boxShadow: '0 1px 2px rgba(16,24,40,.14)' }
                : { color: 'var(--cab-ink-3)' }}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
              <span className={`truncate ${segLabels === 'lg' ? 'hidden lg:inline' : ''}`}>{c.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Мобильный: ДВЕ отдельные кнопки —
  //    [Разборка] постоянная  +  [свитчер Админ ⇄ Мои авто]. ──
  if (variant === 'mobile') {
    const adminC = CONTEXTS.find(c => c.id === 'admin')!
    const partsC = CONTEXTS.find(c => c.id === 'parts')!
    const userC  = CONTEXTS.find(c => c.id === 'user')!
    const hasAdmin = has('admin') && !excludeIds.includes('admin')
    const hasParts = has('parts') && !excludeIds.includes('parts')
    const hasUser  = has('user')  && !excludeIds.includes('user')

    // Свитчер показывает активный из {Админ, Мои авто}; в Разборке — по умолчанию Админ.
    const swShown: Ctx | null =
      current === 'admin' ? adminC
      : current === 'user' ? userC
      : (hasAdmin ? adminC : hasUser ? userC : null)
    // Тап по свитчеру: из Админа → Мои авто, из Мои авто → Админ, из Разборки → в показанный.
    let swTarget: Ctx | null = swShown
    if (current === 'admin') swTarget = hasUser ? userC : swShown
    else if (current === 'user') swTarget = hasAdmin ? adminC : swShown
    const swActive = current === 'admin' || current === 'user'

    // Самостоятельные кнопки. Активная — с акцентом, неактивная — обычная (с бордером).
    const seg = (c: Ctx, active: boolean, onClick: () => void) => {
      const Icon = c.icon
      const isAdminBtn = c.id === 'admin'
      return (
        <button
          key={c.id}
          type="button"
          onClick={onClick}
          title={c.label}
          aria-pressed={active}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-[13px] font-semibold transition-colors active:scale-[0.98] flex-shrink-0"
          style={active
            ? { background: isAdminBtn ? 'var(--cab-ink)' : 'var(--cab-signal-weak)', color: isAdminBtn ? '#fff' : 'var(--cab-signal)', borderColor: 'transparent' }
            : { background: 'var(--cab-surface)', color: 'var(--cab-ink)', borderColor: 'var(--cab-border)' }}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
          <span className="truncate">{c.label}</span>
        </button>
      )
    }

    if (!hasParts && !swShown) return null
    return (
      <div className="inline-flex items-center gap-2">
        {hasParts && seg(partsC, current === 'parts', () => switchTo(partsC))}
        {swShown && swTarget && seg(swShown, swActive, () => switchTo(swTarget))}
      </div>
    )
  }

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => canSwitch && setOpen(o => !o)}
        disabled={!canSwitch}
        title={canSwitch ? 'Сменить раздел' : cur.label}
        aria-haspopup={canSwitch ? 'menu' : undefined}
        aria-expanded={canSwitch ? open : undefined}
        className={`flex items-center gap-2 rounded-xl border font-semibold transition-colors active:scale-[0.98] ${compact ? 'w-full justify-center lg:justify-start px-2 lg:px-2.5 h-9' : 'h-9 px-2.5'} ${canSwitch ? 'hover:bg-[var(--cab-surface-2)]' : 'cursor-default'}`}
        style={{ background: 'var(--cab-surface)', borderColor: 'var(--cab-border)', color: 'var(--cab-ink)' }}
      >
        <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: current === 'admin' ? 'var(--cab-ink)' : 'var(--cab-signal-weak)', color: current === 'admin' ? '#fff' : 'var(--cab-signal)' }}>
          <CurIcon className="w-3.5 h-3.5" strokeWidth={1.8} />
        </span>
        <span className={`text-sm truncate ${compact ? 'hidden lg:inline' : ''}`}>{cur.label}</span>
        {canSwitch && (
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${compact ? 'hidden lg:inline' : ''}`}
            style={{ color: 'var(--cab-ink-3)' }} strokeWidth={2} />
        )}
      </button>

      <AnimatePresence>
        {open && canSwitch && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={spring}
            className="absolute left-0 top-full mt-1.5 w-60 max-w-[78vw] rounded-2xl p-1.5 z-50 origin-top-left"
            style={{ background: 'var(--cab-surface)', border: '1px solid var(--cab-border)', boxShadow: '0 12px 32px -10px rgba(16,24,40,.22), 0 2px 8px -2px rgba(16,24,40,.08)' }}
          >
            <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--cab-ink-3)' }}>Сменить раздел</p>
            {available.map(c => {
              const Icon = c.icon
              const active = c.id === current
              return (
                <button
                  key={c.id}
                  role="menuitem"
                  onClick={() => switchTo(c)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-[var(--cab-surface-2)]"
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: c.id === 'admin' ? 'var(--cab-ink)' : 'var(--cab-signal-weak)', color: c.id === 'admin' ? '#fff' : 'var(--cab-signal)' }}>
                    <Icon className="w-4 h-4" strokeWidth={1.7} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate" style={{ color: 'var(--cab-ink)' }}>{c.label}</span>
                    <span className="block text-[11px] truncate" style={{ color: 'var(--cab-ink-3)' }}>{c.desc}</span>
                  </span>
                  {active && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--cab-signal)' }} strokeWidth={2.2} />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
