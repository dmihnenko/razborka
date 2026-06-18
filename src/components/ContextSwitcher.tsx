import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Shield, Store, Car } from 'lucide-react'
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
  /** 'bar' — переключатель + кнопка «Админ» (шапки). 'sidebar' — компактно для свёрнутого сайдбара. */
  variant?: 'bar' | 'sidebar'
}

/**
 * Переключатель раздела. Показывает кнопку ПРОТИВОПОЛОЖНОГО контекста
 * (Разборка → «Мои авто», Мои авто → «Разборка»), а кнопка «Админ» видна
 * в обоих. Плавность переходов — framer-motion.
 */
export default function ContextSwitcher({ current, excludeIds = [], variant = 'bar' }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const reduce = useReducedMotion()

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
    if (c.id === current) return
    if (c.id === 'admin') localStorage.removeItem('activeRole')
    else localStorage.setItem('activeRole', roleFor(c.id))
    localStorage.removeItem('tsp_profile_cache')
    queryClient.clear()
    navigate(c.path)
  }

  // Кнопки переключения = доступные контексты Разборка/Мои авто, КРОМЕ текущего.
  const togglables = CONTEXTS.filter(c => c.id !== 'admin' && c.id !== current && has(c.id) && !excludeIds.includes(c.id))
  const adminCtx = CONTEXTS.find(c => c.id === 'admin')!
  const showAdminBtn = has('admin') && !excludeIds.includes('admin')

  const spring = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const }

  const pillStyle = {
    background: 'var(--cab-surface-2)',
    color: 'var(--cab-ink-2)',
    border: '1px solid var(--cab-border)',
  }

  // ── SIDEBAR: компактный переключатель (иконки на md, ярлык на lg) ──────────
  if (variant === 'sidebar') {
    return (
      <div className="flex items-center gap-1 w-full min-w-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {togglables.map(c => (
            <motion.button
              key={c.id}
              layout
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
              transition={spring}
              whileTap={{ scale: 0.96 }}
              onClick={() => switchTo(c)}
              title={`Перейти: ${c.label}`}
              className="flex items-center justify-center lg:justify-start gap-2 h-9 px-2 lg:px-2.5 rounded-xl text-sm font-semibold flex-1 min-w-0"
              style={pillStyle}
            >
              <c.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.6} />
              <span className="hidden lg:block truncate">{c.label}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    )
  }

  // ── BAR: переключатель противоположного контекста + кнопка «Админ» ─────────
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <AnimatePresence mode="popLayout" initial={false}>
        {togglables.map(c => (
          <motion.button
            key={c.id}
            layout
            initial={reduce ? false : { opacity: 0, scale: 0.9, x: -6 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.9, x: -6 }}
            transition={spring}
            whileTap={{ scale: 0.96 }}
            onClick={() => switchTo(c)}
            title={`Перейти: ${c.label}`}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold flex-shrink-0 whitespace-nowrap"
            style={pillStyle}
          >
            <c.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
            <span className={togglables.length > 1 ? 'hidden sm:inline' : ''}>{c.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      {showAdminBtn && (
        <motion.button
          layout
          whileTap={{ scale: 0.96 }}
          transition={spring}
          onClick={() => switchTo(adminCtx)}
          title="Админ-панель"
          className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold flex-shrink-0 whitespace-nowrap"
          style={current === 'admin'
            ? { background: 'var(--cab-ink)', color: '#fff' }
            : pillStyle}
        >
          <Shield className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} />
          <span className={current === 'admin' ? '' : 'hidden sm:inline'}>Админ</span>
        </motion.button>
      )}
    </div>
  )
}
