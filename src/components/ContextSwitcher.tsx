import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Wrench, Store, Car, ChevronDown, Check } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'

type ContextId = 'admin' | 'sto' | 'parts' | 'user'

interface Ctx {
  id: ContextId
  label: string
  icon: any
  path: string
  cls: string       // цвет иконки/плашки
}

const CONTEXTS: Ctx[] = [
  { id: 'admin', label: 'Админ',    icon: Shield, path: '/admin',            cls: 'bg-purple-100 text-purple-600' },
  { id: 'sto',   label: 'СТО',      icon: Wrench, path: '/',                 cls: 'bg-emerald-100 text-emerald-600' },
  { id: 'parts', label: 'Разборка', icon: Store,  path: '/parts/dashboard',  cls: 'bg-orange-100 text-orange-600' },
  { id: 'user',  label: 'Мои авто', icon: Car,    path: '/my-vehicles',      cls: 'bg-blue-100 text-blue-600' },
]

/** Переключатель контекста (лайаута): Админ / СТО / Разборка / Мои авто. */
export default function ContextSwitcher({ current, excludeIds = [] }: { current: ContextId; excludeIds?: ContextId[] }) {
  const navigate = useNavigate()
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

  const has = (id: ContextId) => {
    if (id === 'admin') return isAdmin
    if (id === 'sto') return isAdmin || roleNames.includes('sto_owner') || roleNames.includes('sto_worker')
    if (id === 'parts') return isAdmin || roleNames.includes('parts_owner') || roleNames.includes('parts_worker')
    return isAdmin || roleNames.includes('user')
  }
  const available = CONTEXTS.filter(c => has(c.id) && !excludeIds.includes(c.id))

  // activeRole для целевого контекста — по фактическим ролям пользователя
  const roleFor = (id: ContextId): string => {
    if (id === 'sto') return roleNames.includes('sto_worker') && !roleNames.includes('sto_owner') ? 'sto_worker' : 'sto_owner'
    if (id === 'parts') return roleNames.includes('parts_worker') && !roleNames.includes('parts_owner') ? 'parts_worker' : 'parts_owner'
    if (id === 'admin') return 'admin'
    return 'user'
  }

  const switchTo = (c: Ctx) => {
    setOpen(false)
    if (c.id === current) return
    if (c.id === 'admin') localStorage.removeItem('activeRole')
    else localStorage.setItem('activeRole', roleFor(c.id))
    navigate(c.path)
  }

  const cur = CONTEXTS.find(c => c.id === current)!

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => available.length > 1 && setOpen(o => !o)}
        className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cur.cls}`}>
          <cur.icon className="w-4.5 h-4.5" strokeWidth={1.5} />
        </span>
        <span className="font-bold text-gray-900 text-sm sm:text-base">{cur.label}</span>
        {available.length > 1 && <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2.5 py-1.5">Переключить раздел</p>
          {available.map(c => (
            <button key={c.id} onClick={() => switchTo(c)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${c.id === current ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.cls}`}>
                <c.icon className="w-4.5 h-4.5" strokeWidth={1.5} />
              </span>
              <span className="flex-1 text-sm font-semibold text-gray-800">{c.label}</span>
              {c.id === current && <Check className="w-4 h-4 text-purple-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
